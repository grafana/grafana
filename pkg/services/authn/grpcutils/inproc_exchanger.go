package grpcutils

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"golang.org/x/sync/singleflight"
)

var (
	timeNow = time.Now
)

const (
	tokenLifetime       = 5 * time.Minute
	inProcTokenCacheKey = "in-proc-access-token" // #nosec G101 not a hardcoded credential
)

type inProcExchanger struct {
	cache   *localcache.CacheService
	singlef singleflight.Group
}

func ProvideInProcExchanger() *inProcExchanger {
	return &inProcExchanger{
		cache:   localcache.New(5*time.Minute, 5*time.Minute),
		singlef: singleflight.Group{},
	}
}

func (e *inProcExchanger) Exchange(ctx context.Context, r authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	tokenData, ok := e.cache.Get(inProcTokenCacheKey)

	if ok {
		return &authn.TokenExchangeResponse{Token: tokenData.(string)}, nil
	}

	resp, err, _ := e.singlef.Do(inProcTokenCacheKey, func() (interface{}, error) {
		now := timeNow()
		tokenExpiration := now.Add(tokenLifetime)
		claims := authn.Claims[authn.AccessTokenClaims]{
			Claims: jwt.Claims{
				Audience:  []string{"resourceStore"},
				Expiry:    jwt.NewNumericDate(tokenExpiration),
				IssuedAt:  jwt.NewNumericDate(now),
				Issuer:    "grafana",
				Subject:   claims.NewTypeID(claims.TypeAccessPolicy, "1"),
				NotBefore: jwt.NewNumericDate(now),
			},
			Rest: authn.AccessTokenClaims{
				Namespace:            "*",
				Permissions:          []string{"folder.grafana.app:*", "dashboard.grafana.app:*"},
				DelegatedPermissions: []string{"folder.grafana.app:*", "dashboard.grafana.app:*"},
			},
		}

		header, err := json.Marshal(map[string]string{
			"alg": "none",
			"typ": authn.TokenTypeAccess,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: %w", authn.ErrInvalidExchangeResponse, err)
		}

		payload, err := json.Marshal(claims)
		if err != nil {
			return nil, fmt.Errorf("%w: %w", authn.ErrInvalidExchangeResponse, err)
		}

		token := fmt.Sprintf("%s.%s.", base64.RawURLEncoding.EncodeToString(header), base64.RawURLEncoding.EncodeToString(payload))

		response := &authn.TokenExchangeResponse{
			Token: token,
		}

		e.cache.Set(inProcTokenCacheKey, token, time.Until(tokenExpiration))
		return response, nil
	})
	return resp.(*authn.TokenExchangeResponse), err
}
