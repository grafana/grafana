package social

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	azureCacheKeyPrefix    = "azuread_oauth_jwks-"
	defaultCacheExpiration = 5 * time.Minute
)

func (s *SocialAzureAD) getJWKSCacheKey() (string, error) {
	return azureCacheKeyPrefix + s.ClientID, nil
}
func (s *SocialAzureAD) retrieveJWKSFromCache(ctx context.Context, client *http.Client, authURL string) (*keySetJWKS, time.Duration, error) {
	cacheKey, err := s.getJWKSCacheKey()
	if err != nil {
		return nil, 0, err
	}

	if val, err := s.cache.Get(ctx, cacheKey); err == nil {
		var jwks keySetJWKS
		err := json.Unmarshal(val, &jwks)
		s.log.Debug("Retrieved cached key set", "cacheKey", cacheKey)
		return &jwks, 0, err
	}
	s.log.Debug("Keyset not found in cache", "err", err)

	return &keySetJWKS{}, 0, nil
}

func (s *SocialAzureAD) cacheJWKS(ctx context.Context, jwks *keySetJWKS, cacheExpiration time.Duration) error {
	cacheKey, err := s.getJWKSCacheKey()
	if err != nil {
		return err
	}

	var jsonBuf bytes.Buffer
	if err := json.NewEncoder(&jsonBuf).Encode(jwks); err != nil {
		return err
	}

	if err := s.cache.Set(ctx, cacheKey, jsonBuf.Bytes(), cacheExpiration); err != nil {
		s.log.Warn("Failed to cache key set", "err", err)
	}

	return nil
}

func (s *SocialAzureAD) retrieveGeneralJWKS(ctx context.Context, client *http.Client, authURL string) (*keySetJWKS, time.Duration, error) {
	keysetURL := strings.Replace(authURL, "/oauth2/v2.0/authorize", "/discovery/v2.0/keys", 1)

	resp, err := s.httpGet(ctx, client, keysetURL)
	if err != nil {
		return nil, 0, err
	}

	bytesReader := bytes.NewReader(resp.Body)
	var jwks keySetJWKS
	if err := json.NewDecoder(bytesReader).Decode(&jwks); err != nil {
		return nil, 0, err
	}

	cacheExpiration := getCacheExpiration(resp.Headers.Get("cache-control"))
	s.log.Debug("Retrieved general key set", "url", keysetURL, "cacheExpiration", cacheExpiration)

	return &jwks, cacheExpiration, nil
}

func (s *SocialAzureAD) retrieveSpecificJWKS(ctx context.Context, client *http.Client, authURL string) (*keySetJWKS, time.Duration, error) {
	keysetURL := strings.Replace(authURL, "/oauth2/v2.0/authorize", "/discovery/v2.0/keys", 1) + "?appid=" + s.ClientID

	resp, err := s.httpGet(ctx, client, keysetURL)
	if err != nil {
		return nil, 0, err
	}

	bytesReader := bytes.NewReader(resp.Body)
	var jwks keySetJWKS
	if err := json.NewDecoder(bytesReader).Decode(&jwks); err != nil {
		return nil, 0, err
	}

	cacheExpiration := getCacheExpiration(resp.Headers.Get("cache-control"))
	s.log.Debug("Retrieved specific key set", "url", keysetURL, "cacheExpiration", cacheExpiration)

	return &jwks, cacheExpiration, nil
}

func getCacheExpiration(header string) time.Duration {
	if header == "" {
		return defaultCacheExpiration
	}

	// Cache-Control: public, max-age=14400
	cacheControl := strings.Split(header, ",")
	for _, v := range cacheControl {
		if strings.Contains(v, "max-age") {
			parts := strings.Split(v, "=")
			if len(parts) == 2 {
				seconds, err := strconv.Atoi(parts[1])
				if err != nil {
					return defaultCacheExpiration
				}
				return time.Duration(seconds) * time.Second
			}
		}
	}

	return defaultCacheExpiration
}
