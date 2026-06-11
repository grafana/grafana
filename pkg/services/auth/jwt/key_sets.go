package jwt

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	jose "github.com/go-jose/go-jose/v4"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/setting"
)

var ErrFailedToParsePemFile = errors.New("failed to parse pem-encoded file")
var ErrKeySetIsNotConfigured = errors.New("key set for jwt verification is not configured")
var ErrKeySetConfigurationAmbiguous = errors.New("key set configuration is ambiguous: you should set only one of key_file, key_value, jwk_set_file, jwk_set_value or jwk_set_url")
var ErrJWTSetURLMustHaveHTTPSScheme = errors.New("jwt_set_url must have https scheme")
var ErrFailedToDecodeKeyValue = errors.New("failed to base64-decode inline key value")

type keySet interface {
	Key(ctx context.Context, kid string) ([]jose.JSONWebKey, error)
}

type keySetJWKS struct {
	jose.JSONWebKeySet
}

type keySetHTTP struct {
	url             string
	log             log.Logger
	client          *http.Client
	bearerTokenPath string
	cache           *remotecache.RemoteCache
	cacheKey        string
	cacheExpiration time.Duration
}

func (s *AuthService) checkKeySetConfiguration() error {
	var count int
	if s.Cfg.JWTAuth.KeyFile != "" {
		count++
	}
	if s.Cfg.JWTAuth.KeyValue != "" {
		count++
	}
	if s.Cfg.JWTAuth.JWKSetFile != "" {
		count++
	}
	if s.Cfg.JWTAuth.JWKSetValue != "" {
		count++
	}
	if s.Cfg.JWTAuth.JWKSetURL != "" {
		count++
	}

	if count == 0 {
		return ErrKeySetIsNotConfigured
	}

	if count > 1 {
		return ErrKeySetConfigurationAmbiguous
	}

	return nil
}

// initKeySet creates a provider for JWKSet from exactly one configured source: a
// PEM key or JWKS provided as a file or inline value, or a JWKS https endpoint.
func (s *AuthService) initKeySet() error {
	if err := s.checkKeySetConfiguration(); err != nil {
		return err
	}

	switch {
	case s.Cfg.JWTAuth.KeyFile != "":
		data, err := s.readKeyFile(s.Cfg.JWTAuth.KeyFile)
		if err != nil {
			return err
		}
		s.keySet, err = parsePEMPublicKey(data, s.Cfg.JWTAuth.KeyID)
		return err
	case s.Cfg.JWTAuth.KeyValue != "":
		data, err := decodeKeyValue(s.Cfg.JWTAuth.KeyValue)
		if err != nil {
			return err
		}
		s.keySet, err = parsePEMPublicKey(data, s.Cfg.JWTAuth.KeyID)
		return err
	case s.Cfg.JWTAuth.JWKSetFile != "":
		data, err := s.readKeyFile(s.Cfg.JWTAuth.JWKSetFile)
		if err != nil {
			return err
		}
		s.keySet, err = parseJWKS(data)
		return err
	case s.Cfg.JWTAuth.JWKSetValue != "":
		data, err := decodeKeyValue(s.Cfg.JWTAuth.JWKSetValue)
		if err != nil {
			return err
		}
		s.keySet, err = parseJWKS(data)
		return err
	case s.Cfg.JWTAuth.JWKSetURL != "":
		keySet, err := s.newHTTPKeySet(s.Cfg.JWTAuth.JWKSetURL)
		if err != nil {
			return err
		}
		s.keySet = keySet
		return nil
	}

	return nil
}

// newHTTPKeySet builds a key set that fetches a JWKS from an https endpoint.
func (s *AuthService) newHTTPKeySet(urlStr string) (*keySetHTTP, error) {
	urlParsed, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}
	if urlParsed.Scheme != "https" && s.Cfg.Env != setting.Dev {
		return nil, ErrJWTSetURLMustHaveHTTPSScheme
	}

	var caCertPool *x509.CertPool
	if s.Cfg.JWTAuth.TlsClientCa != "" {
		s.log.Debug("reading ca from TlsClientCa path")
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `tlsClientCa` comes from grafana configuration file
		caCert, err := os.ReadFile(s.Cfg.JWTAuth.TlsClientCa)
		if err != nil {
			s.log.Error("Failed to read TlsClientCa", "path", s.Cfg.JWTAuth.TlsClientCa, "error", err)
			return nil, fmt.Errorf("failed to read TlsClientCa: %w", err)
		}

		caCertPool = x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			s.log.Error("failed to decode provided PEM certs", "path", s.Cfg.JWTAuth.TlsClientCa)
			return nil, fmt.Errorf("failed to decode provided PEM certs file from TlsClientCa")
		}
	}

	// Read Bearer token from file during init
	if s.Cfg.JWTAuth.JWKSetBearerTokenFile != "" {
		if _, err := getBearerToken(s.Cfg.JWTAuth.JWKSetBearerTokenFile); err != nil {
			return nil, err
		}
	}

	return &keySetHTTP{
		url:             urlStr,
		log:             s.log,
		bearerTokenPath: s.Cfg.JWTAuth.JWKSetBearerTokenFile,
		client: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					Renegotiation:      tls.RenegotiateFreelyAsClient,
					InsecureSkipVerify: s.Cfg.JWTAuth.TlsSkipVerify,
					RootCAs:            caCertPool,
				},
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   time.Second * 30,
					KeepAlive: 15 * time.Second,
				}).DialContext,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       30 * time.Second,
			},
			Timeout: time.Second * 30,
		},
		cacheKey:        fmt.Sprintf("auth-jwt:jwk-%s", urlStr),
		cacheExpiration: s.Cfg.JWTAuth.CacheTTL,
		cache:           s.RemoteCache,
	}, nil
}

