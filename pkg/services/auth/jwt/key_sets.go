package jwt

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	jose "gopkg.in/square/go-jose.v2"
)

var ErrFailedToParsePemFile = errors.New("failed to parse pem-encoded file")
var ErrKeySetIsNotConfigured = errors.New("key set for jwt verification is not configured")
var ErrKeySetConfigurationAmbiguous = errors.New("key set configuration is ambiguous: you should set either key_file, jwk_set_file or jwk_set_url")
var ErrJWTSetURLMustHaveHTTPSScheme = errors.New("jwt_set_url must have https scheme")

type keySet interface {
	Key(ctx context.Context, kid string) ([]jose.JSONWebKey, error)
}

type keySetJWKS struct {
	jose.JSONWebKeySet
}

func (ks keySetJWKS) Key(ctx context.Context, keyID string) ([]jose.JSONWebKey, error) {
	return ks.JSONWebKeySet.Key(keyID), nil
}

type keySetHTTP struct {
	url             string
	log             log.Logger
	client          *http.Client
	cache           *remotecache.RemoteCache
	cacheKey        string
	cacheExpiration time.Duration
}

func (ks *keySetHTTP) getJWKS(ctx context.Context) (keySetJWKS, error) {
	var jwks keySetJWKS

	if ks.cacheExpiration > 0 {
		if val, err := ks.cache.Get(ctx, ks.cacheKey); err == nil {
			err := json.Unmarshal(val.([]byte), &jwks)
			return jwks, err
		}
	}

	ks.log.Debug("Getting key set from endpoint", "url", ks.url)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ks.url, nil)
	if err != nil {
		return jwks, err
	}

	resp, err := ks.client.Do(req)
	if err != nil {
		return jwks, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			ks.log.Warn("Failed to close response body", "err", err)
		}
	}()

	var jsonBuf bytes.Buffer
	if err := json.NewDecoder(io.TeeReader(resp.Body, &jsonBuf)).Decode(&jwks); err != nil {
		return jwks, err
	}

	if ks.cacheExpiration > 0 {
		err = ks.cache.Set(ctx, ks.cacheKey, jsonBuf.Bytes(), ks.cacheExpiration)
	}
	return jwks, err
}

func (ks keySetHTTP) Key(ctx context.Context, kid string) ([]jose.JSONWebKey, error) {
	jwks, err := ks.getJWKS(ctx)
	if err != nil {
		return nil, err
	}
	return jwks.Key(ctx, kid)
}
