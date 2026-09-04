package authimpl

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/configprovider"
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
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var (
	getTime            = time.Now
	errTokenNotRotated = errors.New("token was not rotated")
	errUserIDInvalid   = errors.New("invalid user ID")
)

const SkipRotationTime = 5 * time.Second

var _ auth.UserTokenService = (*UserAuthTokenService)(nil)
var _ auth.SessionTokenAuthnService = (*UserAuthTokenService)(nil)

func ProvideUserAuthTokenService(ctx context.Context, sql legacysql.LegacyDatabaseProvider,
	serverLockService *serverlock.ServerLockService,
	quotaService quota.Service, secretService secrets.Service, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	cfgProvider configprovider.ConfigProvider, tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
) (*UserAuthTokenService, error) {
	s := &UserAuthTokenService{
		sql:               sql,
		serverLockService: serverLockService,
		cfgProvider:       cfgProvider,
		log:               log.New("auth"),
		singleflight:      new(singleflight.Group),
		features:          features,
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
	singleflight         *singleflight.Group
	features             featuremgmt.FeatureToggles
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
			Where("(auth_token = ? OR prev_auth_token = ?)",
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

	return s.validateToken(ctx, cfg, dbHelper, &model, hashedToken, unhashedToken)
}

// LookupTokenForAuthn resolves the session token, its exact auth provider, and
// the OAuth credentials associated with that session in a single query. It is
// intentionally separate from LookupToken so non-authentication callers do not
// pay for joins or secret decryption they do not need.
func (s *UserAuthTokenService) LookupTokenForAuthn(ctx context.Context, unhashedToken string) (*auth.SessionTokenAuthnInfo, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.LookupTokenForAuthn")
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
	var row sessionTokenAuthnRow
	var exists bool
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err = dbSession.Table(dbHelper.Table("user_auth_token")).Alias("uat").
			Select(strings.Join(sessionTokenAuthnColumns, ", ")).
			Join("LEFT", []string{dbHelper.Table("user_external_session"), "ues"}, "uat.external_session_id = ues.id").
			Join("LEFT", []string{dbHelper.Table("user_auth"), "ua"}, "ues.user_auth_id = ua.id").
			Where("(uat.auth_token = ? OR uat.prev_auth_token = ?)", hashedToken, hashedToken).
			Get(&row)
		return err
	})
	if err != nil {
		// Keep session authentication available if an optional join cannot be
		// evaluated during rollout. The caller will use the established AuthInfo
		// and OAuth-token paths when only the token is returned.
		s.log.FromContext(ctx).Warn("Optimized session lookup failed; falling back to token lookup", "err", err)
		token, fallbackErr := s.LookupToken(ctx, unhashedToken)
		if fallbackErr != nil {
			return nil, fallbackErr
		}
		return &auth.SessionTokenAuthnInfo{Token: token}, nil
	}
	if !exists {
		return nil, auth.ErrUserTokenNotFound
	}

	model := row.userAuthToken()
	token, err := s.validateToken(ctx, cfg, dbHelper, model, hashedToken, unhashedToken)
	if err != nil {
		return nil, err
	}

	result := &auth.SessionTokenAuthnInfo{
		Token:       token,
		AuthID:      row.AuthID.String,
		AuthModule:  row.AuthModule.String,
		HasAuthInfo: row.AuthInfoID.Valid,
	}
	// External-session credentials are authoritative only when improved external
	// session handling is enabled. The legacy path keeps reading OAuth fields
	// from user_auth.
	//nolint:staticcheck // not yet migrated to OpenFeature
	useExternalSession := s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagImprovedExternalSessionHandling)
	if !useExternalSession || !row.ExternalSessionID.Valid || !strings.HasPrefix(result.AuthModule, "oauth") {
		return result, nil
	}

	externalSession := &auth.ExternalSession{
		ID:           row.ExternalSessionID.Int64,
		AuthModule:   result.AuthModule,
		AccessToken:  row.AccessToken.String,
		RefreshToken: row.RefreshToken.String,
		IDToken:      row.IDToken.String,
		ExpiresAt:    time.Time(row.ExpiresAt),
	}
	secretDecoder, ok := s.externalSessionStore.(oauthSessionSecretDecoder)
	if !ok {
		s.log.FromContext(ctx).Warn("OAuth session prefetch is unavailable; falling back to OAuth token service")
		return result, nil
	}
	if err := secretDecoder.decryptOAuthSecrets(externalSession); err != nil {
		s.log.FromContext(ctx).Warn("Failed to decrypt prefetched OAuth session; falling back to OAuth token service", "err", err)
		return result, nil
	}

	result.OAuthToken = &oauth2.Token{
		AccessToken:  externalSession.AccessToken,
		RefreshToken: externalSession.RefreshToken,
		Expiry:       externalSession.ExpiresAt,
	}
	if externalSession.IDToken != "" {
		result.OAuthToken = result.OAuthToken.WithExtra(map[string]any{"id_token": externalSession.IDToken})
	}

	return result, nil
}

