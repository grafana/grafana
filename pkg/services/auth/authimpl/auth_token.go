package authimpl

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	getTime            = time.Now
	errTokenNotRotated = errors.New("token was not rotated")
	errUserIDInvalid   = errors.New("invalid user ID")
)

const SkipRotationTime = 5 * time.Second

var _ auth.UserTokenService = (*UserAuthTokenService)(nil)

func ProvideUserAuthTokenService(sqlStore db.DB,
	serverLockService *serverlock.ServerLockService,
	quotaService quota.Service, secretService secrets.Service,
	cfg *setting.Cfg, tracer tracing.Tracer, features featuremgmt.FeatureToggles,
) (*UserAuthTokenService, error) {
	s := &UserAuthTokenService{
		sqlStore:          sqlStore,
		serverLockService: serverLockService,
		cfg:               cfg,
		log:               log.New("auth"),
		singleflight:      new(singleflight.Group),
		features:          features,
		tracer:            tracer,
	}
	s.externalSessionStore = provideExternalSessionStore(sqlStore, secretService, tracer)

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return s, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     auth.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      s.reportActiveTokenCount,
	}); err != nil {
		return s, err
	}

	return s, nil
}

type UserAuthTokenService struct {
	sqlStore             db.DB
	serverLockService    *serverlock.ServerLockService
	cfg                  *setting.Cfg
	log                  log.Logger
	externalSessionStore auth.ExternalSessionStore
	singleflight         *singleflight.Group
	features             featuremgmt.FeatureToggles
	tracer               tracing.Tracer
}

func (s *UserAuthTokenService) CreateToken(ctx context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.CreateToken")
	defer span.End()

	token, hashedToken, err := generateAndHashToken(s.cfg.SecretKey)
	if err != nil {
		return nil, err
	}

	now := getTime().Unix()
	clientIPStr := cmd.ClientIP.String()
	if len(cmd.ClientIP) == 0 {
		clientIPStr = ""
	}

	userAuthToken := userAuthToken{
		UserId:        cmd.User.ID,
		AuthToken:     hashedToken,
		PrevAuthToken: hashedToken,
		ClientIp:      clientIPStr,
		UserAgent:     cmd.UserAgent,
		RotatedAt:     now,
		CreatedAt:     now,
		UpdatedAt:     now,
		SeenAt:        0,
		RevokedAt:     0,
		AuthTokenSeen: false,
	}

	err = s.sqlStore.InTransaction(ctx, func(ctx context.Context) error {
		if cmd.ExternalSession != nil {
			inErr := s.externalSessionStore.Create(ctx, cmd.ExternalSession)
			if inErr != nil {
				return inErr
			}
			userAuthToken.ExternalSessionId = cmd.ExternalSession.ID
		}

		inErr := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
			_, err := dbSession.Insert(&userAuthToken)
			return err
		})
		return inErr
	})
	if err != nil {
		return nil, err
	}

	userAuthToken.UnhashedToken = token

	ctxLogger := s.log.FromContext(ctx)
	ctxLogger.Debug("User auth token created", "tokenID", userAuthToken.Id, "userID", userAuthToken.UserId, "clientIP", userAuthToken.ClientIp, "userAgent", userAuthToken.UserAgent, "authToken", userAuthToken.AuthToken)

	var userToken auth.UserToken
	err = userAuthToken.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) LookupToken(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.LookupToken")
	defer span.End()

	hashedToken := hashToken(s.cfg.SecretKey, unhashedToken)
	var model userAuthToken
	var exists bool
	var err error
	err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err = dbSession.Where("(auth_token = ? OR prev_auth_token = ?)",
			hashedToken,
			hashedToken).
			Get(&model)

		return err
	})
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, auth.ErrUserTokenNotFound
	}

	ctxLogger := s.log.FromContext(ctx)

	if model.RevokedAt > 0 {
		ctxLogger.Debug("User token has been revoked", "userID", model.UserId, "tokenID", model.Id, "revokedAt", model.RevokedAt)
		return nil, &auth.TokenRevokedError{
			UserID:  model.UserId,
			TokenID: model.Id,
		}
	}

	if model.CreatedAt <= s.createdAfterParam() || model.RotatedAt <= s.rotatedAfterParam() {
		ctxLogger.Debug("User token has expired", "userID", model.UserId, "tokenID", model.Id, "createdAt", model.CreatedAt, "rotatedAt", model.RotatedAt)
		return nil, &auth.TokenExpiredError{
			UserID:  model.UserId,
			TokenID: model.Id,
		}
	}

	// Current incoming token is the previous auth token in the DB and the auth_token_seen is true
	if model.AuthToken != hashedToken && model.PrevAuthToken == hashedToken && model.AuthTokenSeen {
		model.AuthTokenSeen = false
		model.RotatedAt = getTime().Add(-usertoken.UrgentRotateTime).Unix()

		var affectedRows int64
		err = s.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
			affectedRows, err = dbSession.Where("id = ? AND prev_auth_token = ? AND rotated_at < ?",
				model.Id,
				model.PrevAuthToken,
				model.RotatedAt).
				AllCols().Update(&model)

			return err
		})
		if err != nil {
			return nil, err
		}

		if affectedRows == 0 {
			ctxLogger.Debug("Prev seen token unchanged", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		} else {
			ctxLogger.Debug("Prev seen token", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		}
	}

	// Current incoming token is not seen and it is the latest valid auth token in the db
	if !model.AuthTokenSeen && model.AuthToken == hashedToken {
		model.AuthTokenSeen = true
		model.SeenAt = getTime().Unix()

		var affectedRows int64
		err = s.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
			affectedRows, err = dbSession.Where("id = ? AND auth_token = ?",
				model.Id,
				model.AuthToken).
				AllCols().Update(&model)

			return err
		})
		if err != nil {
			return nil, err
		}

		if affectedRows == 0 {
			ctxLogger.Debug("Seen wrong token", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		} else {
			ctxLogger.Debug("Seen token", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		}
	}

	model.UnhashedToken = unhashedToken

	var userToken auth.UserToken
	err = model.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) GetTokenByExternalSessionID(ctx context.Context, externalSessionID int64) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.GetTokenByExternalSessionID")
	defer span.End()

	var token userAuthToken
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Where("external_session_id = ?", externalSessionID).Get(&token)
		if err != nil {
			return err
		}

		if !exists {
			return auth.ErrUserTokenNotFound
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	var userToken auth.UserToken
	err = token.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) GetExternalSession(ctx context.Context, externalSessionID int64) (*auth.ExternalSession, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.GetExternalSession")
	defer span.End()

	return s.externalSessionStore.Get(ctx, externalSessionID)
}

