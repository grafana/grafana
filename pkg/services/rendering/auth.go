package rendering

import (
	"bytes"
	"context"
	"encoding/gob"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/util"
)

const renderKeyPrefix = "render-%s"

type RenderUser struct {
	OrgID   int64  `json:"org_id"`
	UserID  int64  `json:"user_id"`
	OrgRole string `json:"org_role"`
}

func (rs *RenderingService) GetRenderUser(ctx context.Context, key string) (*RenderUser, bool) {
	val, err := rs.RemoteCacheService.Get(ctx, fmt.Sprintf(renderKeyPrefix, key))
	if err != nil {
		rs.log.Error("Failed to get render key from cache", "error", err)
	}
	ru := &RenderUser{}
	buf := bytes.NewBuffer(val)
	err = gob.NewDecoder(buf).Decode(&ru)
	if err != nil {
		return nil, false
	}

	return ru, true
}

func setRenderKey(cache *remotecache.RemoteCache, ctx context.Context, opts AuthOpts, renderKey string, expiry time.Duration) error {
	buf := bytes.NewBuffer(nil)
	err := gob.NewEncoder(buf).Encode(&RenderUser{
		OrgID:   opts.OrgID,
		UserID:  opts.UserID,
		OrgRole: string(opts.OrgRole),
	})
	if err != nil {
		return err
	}

	return cache.Set(ctx, fmt.Sprintf(renderKeyPrefix, renderKey), buf.Bytes(), expiry)
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