type oauthSessionSecretDecoder interface {
	decryptOAuthSecrets(*auth.ExternalSession) error
}

func (s *UserAuthTokenService) validateToken(ctx context.Context, cfg *setting.Cfg, dbHelper *legacysql.LegacyDatabaseHelper,
	model *userAuthToken, hashedToken, unhashedToken string,
) (*auth.UserToken, error) {
	var err error
	ctxLogger := s.log.FromContext(ctx)

	if model.RevokedAt > 0 {
		ctxLogger.Debug("User token has been revoked", "userID", model.UserId, "tokenID", model.Id, "revokedAt", model.RevokedAt)
		return nil, &auth.TokenRevokedError{
			UserID:  model.UserId,
			TokenID: model.Id,
		}
	}

	if model.CreatedAt <= s.createdAfterParam(cfg) || model.RotatedAt <= s.rotatedAfterParam(cfg) {
		ctxLogger.Debug("User token has expired", "userID", model.UserId, "tokenID", model.Id, "createdAt", model.CreatedAt, "rotatedAt", model.RotatedAt)
		return nil, &auth.TokenExpiredError{
			UserID:  model.UserId,
			TokenID: model.Id,
		}
	}

	// Current incoming token is the previous auth token in the DB and the auth_token_seen is true
	if model.AuthToken != hashedToken && model.PrevAuthToken == hashedToken && model.AuthTokenSeen {
		origAuthTokenSeen := model.AuthTokenSeen
		origRotatedAt := model.RotatedAt

		model.AuthTokenSeen = false
		model.RotatedAt = getTime().Add(-usertoken.UrgentRotateTime).Unix()

		var affectedRows int64
		err = dbHelper.DB.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
			affectedRows, err = dbSession.Table(dbHelper.Table("user_auth_token")).
				Where("id = ? AND prev_auth_token = ? AND rotated_at < ?",
					model.Id,
					model.PrevAuthToken,
					model.RotatedAt).
				AllCols().Update(model)

			return err
		})
		if err != nil {
			return nil, err
		}

		if affectedRows == 0 {
			ctxLogger.Debug("Prev seen token unchanged", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)

			graceEnabled := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthTokenRotationGracePeriod, false, openfeature.TransactionContext(ctx))
			if graceEnabled {
				// The token has been rotated very recently, so we don't want to rotate it again.
				// We accomplish this by restoring its rotation time and marking it back as seen.
				model.AuthTokenSeen = origAuthTokenSeen
				model.RotatedAt = origRotatedAt
			}
		} else {
			// The token was last rotated more than UrgentRotateTime time ago. We keep the modified rotated_at and
			// mark it as unseen so that it will be considered as needing urgent rotation during authentication.
			ctxLogger.Debug("Prev seen token", "tokenID", model.Id, "userID", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		}
	}

	// Current incoming token is not seen and it is the latest valid auth token in the db
	if !model.AuthTokenSeen && model.AuthToken == hashedToken {
		model.AuthTokenSeen = true
		model.SeenAt = getTime().Unix()

		var affectedRows int64
		err = dbHelper.DB.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
			affectedRows, err = dbSession.Table(dbHelper.Table("user_auth_token")).
				Where("id = ? AND auth_token = ?",
					model.Id,
					model.AuthToken).
				AllCols().Update(model)

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

var sessionTokenAuthnColumns = []string{
	"uat.id AS token_id",
	"uat.user_id AS token_user_id",
	"uat.auth_token AS token_auth_token",
	"uat.prev_auth_token AS token_prev_auth_token",
	"uat.user_agent AS token_user_agent",
	"uat.client_ip AS token_client_ip",
	"uat.auth_token_seen AS token_auth_token_seen",
	"uat.seen_at AS token_seen_at",
	"uat.rotated_at AS token_rotated_at",
	"uat.created_at AS token_created_at",
	"uat.updated_at AS token_updated_at",
	"uat.revoked_at AS token_revoked_at",
	"uat.external_session_id AS token_external_session_id",
	"ues.id AS external_session_id",
	"ues.auth_module AS auth_module",
	"ues.access_token AS access_token",
	"ues.refresh_token AS refresh_token",
	"ues.id_token AS id_token",
	"ues.expires_at AS expires_at",
	"ua.id AS auth_info_id",
	"ua.auth_id AS auth_id",
}

type sessionTokenAuthnRow struct {
	TokenID                int64          `xorm:"token_id"`
	TokenUserID            int64          `xorm:"token_user_id"`
	TokenAuthToken         string         `xorm:"token_auth_token"`
	TokenPrevAuthToken     string         `xorm:"token_prev_auth_token"`
	TokenUserAgent         string         `xorm:"token_user_agent"`
	TokenClientIP          string         `xorm:"token_client_ip"`
	TokenAuthTokenSeen     bool           `xorm:"token_auth_token_seen"`
	TokenSeenAt            int64          `xorm:"token_seen_at"`
	TokenRotatedAt         int64          `xorm:"token_rotated_at"`
	TokenCreatedAt         int64          `xorm:"token_created_at"`
	TokenUpdatedAt         int64          `xorm:"token_updated_at"`
	TokenRevokedAt         int64          `xorm:"token_revoked_at"`
	TokenExternalSessionID int64          `xorm:"token_external_session_id"`
	ExternalSessionID      sql.NullInt64  `xorm:"external_session_id"`
	AuthModule             sql.NullString `xorm:"auth_module"`
	AuthInfoID             sql.NullInt64  `xorm:"auth_info_id"`
	AuthID                 sql.NullString `xorm:"auth_id"`
	AccessToken            sql.NullString `xorm:"access_token"`
	RefreshToken           sql.NullString `xorm:"refresh_token"`
	IDToken                sql.NullString `xorm:"id_token"`
	ExpiresAt              core.NullTime  `xorm:"expires_at"`
}

func (r *sessionTokenAuthnRow) userAuthToken() *userAuthToken {
	return &userAuthToken{
		Id:                r.TokenID,
		UserId:            r.TokenUserID,
		AuthToken:         r.TokenAuthToken,
		PrevAuthToken:     r.TokenPrevAuthToken,
		UserAgent:         r.TokenUserAgent,
		ClientIp:          r.TokenClientIP,
		AuthTokenSeen:     r.TokenAuthTokenSeen,
		SeenAt:            r.TokenSeenAt,
		RotatedAt:         r.TokenRotatedAt,
		CreatedAt:         r.TokenCreatedAt,
		UpdatedAt:         r.TokenUpdatedAt,
		RevokedAt:         r.TokenRevokedAt,
		ExternalSessionId: r.TokenExternalSessionID,
	}
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

func (s *UserAuthTokenService) RotateToken(ctx context.Context, cmd auth.RotateCommand) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.RotateToken")
	defer span.End()

	if cmd.UnHashedToken == "" {
		return nil, auth.ErrInvalidSessionToken
	}

	// Same flag LookupToken uses for rotation-race bookkeeping.
	graceEnabled := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAuthTokenRotationGracePeriod, false, openfeature.TransactionContext(ctx))

	// Key by session ID so a still-valid-but-superseded token collapses into the same rotation.
	singleflightKey := cmd.UnHashedToken
	if graceEnabled {
		initial, err := s.LookupToken(ctx, cmd.UnHashedToken)
		if err != nil {
			return nil, err
		}
		singleflightKey = strconv.FormatInt(initial.Id, 10)
	}

	rotate := func(ctx context.Context) (*auth.UserToken, error) {
		token, err := s.LookupToken(ctx, cmd.UnHashedToken)
		if err != nil {
			return nil, err
		}
		log := s.log.FromContext(ctx).New("tokenID", token.Id, "userID", token.UserId, "createdAt", token.CreatedAt, "rotatedAt", token.RotatedAt)

		skip := time.Unix(token.RotatedAt, 0).Add(SkipRotationTime).After(getTime())

		// Only skip if the presented token is still current -- otherwise it's about to be evicted anyway.
		if graceEnabled {
			cfg, err := s.cfgProvider.Get(ctx)
			if err != nil {
				return nil, err
			}
			skip = skip && hashToken(cfg.SecretKey, cmd.UnHashedToken) == token.AuthToken
		}

		if skip {
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

	res, err, _ := s.singleflight.Do(singleflightKey, func() (any, error) {
		dbHelper, err := s.sql(ctx)
		if err != nil {
			return nil, err
		}

		var token *auth.UserToken
		err = dbHelper.DB.InTransaction(ctx, func(ctx context.Context) error {
			var err error
			token, err = rotate(ctx)
			return err
		})
		return token, err
	})

	if err != nil {
		return nil, err
	}

	return res.(*auth.UserToken), nil
}

type rotateTokenQuery struct {
	sqltemplate.SQLTemplate
	TokenTable    string
	UserAgent     string
	ClientIP      string
	AuthToken     string
	AuthTokenSeen any
	RotatedAt     int64
	TokenID       int64
}

func (q rotateTokenQuery) Validate() error { return nil }

func (s *UserAuthTokenService) rotateToken(ctx context.Context, token *auth.UserToken, clientIP net.IP, userAgent string) (*auth.UserToken, error) {
	ctx, span := s.tracer.Start(ctx, "authtoken.rotateToken")
	defer span.End()

	var clientIPStr string
	if clientIP != nil {
		clientIPStr = clientIP.String()
	}

	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}

	newToken, hashedToken, err := generateAndHashToken(cfg.SecretKey)
	if err != nil {
		return nil, err
	}

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	now := getTime()
	query := rotateTokenQuery{
		SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
		TokenTable:    dbHelper.Table("user_auth_token"),
		UserAgent:     userAgent,
		ClientIP:      clientIPStr,
		AuthToken:     hashedToken,
		AuthTokenSeen: dbHelper.DB.GetDialect().BooleanValue(false),
		RotatedAt:     now.Unix(),
		TokenID:       token.Id,
	}
	rawSQL, err := sqltemplate.Execute(rotateTokenTemplate, query)
	if err != nil {
		return nil, err
	}

	var affected int64
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		res, err := dbSession.Exec(append([]any{rawSQL}, query.GetArgs()...)...)
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
			Where("user_id = ? AND created_at > ? AND rotated_at > ? AND revoked_at = 0",
				userId,
				s.createdAfterParam(cfg),
				s.rotatedAfterParam(cfg)).
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
	RotatedAfter int64
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
		RotatedAfter: s.rotatedAfterParam(cfg),
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

func (s *UserAuthTokenService) rotatedAfterParam(cfg *setting.Cfg) int64 {
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
