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
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/util"
)

const renderKeyPrefix = "render-%s"

type RenderUser struct {
	OrgID     int64  `json:"org_id"`
	UserID    int64  `json:"user_id"`
	OrgRole   string `json:"org_role"`
	Namespace string `json:"namespace"` // only used for validation
}

type renderJWT struct {
	RenderUser *RenderUser
	jwt.RegisteredClaims
}

func (rs *RenderingService) GetRenderUser(ctx context.Context, key string, orgID int64) (*RenderUser, bool) {
	if rs.perRequestRenderKeyProvider == nil {
		// Rendering is not configured. Just reject the token; it has no reasonable use here.
		return nil, false
	}

	var from string
	start := time.Now()

	renderUser, found := rs.perRequestRenderKeyProvider.validate(ctx, key, orgID)
	success := strconv.FormatBool(found)
	metrics.MRenderingUserLookupSummary.WithLabelValues(success, from).Observe(float64(time.Since(start)))

	return renderUser, found
}

func setRenderKey(cache *remotecache.RemoteCache, ctx context.Context, opts AuthOpts, renderKey string, expiry time.Duration, ns request.NamespaceMapper) error {
	buf := bytes.NewBuffer(nil)
	err := gob.NewEncoder(buf).Encode(&RenderUser{
		OrgID:     opts.OrgID,
		UserID:    opts.UserID,
		OrgRole:   string(opts.OrgRole),
		Namespace: ns(opts.OrgID),
	})
	if err != nil {
		return err
	}

	return cache.Set(ctx, fmt.Sprintf(renderKeyPrefix, renderKey), buf.Bytes(), expiry)
}

func generateAndSetRenderKey(cache *remotecache.RemoteCache, ctx context.Context, opts AuthOpts, expiry time.Duration, ns request.NamespaceMapper) (string, error) {
	key, err := util.GetRandomString(32)
	if err != nil {
		return "", err
	}

	err = setRenderKey(cache, ctx, opts, key, expiry, ns)
	if err != nil {
		return "", err
	}

	return key, nil
}

func deleteRenderKey(cache *remotecache.RemoteCache, log log.Logger, ctx context.Context, renderKey string) {
	err := cache.Delete(ctx, fmt.Sprintf(renderKeyPrefix, renderKey))
	if err != nil {
		log.Error("Failed to delete render key", "error", err)
	}
}

type perRequestRenderKeyProvider struct {
	cache      *remotecache.RemoteCache
	log        log.Logger
	keyExpiry  time.Duration
	namespacer request.NamespaceMapper
}

func (r *perRequestRenderKeyProvider) get(ctx context.Context, opts AuthOpts) (string, error) {
	return generateAndSetRenderKey(r.cache, ctx, opts, r.keyExpiry, r.namespacer)
}

func (r *perRequestRenderKeyProvider) afterRequest(ctx context.Context, _ AuthOpts, renderKey string) {
	deleteRenderKey(r.cache, r.log, ctx, renderKey)
}

func (r *perRequestRenderKeyProvider) validate(ctx context.Context, key string, orgID int64) (*RenderUser, bool) {
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
	if ru == nil {
		return nil, false
	}

	// Public asset requests carry the render cookie without an org ID.
	if orgID == 0 {
		orgID = ru.OrgID
	}

	namespace := r.namespacer(orgID)
	if !types.NamespaceMatches(ru.Namespace, namespace) {
		r.log.Error("Render user namespace does not match request namespace", "renderUserNamespace", ru.Namespace, "requestNamespace", namespace)
		return nil, false
	}

	return ru, true
}

type jwtRenderKeyProvider struct {
	log        log.Logger
	authToken  []byte
	keyExpiry  time.Duration
	namespacer request.NamespaceMapper
}

func (j *jwtRenderKeyProvider) get(_ context.Context, opts AuthOpts) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, j.buildJWTClaims(opts))
	return token.SignedString(j.authToken)
}

func (j *jwtRenderKeyProvider) buildJWTClaims(opts AuthOpts) renderJWT {
	return renderJWT{
		RenderUser: &RenderUser{
			OrgID:     opts.OrgID,
			UserID:    opts.UserID,
			OrgRole:   string(opts.OrgRole),
			Namespace: j.namespacer(opts.OrgID),
		},
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(j.keyExpiry)),
		},
	}
}

func (j *jwtRenderKeyProvider) afterRequest(_ context.Context, _ AuthOpts, _ string) {
	// do nothing - the JWT will just expire
}

func (j *jwtRenderKeyProvider) validate(_ context.Context, key string, orgID int64) (*RenderUser, bool) {
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
	if claims.RenderUser == nil {
		return nil, false
	}

	// Public asset requests carry the render cookie without an org ID.
	if orgID == 0 {
		orgID = claims.RenderUser.OrgID
	}

	namespace := j.namespacer(orgID)
	if !types.NamespaceMatches(claims.RenderUser.Namespace, namespace) {
		j.log.Error("Render user namespace does not match request namespace", "renderUserNamespace", claims.RenderUser.Namespace, "requestNamespace", namespace)
		return nil, false
	}

	return claims.RenderUser, true
}

func looksLikeJWT(key string) bool {
	return strings.HasPrefix(key, "eyJ")
}