func (s *UserAuthTokenService) FindExternalSessions(ctx context.Context, query *auth.ListExternalSessionQuery) ([]*auth.ExternalSession, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.FindExternalSessions")
	defer span.End()

	return s.externalSessionStore.List(ctx, query)
}

func (s *UserAuthTokenService) UpdateExternalSession(ctx context.Context, externalSessionID int64, cmd *auth.UpdateExternalSessionCommand) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.UpdateExternalSession")
	defer span.End()

	return s.externalSessionStore.Update(ctx, externalSessionID, cmd)
}

func (s *UserAuthTokenService) RotateToken(ctx context.Context, cmd auth.RotateCommand) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.RotateToken")
	defer span.End()

	if cmd.UnHashedToken == "" {
		return nil, auth.ErrInvalidSessionToken
	}

	rotate := func(ctx context.Context) (*auth.UserToken, error) {
		token, err := s.LookupToken(ctx, cmd.UnHashedToken)
		if err != nil {
			return nil, err
		}
		log := s.log.FromContext(ctx).New("tokenID", token.Id, "userID", token.UserId, "createdAt", token.CreatedAt, "rotatedAt", token.RotatedAt)

		// Avoid multiple instances in HA mode rotating at the same time.
		if s.features.IsEnabled(ctx, featuremgmt.FlagSkipTokenRotationIfRecent) && time.Unix(token.RotatedAt, 0).Add(SkipRotationTime).After(getTime()) {
			log.Debug("Token was last rotated very recently, skipping rotation")
			span.SetAttributes(attribute.Bool("skipped", true))
			return token, nil
		}
		log.Debug("Rotating token")

		newToken, err := s.rotateToken(ctx, token, cmd.IP, cmd.UserAgent)

		if errors.Is(err, errTokenNotRotated) {
			span.SetAttributes(attribute.Bool("rotated", false))
			return token, nil
		}

		if err != nil {
			span.SetStatus(codes.Error, "token rotation failed")
			span.RecordError(err)
			return nil, err
		}

		return newToken, nil
	}

	res, err, _ := s.singleflight.Do(cmd.UnHashedToken, func() (any, error) {
		if s.features.IsEnabled(ctx, featuremgmt.FlagSkipTokenRotationIfRecent) {
			var token *auth.UserToken
			err := s.sqlStore.InTransaction(ctx, func(ctx context.Context) error {
				var err error
				token, err = rotate(ctx)
				return err
			})
			return token, err
		}
		return rotate(ctx)
	})

	if err != nil {
		return nil, err
	}

	return res.(*auth.UserToken), nil
}

