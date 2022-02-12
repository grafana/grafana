package rendering

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
)

const renderKeyPrefix = "render-%s"

func (rs *RenderingService) GetRenderUser(ctx context.Context, key string) (*models.RenderUser, bool) {
	if rs.features.IsEnabled(featuremgmt.FlagRenderKeyPerUser) {
		return rs.getRenderUserPOC(ctx, key)
	}

	val, err := rs.RemoteCacheService.Get(ctx, fmt.Sprintf(renderKeyPrefix, key))
	if err != nil {
		rs.log.Error("Failed to get render key from cache", "error", err)
	}

	if val != nil {
		if user, ok := val.(*models.RenderUser); ok {
			return user, true
		}
	}

	return nil, false
}

func setRenderKey(cache *remotecache.RemoteCache, ctx context.Context, opts AuthOpts, renderKey string, expiry time.Duration) error {
	err := cache.Set(ctx, fmt.Sprintf(renderKeyPrefix, renderKey), &models.RenderUser{
		OrgID:   opts.OrgID,
		UserID:  opts.UserID,
		OrgRole: string(opts.OrgRole),
	}, expiry)
	return err
}

func generateRenderKey() (string, error) {
	return util.GetRandomString(32)
}

func generateAndSetRenderKey(cache *remotecache.RemoteCache, ctx context.Context, opts AuthOpts, expiry time.Duration) (string, error) {
	key, err := generateRenderKey()
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
