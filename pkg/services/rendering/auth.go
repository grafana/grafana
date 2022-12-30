package rendering

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
)

const renderKeyPrefix = "render-%s"

type RenderUser struct {
	OrgID   int64
	UserID  int64
	OrgRole string
}

type renderJWT struct {
	RenderUser *RenderUser
	jwt.RegisteredClaims
}

func (rs *RenderingService) GetRenderUser(ctx context.Context, key string) (*RenderUser, bool) {
	var (
		from   string
		exists bool
		err    error
		start  = time.Now()
	)

	defer func() {
		success := strconv.FormatBool(err == nil && exists)
		metrics.MRenderingUserLookupSummary.WithLabelValues(success, from).Observe(float64(time.Since(start)))
	}()

	if looksLikeJWT(key) && rs.features.IsEnabled(featuremgmt.FlagRenderingOverJWT) {
		from = "jwt"
		claims := new(renderJWT)
		var tkn *jwt.Token
		tkn, err = jwt.ParseWithClaims(key, claims, func(_ *jwt.Token) (interface{}, error) {
			return []byte(rs.Cfg.RendererAuthToken), nil
		})

		if err != nil || !tkn.Valid {
			rs.log.Error("Could not get render user from JWT", "err", err)
			return nil, exists
		}

		exists = true
		return claims.RenderUser, exists
	}

	from = "cache"
	var val interface{}
	val, err = rs.RemoteCacheService.Get(ctx, fmt.Sprintf(renderKeyPrefix, key))
	if err != nil {
		rs.log.Error("Failed to get render key from cache", "error", err)
	}

	if val != nil {
		if user, ok := val.(*RenderUser); ok {
			exists = true
			return user, exists
		}
	}

	return nil, false
}

func setRenderKey(cache *remotecache.RemoteCache, ctx context.Context, opts AuthOpts, renderKey string, expiry time.Duration) error {
	err := cache.Set(ctx, fmt.Sprintf(renderKeyPrefix, renderKey), &RenderUser{
		OrgID:   opts.OrgID,
		UserID:  opts.UserID,
		OrgRole: string(opts.OrgRole),
	}, expiry)
	return err
}

func generateAndSetRenderKey(cache *remotecache.RemoteCache, ctx context.Context, opts AuthOpts, expiry time.Duration) (string, error) {
	key, err := util.GetRandomString(32)
	if err != nil {
		return "", err
	}

	err = setRenderKey(cache, ctx, opts, key, expiry)
	if err != nil {
		return "", err
	}

	return key, nil
}

type longLivedRenderKeyProvider struct {
	cache       *remotecache.RemoteCache
	log         log.Logger
	renderKey   string
	authOpts    AuthOpts
	sessionOpts SessionOpts
}

func (rs *RenderingService) CreateRenderingSession(ctx context.Context, opts AuthOpts, sessionOpts SessionOpts) (Session, error) {
	renderKey, err := generateAndSetRenderKey(rs.RemoteCacheService, ctx, opts, sessionOpts.Expiry)
	if err != nil {
		return nil, err
	}

	return &longLivedRenderKeyProvider{
		log:         rs.log,
		renderKey:   renderKey,
		cache:       rs.RemoteCacheService,
		authOpts:    opts,
		sessionOpts: sessionOpts,
	}, nil
}

func deleteRenderKey(cache *remotecache.RemoteCache, log log.Logger, ctx context.Context, renderKey string) {
	err := cache.Delete(ctx, fmt.Sprintf(renderKeyPrefix, renderKey))
	if err != nil {
		log.Error("Failed to delete render key", "error", err)
	}
}

type perRequestRenderKeyProvider struct {
	cache     *remotecache.RemoteCache
	log       log.Logger
	keyExpiry time.Duration
}

func (r *perRequestRenderKeyProvider) get(ctx context.Context, opts AuthOpts) (string, error) {
	return generateAndSetRenderKey(r.cache, ctx, opts, r.keyExpiry)
}

func (r *perRequestRenderKeyProvider) afterRequest(ctx context.Context, opts AuthOpts, renderKey string) {
	deleteRenderKey(r.cache, r.log, ctx, renderKey)
}

func (r *longLivedRenderKeyProvider) get(ctx context.Context, opts AuthOpts) (string, error) {
	if r.sessionOpts.RefreshExpiryOnEachRequest {
		err := setRenderKey(r.cache, ctx, opts, r.renderKey, r.sessionOpts.Expiry)
		if err != nil {
			r.log.Error("Failed to refresh render key", "error", err, "renderKey", r.renderKey)
		}
	}
	return r.renderKey, nil
}

func (r *longLivedRenderKeyProvider) afterRequest(ctx context.Context, opts AuthOpts, renderKey string) {
	// do nothing - renderKey from longLivedRenderKeyProvider is deleted only after session expires
	// or someone calls session.Dispose()
}

func (r *longLivedRenderKeyProvider) Dispose(ctx context.Context) {
	deleteRenderKey(r.cache, r.log, ctx, r.renderKey)
}

type jwtRenderKeyProvider struct {
	log       log.Logger
	authToken []byte
	keyExpiry time.Duration
}

func (j *jwtRenderKeyProvider) get(_ context.Context, opts AuthOpts) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, j.buildJWTClaims(opts))

	signed, err := token.SignedString(j.authToken)
	if err != nil {
		return "", err
	}

	return signed, nil
}

func (j *jwtRenderKeyProvider) buildJWTClaims(opts AuthOpts) renderJWT {
	claims := renderJWT{
		RenderUser: &RenderUser{
			OrgID:   opts.OrgID,
			UserID:  opts.UserID,
			OrgRole: string(opts.OrgRole),
		},
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(j.keyExpiry)),
		},
	}
	return claims
}

func (j *jwtRenderKeyProvider) afterRequest(_ context.Context, _ AuthOpts, _ string) {
	// do nothing - the JWT will just expire
}

func looksLikeJWT(key string) bool {
	return strings.HasPrefix(key, "eyJ")
}
