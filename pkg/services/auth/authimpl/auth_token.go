package authimpl

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util"
)

var (
	getTime          = time.Now
	errUserIDInvalid = errors.New("invalid user ID")
)

var _ auth.UserTokenService = (*UserAuthTokenService)(nil)

func ProvideUserAuthTokenService(ctx context.Context, sql legacysql.LegacyDatabaseProvider,
	serverLockService *serverlock.ServerLockService,
	quotaService quota.Service, secretService secrets.Service, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	cfgProvider configprovider.ConfigProvider, tracer tracing.Tracer,
) (*UserAuthTokenService, error) {
	s := &UserAuthTokenService{
		sql:               sql,
		serverLockService: serverLockService,
		cfgProvider:       cfgProvider,
		log:               log.New("auth"),
		tracer:            tracer,
	}

	s.externalSessionStore = provideExternalSessionStore(sql, secretService, tracer)

	cfg, err := cfgProvider.Get(ctx)
	if err != nil {
		return s, err
	}
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
	// sql resolves qualified table names and the shared database.
	sql                  legacysql.LegacyDatabaseProvider
	serverLockService    *serverlock.ServerLockService
	cfgProvider          configprovider.ConfigProvider
	log                  log.Logger
	externalSessionStore auth.ExternalSessionStore
	tracer               tracing.Tracer
}