// readKeyFile reads the full contents of a key file referenced from the grafana configuration.
func (s *AuthService) readKeyFile(path string) ([]byte, error) {
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `path` comes from grafana configuration file
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := file.Close(); err != nil {
			s.log.Warn("Failed to close file", "path", path, "err", err)
		}
	}()

	return io.ReadAll(file)
}

// decodeKeyValue base64-decodes an inline key value provided directly in the configuration.
func decodeKeyValue(value string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrFailedToDecodeKeyValue, err)
	}
	return data, nil
}

// parsePEMPublicKey parses a single PEM-encoded key and wraps it in a JWKS using the given key ID.
func parsePEMPublicKey(data []byte, keyID string) (*keySetJWKS, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, ErrFailedToParsePemFile
	}

	var key any
	var err error
	switch block.Type {
	case "PUBLIC KEY":
		if key, err = x509.ParsePKIXPublicKey(block.Bytes); err != nil {
			return nil, err
		}
	case "PRIVATE KEY":
		if key, err = x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
			return nil, err
		}
	case "RSA PUBLIC KEY":
		if key, err = x509.ParsePKCS1PublicKey(block.Bytes); err != nil {
			return nil, err
		}
	case "RSA PRIVATE KEY":
		if key, err = x509.ParsePKCS1PrivateKey(block.Bytes); err != nil {
			return nil, err
		}
	case "EC PRIVATE KEY":
		if key, err = x509.ParseECPrivateKey(block.Bytes); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unknown pem block type %q", block.Type)
	}

	return &keySetJWKS{
		jose.JSONWebKeySet{
			Keys: []jose.JSONWebKey{{Key: key, KeyID: keyID}},
		},
	}, nil
}

// parseJWKS parses a JWKS JSON document into a key set.
func parseJWKS(data []byte) (*keySetJWKS, error) {
	var jwks jose.JSONWebKeySet
	if err := json.Unmarshal(data, &jwks); err != nil {
		return nil, err
	}
	return &keySetJWKS{jwks}, nil
}

func (ks *keySetJWKS) Key(ctx context.Context, keyID string) ([]jose.JSONWebKey, error) {
	return ks.JSONWebKeySet.Key(keyID), nil
}

func getBearerToken(bearerTokenPath string) (string, error) {
	// nolint:gosec
	// We can ignore the gosec G304 warning as `bearerTokenPath` originates from grafana configuration file
	bytes, err := os.ReadFile(bearerTokenPath)
	if err != nil {
		return "", fmt.Errorf("failed to read JWKSetBearerTokenFile: %w", err)
	}

	t := strings.TrimSpace(string(bytes))
	if len(t) == 0 {
		return "", fmt.Errorf("empty file configured for JWKSetBearerTokenFile")
	}

	if strings.HasPrefix(t, "Bearer ") {
		return t, nil
	}

	// Prefix with Bearer if missing
	return fmt.Sprintf("Bearer %s", t), nil
}

func (ks *keySetHTTP) getJWKS(ctx context.Context) (keySetJWKS, error) {
	var jwks keySetJWKS

	if ks.cacheExpiration > 0 {
		if val, err := ks.cache.Get(ctx, ks.cacheKey); err == nil {
			err := json.Unmarshal(val, &jwks)
			if err != nil {
				ks.log.Warn("Failed to unmarshal key set from cache", "err", err)
			} else {
				return jwks, err
			}
		}
	}

	ks.log.Debug("Getting key set from endpoint", "url", ks.url)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ks.url, nil)
	if err != nil {
		return jwks, err
	}

	if ks.bearerTokenPath != "" {
		// Always read the token before fetching JWKS to handle potential key rotation (e.g. short-lived kubernetes ServiceAccount tokens)
		token, err := getBearerToken(ks.bearerTokenPath)
		if err != nil {
			return jwks, err
		}

		ks.log.Debug("adding Authorization header", "token_len", len(token))
		req.Header.Set("Authorization", token)
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
		cacheExpiration := ks.getCacheExpiration(resp.Header.Get("cache-control"))

		ks.log.Debug("Setting key set in cache", "url", ks.url,
			"cacheExpiration", cacheExpiration, "cacheControl", resp.Header.Get("cache-control"))
		err = ks.cache.Set(ctx, ks.cacheKey, jsonBuf.Bytes(), cacheExpiration)
	}
	return jwks, err
}

func (ks *keySetHTTP) getCacheExpiration(cacheControl string) time.Duration {
	cacheDuration := ks.cacheExpiration
	if cacheControl == "" {
		return cacheDuration
	}

	parts := strings.Split(cacheControl, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "max-age=") {
			maxAge, err := strconv.Atoi(part[8:])
			if err != nil {
				return cacheDuration
			}

			// If the cache duration is 0 or the max-age is less than the cache duration, use the max-age
			if cacheDuration == 0 || time.Duration(maxAge)*time.Second < cacheDuration {
				return time.Duration(maxAge) * time.Second
			}
		}
	}

	return cacheDuration
}

func (ks keySetHTTP) Key(ctx context.Context, kid string) ([]jose.JSONWebKey, error) {
	jwks, err := ks.getJWKS(ctx)
	if err != nil {
		return nil, err
	}
	return jwks.Key(ctx, kid)
}