func (s *UserAuthTokenService) rotateToken(ctx context.Context, token *auth.UserToken, clientIP net.IP, userAgent string) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.rotateToken")
	defer span.End()

	var clientIPStr string
	if clientIP != nil {
		clientIPStr = clientIP.String()
	}

	newToken, hashedToken, err := generateAndHashToken(s.cfg.SecretKey)
	if err != nil {
		return nil, err
	}

	sql := `
		UPDATE user_auth_token
		SET
			seen_at = 0,
			user_agent = ?,
			client_ip = ?,
			prev_auth_token = auth_token,
			auth_token = ?,
			auth_token_seen = ?,
			rotated_at = ?
		WHERE id = ?
	`

	now := getTime()
	var affected int64
	withDbSession := s.sqlStore.WithDbSession
	if !s.features.IsEnabled(ctx, featuremgmt.FlagSkipTokenRotationIfRecent) {
		withDbSession = s.sqlStore.WithTransactionalDbSession
	}
	err = withDbSession(ctx, func(dbSession *db.Session) error {
		res, err := dbSession.Exec(sql, userAgent, clientIPStr, hashedToken, s.sqlStore.GetDialect().BooleanValue(false), now.Unix(), token.Id)
		if err != nil {
			return err
		}

		affected, err = res.RowsAffected()
		return err
	})
	if err != nil {
		return nil, err
	}

	if affected < 1 {
		return nil, errTokenNotRotated
	}

	token.PrevAuthToken = token.AuthToken
	token.AuthToken = hashedToken
	token.UnhashedToken = newToken
	token.AuthTokenSeen = false
	token.RotatedAt = now.Unix()

	return token, nil
}

func (s *UserAuthTokenService) RevokeToken(ctx context.Context, token *auth.UserToken, soft bool) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.RevokeToken")
	defer span.End()

	if token == nil {
		return auth.ErrUserTokenNotFound
	}

	model, err := userAuthTokenFromUserToken(token)
	if err != nil {
		return err
	}

	ctxLogger := s.log.FromContext(ctx)

	var rowsAffected int64

	if soft {
		model.RevokedAt = getTime().Unix()
		err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
			rowsAffected, err = dbSession.ID(model.Id).Update(model)
			return err
		})
	} else {
		err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
			rowsAffected, err = dbSession.Delete(model)
			return err
		})
	}

	if err != nil {
		return err
	}

	if model.ExternalSessionId != 0 {
		err = s.externalSessionStore.Delete(ctx, model.ExternalSessionId)
		if err != nil {
			// Intentionally not returning error here, as the token has been revoked -> the backround job will clean up orphaned external sessions
			ctxLogger.Warn("Failed to delete external session", "externalSessionID", model.ExternalSessionId, "err", err)
		}
	}

	if rowsAffected == 0 {
		ctxLogger.Debug("User auth token not found/revoked", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent)
		return auth.ErrUserTokenNotFound
	}

	ctxLogger.Debug("User auth token revoked", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "soft", soft)

	return nil
}

func (s *UserAuthTokenService) RevokeAllUserTokens(ctx context.Context, userId int64) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.RevokeAllUserTokens")
	defer span.End()

	return s.sqlStore.InTransaction(ctx, func(ctx context.Context) error {
		ctxLogger := s.log.FromContext(ctx)
		err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
			sql := `DELETE from user_auth_token WHERE user_id = ?`
			res, err := dbSession.Exec(sql, userId)
			if err != nil {
				return err
			}

			affected, err := res.RowsAffected()
			if err != nil {
				return err
			}

			ctxLogger.Debug("All user tokens for user revoked", "userID", userId, "count", affected)

			return nil
		})
		if err != nil {
			return err
		}

		err = s.externalSessionStore.DeleteExternalSessionsByUserID(ctx, userId)
		if err != nil {
			// Intentionally not returning error here, as the token has been revoked -> the backround job will clean up orphaned external sessions
			ctxLogger.Warn("Failed to delete external sessions for user", "userID", userId, "err", err)
		}
		return nil
	})
}

func (s *UserAuthTokenService) BatchRevokeAllUserTokens(ctx context.Context, userIds []int64) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.BatchRevokeAllUserTokens")
	defer span.End()

	return s.sqlStore.InTransaction(ctx, func(ctx context.Context) error {
		ctxLogger := s.log.FromContext(ctx)
		if len(userIds) == 0 {
			return nil
		}

		userIdParams := strings.Repeat(",?", len(userIds)-1)
		sql := "DELETE from user_auth_token WHERE user_id IN (?" + userIdParams + ")"

		params := []any{sql}
		for _, v := range userIds {
			params = append(params, v)
		}

		var affected int64

		err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
			res, inErr := dbSession.Exec(params...)
			if inErr != nil {
				return inErr
			}

			affected, inErr = res.RowsAffected()
			return inErr
		})
		if err != nil {
			return err
		}

		err = s.externalSessionStore.BatchDeleteExternalSessionsByUserIDs(ctx, userIds)
		if err != nil {
			ctxLogger.Warn("Failed to delete external sessions for users", "users", userIds, "err", err)
		}

		ctxLogger.Debug("All user tokens for given users revoked", "usersCount", len(userIds), "count", affected)

		return nil
	})
}