func (s *UserAuthTokenService) CreateToken(ctx context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.CreateToken")
	defer span.End()

	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}

	token, hashedToken, err := generateAndHashToken(cfg.SecretKey)
	if err != nil {
		return nil, err
	}

	now := getTime().Unix()
	clientIPStr := cmd.ClientIP.String()
	if len(cmd.ClientIP) == 0 {
		clientIPStr = ""
	}

	userAuthToken := userAuthToken{
		UserId:    cmd.User.ID,
		AuthToken: hashedToken,
		ClientIp:  clientIPStr,
		UserAgent: cmd.UserAgent,
		CreatedAt: now,
		UpdatedAt: now,
		SeenAt:    now,
		RevokedAt: 0,
	}

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	err = dbHelper.DB.InTransaction(ctx, func(ctx context.Context) error {
		if cmd.ExternalSession != nil {
			inErr := s.externalSessionStore.Create(ctx, cmd.ExternalSession)
			if inErr != nil {
				return inErr
			}
			userAuthToken.ExternalSessionId = cmd.ExternalSession.ID
		}

		inErr := dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
			_, err := dbSession.Table(dbHelper.Table("user_auth_token")).Insert(&userAuthToken)
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

	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	hashedToken := hashToken(cfg.SecretKey, unhashedToken)
	var model userAuthToken
	var exists bool
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err = dbSession.Table(dbHelper.Table("user_auth_token")).
			Where("auth_token = ?", hashedToken).
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

	if model.CreatedAt <= s.createdAfterParam(cfg) || model.SeenAt <= s.seenAfterParam(cfg) {
		ctxLogger.Debug("User token has expired", "userID", model.UserId, "tokenID", model.Id, "createdAt", model.CreatedAt, "seenAt", model.SeenAt)
		return nil, &auth.TokenExpiredError{
			UserID:  model.UserId,
			TokenID: model.Id,
		}
	}

	// Activity is independent of the credential. Bound writes and use a conditional
	// update so concurrent requests cannot move activity backwards or revive a session.
	now := getTime()
	writeInterval := max(time.Second, min(time.Minute, cfg.LoginMaxInactiveLifetime/10))
	if model.SeenAt <= now.Add(-writeInterval).Unix() {
		err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
			_, err := dbSession.Table(dbHelper.Table("user_auth_token")).
				Where("id = ? AND auth_token = ? AND revoked_at = 0 AND seen_at <= ? AND seen_at > ? AND created_at > ?",
					model.Id, hashedToken, now.Add(-writeInterval).Unix(), s.seenAfterParam(cfg), s.createdAfterParam(cfg)).
				Cols("seen_at").Update(&userAuthToken{SeenAt: now.Unix()})
			return err
		})
		if err != nil {
			return nil, err
		}
		model.SeenAt = max(model.SeenAt, now.Unix())
	}

	model.UnhashedToken = unhashedToken

	var userToken auth.UserToken
	err = model.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) GetTokenByExternalSessionID(ctx context.Context, externalSessionID int64) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.GetTokenByExternalSessionID")
	defer span.End()

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	var token userAuthToken
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err := dbSession.Table(dbHelper.Table("user_auth_token")).
			Where("external_session_id = ?", externalSessionID).Get(&token)
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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return err
	}

	ctxLogger := s.log.FromContext(ctx)

	var rowsAffected int64

	if soft {
		model.RevokedAt = getTime().Unix()
		err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
			rowsAffected, err = dbSession.Table(dbHelper.Table("user_auth_token")).ID(model.Id).Update(model)
			return err
		})
	} else {
		err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
			rowsAffected, err = dbSession.Table(dbHelper.Table("user_auth_token")).Delete(model)
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

type revokeAllUserTokensQuery struct {
	sqltemplate.SQLTemplate
	TokenTable string
	UserID     int64
}

func (q revokeAllUserTokensQuery) Validate() error { return nil }

func (s *UserAuthTokenService) RevokeAllUserTokens(ctx context.Context, userId int64) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.RevokeAllUserTokens")
	defer span.End()

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.InTransaction(ctx, func(ctx context.Context) error {
		ctxLogger := s.log.FromContext(ctx)
		err := dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
			query := revokeAllUserTokensQuery{
				SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
				TokenTable:  dbHelper.Table("user_auth_token"),
				UserID:      userId,
			}
			rawSQL, err := sqltemplate.Execute(revokeAllUserTokensTemplate, query)
			if err != nil {
				return err
			}

			res, err := dbSession.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
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

type batchRevokeAllUserTokensQuery struct {
	sqltemplate.SQLTemplate
	TokenTable string
	UserIDs    []int64
}

func (q batchRevokeAllUserTokensQuery) Validate() error { return nil }

func (s *UserAuthTokenService) BatchRevokeAllUserTokens(ctx context.Context, userIds []int64) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.BatchRevokeAllUserTokens")
	defer span.End()

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.InTransaction(ctx, func(ctx context.Context) error {
		ctxLogger := s.log.FromContext(ctx)
		if len(userIds) == 0 {
			return nil
		}

		var affected int64

		err := dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
			query := batchRevokeAllUserTokensQuery{
				SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
				TokenTable:  dbHelper.Table("user_auth_token"),
				UserIDs:     userIds,
			}
			rawSQL, err := sqltemplate.Execute(batchRevokeAllUserTokensTemplate, query)
			if err != nil {
				return err
			}

			res, inErr := dbSession.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	var result auth.UserToken
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		var token userAuthToken
		exists, err := dbSession.Table(dbHelper.Table("user_auth_token")).
			Where("id = ? AND user_id = ?", userTokenId, userId).Get(&token)
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

	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	result := []*auth.UserToken{}
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		var tokens []*userAuthToken
		err := dbSession.Table(dbHelper.Table("user_auth_token")).
			Where("user_id = ? AND created_at > ? AND seen_at > ? AND revoked_at = 0",
				userId,
				s.createdAfterParam(cfg),
				s.seenAfterParam(cfg)).
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

type activeTokenCountQuery struct {
	sqltemplate.SQLTemplate
	TokenTable   string
	CreatedAfter int64
	SeenAfter    int64
	FilterByUser bool
	UserID       int64
}

func (q activeTokenCountQuery) Validate() error { return nil }

// ActiveTokenCount returns the number of active tokens. If userID is nil, the count is for all users.
func (s *UserAuthTokenService) ActiveTokenCount(ctx context.Context, userID *int64) (int64, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.ActiveTokenCount")
	defer span.End()

	if userID != nil && *userID < 1 {
		return 0, errUserIDInvalid
	}

	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return 0, err
	}

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return 0, err
	}

	query := activeTokenCountQuery{
		SQLTemplate:  sqltemplate.New(dbHelper.DialectForDriver()),
		TokenTable:   dbHelper.Table("user_auth_token"),
		CreatedAfter: s.createdAfterParam(cfg),
		SeenAfter:    s.seenAfterParam(cfg),
	}
	if userID != nil {
		query.FilterByUser = true
		query.UserID = *userID
	}
	rawSQL, err := sqltemplate.Execute(activeTokenCountTemplate, query)
	if err != nil {
		return 0, err
	}

	var count int64
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		_, err := dbSession.SQL(rawSQL, query.GetArgs()...).Get(&count)
		return err
	})

	return count, err
}

type deleteUserRevokedTokensQuery struct {
	sqltemplate.SQLTemplate
	TokenTable    string
	UserID        int64
	RevokedBefore int64
}

func (q deleteUserRevokedTokensQuery) Validate() error { return nil }

func (s *UserAuthTokenService) DeleteUserRevokedTokens(ctx context.Context, userID int64, window time.Duration) error {
	ctx, span := s.tracer.Start(ctx, "authtoken.DeleteUserRevokedTokens")
	defer span.End()

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		query := deleteUserRevokedTokensQuery{
			SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
			TokenTable:    dbHelper.Table("user_auth_token"),
			UserID:        userID,
			RevokedBefore: time.Now().Add(-window).Unix(),
		}
		rawSQL, err := sqltemplate.Execute(deleteUserRevokedTokensTemplate, query)
		if err != nil {
			return err
		}

		res, err := sess.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	result := []*auth.UserToken{}
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		var tokens []*userAuthToken
		err := dbSession.Table(dbHelper.Table("user_auth_token")).
			Where("user_id = ? AND revoked_at > 0", userId).Asc("seen_at").Find(&tokens)
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

func (s *UserAuthTokenService) createdAfterParam(cfg *setting.Cfg) int64 {
	return getTime().Add(-cfg.LoginMaxLifetime).Unix()
}

func (s *UserAuthTokenService) seenAfterParam(cfg *setting.Cfg) int64 {
	return getTime().Add(-cfg.LoginMaxInactiveLifetime).Unix()
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
