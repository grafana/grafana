package rendering

import (
	"bytes"
	"context"
	"encoding/gob"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/util"
)

const renderKeyPrefix = "render-%s"

type RenderUser struct {
	OrgID   int64  `json:"org_id"`
	UserID  int64  `json:"user_id"`
	OrgRole string `json:"org_role"`
}

type renderJWT struct {
	RenderUser *RenderUser
	jwt.RegisteredClaims
}

func (rs *RenderingService) GetRenderUser(ctx context.Context, key string) (*RenderUser, bool) {
	if rs.keys == nil {
		// Rendering is not configured. Just reject the token; it has no reasonable use here.
		return nil, false
	}

	var from string
	start := time.Now()

	renderUser, found := rs.keys.Validate(ctx, key)
	success := strconv.FormatBool(found)
	metrics.MRenderingUserLookupSummary.WithLabelValues(success, from).Observe(float64(time.Since(start)))

	return renderUser, found
}

func setRenderKey(cache remotecache.CacheStorage, ctx context.Context, opts AuthOpts, renderKey string, expiry time.Duration) error {
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

func generateAndSetRenderKey(cache remotecache.CacheStorage, ctx context.Context, opts AuthOpts, expiry time.Duration) (string, error) {
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

func deleteRenderKey(cache remotecache.CacheStorage, log log.Logger, ctx context.Context, renderKey string) {
	err := cache.Delete(ctx, fmt.Sprintf(renderKeyPrefix, renderKey))
	if err != nil {
		log.Error("Failed to delete render key", "error", err)
	}
}

type perRequestRenderKeyProvider struct {
	cache     remotecache.CacheStorage
	log       log.Logger
	keyExpiry time.Duration
}

func (r *perRequestRenderKeyProvider) Get(ctx context.Context, opts AuthOpts) (RenderCredentials, error) {
	key, err := generateAndSetRenderKey(r.cache, ctx, opts, r.keyExpiry)
	return RenderCredentials{Key: key}, err
}

func (r *perRequestRenderKeyProvider) Release(ctx context.Context, credentials RenderCredentials) {
	deleteRenderKey(r.cache, r.log, ctx, credentials.Key)
}

func (r *perRequestRenderKeyProvider) Validate(ctx context.Context, key string) (*RenderUser, bool) {
	val, err := r.cache.Get(ctx, fmt.Sprintf(renderKeyPrefix, key))
	if err != nil {
		r.log.Error("Could not get render user from remote cache", "err", err)
		return nil, false
	}

	ru := new(RenderUser)
	buf := bytes.NewBuffer(val)

	err = gob.NewDecoder(buf).Decode(&ru)
	if err != nil {
		r.log.Error("Could not decode render user from remote cache", "err", err)
		return nil, false
	}

	return ru, ru != nil
}

type jwtRenderKeyProvider struct {
	log       log.Logger
	authToken []byte
	keyExpiry time.Duration
}

func (j *jwtRenderKeyProvider) Get(_ context.Context, opts AuthOpts) (RenderCredentials, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, j.buildJWTClaims(opts))
	key, err := token.SignedString(j.authToken)
	return RenderCredentials{Key: key}, err
}

func (j *jwtRenderKeyProvider) buildJWTClaims(opts AuthOpts) renderJWT {
	return renderJWT{
		RenderUser: &RenderUser{
			OrgID:   opts.OrgID,
			UserID:  opts.UserID,
			OrgRole: string(opts.OrgRole),
		},
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(j.keyExpiry)),
		},
	}
}

func (j *jwtRenderKeyProvider) Release(_ context.Context, _ RenderCredentials) {
	// do nothing - the JWT will just expire
}

func (j *jwtRenderKeyProvider) Validate(_ context.Context, key string) (*RenderUser, bool) {
	if !looksLikeJWT(key) {
		return nil, false
	}

	claims := new(renderJWT)
	tkn, err := jwt.ParseWithClaims(key, claims, func(_ *jwt.Token) (any, error) {
		return j.authToken, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS512.Alg()}))

	if err != nil || !tkn.Valid {
		j.log.Error("Could not get render user from JWT", "err", err)
		return nil, false
	}

	return claims.RenderUser, claims.RenderUser != nil
}

func looksLikeJWT(key string) bool {
	return strings.HasPrefix(key, "eyJ")
}