func (s *UserAuthTokenService) GetUserToken(ctx context.Context, userId, userTokenId int64) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.GetUserToken")
	defer span.End()

	var result auth.UserToken
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		var token userAuthToken
		exists, err := dbSession.Where("id = ? AND user_id = ?", userTokenId, userId).Get(&token)
		if err != nil {
			return err
		}

		if !exists {
			return auth.ErrUserTokenNotFound
		}

		return token.toUserToken(&result)
	})

	return &result, err
}

func (s *UserAuthTokenService) GetUserTokens(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.GetUserTokens")
	defer span.End()

	result := []*auth.UserToken{}
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		var tokens []*userAuthToken
		err := dbSession.Where("user_id = ? AND created_at > ? AND rotated_at > ? AND revoked_at = 0",
			userId,
			s.createdAfterParam(),
			s.rotatedAfterParam()).
			Find(&tokens)
		if err != nil {
			return err
		}

		for _, token := range tokens {
			var userToken auth.UserToken
			if err := token.toUserToken(&userToken); err != nil {
				return err
			}
			result = append(result, &userToken)
		}

		return nil
	})

	return result, err
}

// ActiveTokenCount returns the number of active tokens. If userID is nil, the count is for all users.
func (s *UserAuthTokenService) ActiveTokenCount(ctx context.Context, userID *int64) (int64, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.ActiveTokenCount")
	defer span.End()

	if userID != nil && *userID < 1 {
		return 0, errUserIDInvalid
	}

	var count int64
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := `SELECT COUNT(*) FROM user_auth_token WHERE created_at > ? AND rotated_at > ? AND revoked_at = 0`
		args := []interface{}{s.createdAfterParam(), s.rotatedAfterParam()}
		if userID != nil {
			query += " AND user_id = ?"
			args = append(args, *userID)
		}
		_, err := dbSession.SQL(query, args...).Get(&count)
		return err
	})

	return count, err
}

func (s *UserAuthTokenService) DeleteUserRevokedTokens(ctx context.Context, userID int64, window time.Duration) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.DeleteUserRevokedTokens")
	defer span.End()

	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		query := "DELETE FROM user_auth_token WHERE user_id = ? AND revoked_at > 0 AND revoked_at <= ?"
		res, err := sess.Exec(query, userID, time.Now().Add(-window).Unix())
		if err != nil {
			return err
		}

		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}

		s.log.FromContext(ctx).Debug("Deleted user revoked tokens", "userID", userID, "count", rows)
		return err
	})
}

func (s *UserAuthTokenService) GetUserRevokedTokens(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.GetUserRevokedTokens")
	defer span.End()

	result := []*auth.UserToken{}
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		var tokens []*userAuthToken
		err := dbSession.Where("user_id = ? AND revoked_at > 0", userId).Asc("seen_at").Find(&tokens)
		if err != nil {
			return err
		}

		for _, token := range tokens {
			var userToken auth.UserToken
			if err := token.toUserToken(&userToken); err != nil {
				return err
			}
			result = append(result, &userToken)
		}

		return nil
	})

	return result, err
}

func (s *UserAuthTokenService) reportActiveTokenCount(ctx context.Context, _ *quota.ScopeParameters) (*quota.Map, error) {
	count, err := s.ActiveTokenCount(ctx, nil)
	if err != nil {
		return nil, err
	}

	tag, err := quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return nil, err
	}

	u := &quota.Map{}
	u.Set(tag, count)

	return u, err
}

func (s *UserAuthTokenService) createdAfterParam() int64 {
	return getTime().Add(-s.cfg.LoginMaxLifetime).Unix()
}

func (s *UserAuthTokenService) rotatedAfterParam() int64 {
	return getTime().Add(-s.cfg.LoginMaxInactiveLifetime).Unix()
}

func createToken() (string, error) {
	token, err := util.RandomHex(16)
	if err != nil {
		return "", err
	}

	return token, nil
}

func hashToken(secretKey string, token string) string {
	hashBytes := sha256.Sum256([]byte(token + secretKey))
	return hex.EncodeToString(hashBytes[:])
}

func generateAndHashToken(secretKey string) (string, string, error) {
	token, err := createToken()
	if err != nil {
		return "", "", err
	}

	return token, hashToken(secretKey, token), nil
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.Session)
	return limits, nil
}
