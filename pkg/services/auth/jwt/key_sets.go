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
var ErrPrivateKeyNotSupported = errors.New("private keys are not supported for JWT verification; configure the corresponding public key")

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

func checkKeySetConfiguration(settings setting.AuthJWTSettings) error {
	var count int
	if settings.KeyFile != "" {
		count++
	}
	if settings.KeyValue != "" {
		count++
	}
	if settings.JWKSetFile != "" {
		count++
	}
	if settings.JWKSetValue != "" {
		count++
	}
	if settings.JWKSetURL != "" {
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

// buildKeySet creates a provider for JWKSet from exactly one configured source:
// a PEM key or JWKS provided as a file or inline value, or a JWKS https endpoint.
// It reads only the passed settings and does not mutate the service, so apply
// can build the new key set before swapping state.
func (s *AuthService) buildKeySet(settings setting.AuthJWTSettings) (keySet, error) {
	if err := checkKeySetConfiguration(settings); err != nil {
		return nil, err
	}

	switch {
	case settings.KeyFile != "":
		data, err := s.readKeyFile(settings.KeyFile)
		if err != nil {
			return nil, err
		}
		return parsePEMPublicKey(data, settings.KeyID)
	case settings.KeyValue != "":
		data, err := decodeKeyValue(settings.KeyValue)
		if err != nil {
			return nil, err
		}
		return parsePEMPublicKey(data, settings.KeyID)
	case settings.JWKSetFile != "":
		data, err := s.readKeyFile(settings.JWKSetFile)
		if err != nil {
			return nil, err
		}
		return parseJWKS(data)
	case settings.JWKSetValue != "":
		data, err := decodeKeyValue(settings.JWKSetValue)
		if err != nil {
			return nil, err
		}
		return parseJWKS(data)
	case settings.JWKSetURL != "":
		return s.newHTTPKeySet(settings, settings.JWKSetURL)
	}

	return nil, nil
}

// newHTTPKeySet builds a key set that fetches a JWKS from an https endpoint.
// It reads only the passed settings so it can run before apply swaps state.
func (s *AuthService) newHTTPKeySet(settings setting.AuthJWTSettings, urlStr string) (*keySetHTTP, error) {
	urlParsed, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}
	if urlParsed.Scheme != "https" && s.Cfg.Env != setting.Dev {
		return nil, ErrJWTSetURLMustHaveHTTPSScheme
	}

	var caCertPool *x509.CertPool
	if settings.TlsClientCa != "" {
		s.log.Debug("reading ca from TlsClientCa path")
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `tlsClientCa` comes from grafana configuration file
		caCert, err := os.ReadFile(settings.TlsClientCa)
		if err != nil {
			s.log.Error("Failed to read TlsClientCa", "path", settings.TlsClientCa, "error", err)
			return nil, fmt.Errorf("failed to read TlsClientCa: %w", err)
		}

		caCertPool = x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			s.log.Error("failed to decode provided PEM certs", "path", settings.TlsClientCa)
			return nil, fmt.Errorf("failed to decode provided PEM certs file from TlsClientCa")
		}
	}

	// Read Bearer token from file during init
	if settings.JWKSetBearerTokenFile != "" {
		if _, err := getBearerToken(settings.JWKSetBearerTokenFile); err != nil {
			return nil, err
		}
	}

	return &keySetHTTP{
		url:             urlStr,
		log:             s.log,
		bearerTokenPath: settings.JWKSetBearerTokenFile,
		client: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					MinVersion:         tls.VersionTLS12,
					Renegotiation:      tls.RenegotiateFreelyAsClient,
					InsecureSkipVerify: settings.TlsSkipVerify,
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
		cacheExpiration: settings.CacheTTL,
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
	case "RSA PUBLIC KEY":
		if key, err = x509.ParsePKCS1PublicKey(block.Bytes); err != nil {
			return nil, err
		}
	case "PRIVATE KEY", "RSA PRIVATE KEY", "EC PRIVATE KEY":
		// JWT tokens are verified with the public key; a private key here is a
		// configuration mistake and is unusable anyway (go-jose rejects it at verify time).
		return nil, ErrPrivateKeyNotSupported
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
