package jwt

import (
	"context"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

type scenarioContext struct {
	ctx        context.Context
	cfg        *setting.Cfg
	authJWTSvc *AuthService
}

type cachingScenarioContext struct {
	scenarioContext
	reqCount *int
}

type configureFunc func(*testing.T, *setting.Cfg)
type scenarioFunc func(*testing.T, scenarioContext)
type cachingScenarioFunc func(*testing.T, cachingScenarioContext)

const subject = "foo-subj"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestVerifyUsingPKIXPublicKeyFile(t *testing.T) {
	key := rsaKeys[0]
	unknownKey := rsaKeys[1]

	scenario(t, "verifies a token", func(t *testing.T, sc scenarioContext) {
		token := sign(t, key, jwt.Claims{
			Subject: subject,
		}, nil)
		verifiedClaims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		assert.Equal(t, verifiedClaims["sub"], subject)
	}, configurePKIXPublicKeyFile)

	scenario(t, "rejects a token signed by unknown key", func(t *testing.T, sc scenarioContext) {
		token := sign(t, unknownKey, jwt.Claims{
			Subject: subject,
		}, nil)
		_, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	}, configurePKIXPublicKeyFile)

	publicKeyID := "some-key-id"
	scenario(t, "verifies a token with a specified kid", func(t *testing.T, sc scenarioContext) {
		token := sign(t, key, jwt.Claims{
			Subject: subject,
		}, (&jose.SignerOptions{}).WithHeader("kid", publicKeyID))
		verifiedClaims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		assert.Equal(t, verifiedClaims["sub"], subject)
	}, configurePKIXPublicKeyFile, func(t *testing.T, cfg *setting.Cfg) {
		t.Helper()
		cfg.JWTAuth.KeyID = publicKeyID
	})
}

func TestVerifyUsingJWKSetFile(t *testing.T) {
	configure := func(t *testing.T, cfg *setting.Cfg) {
		t.Helper()

		file, err := os.CreateTemp(os.TempDir(), "jwk-*.json")
		require.NoError(t, err)
		t.Cleanup(func() {
			if err := os.Remove(file.Name()); err != nil {
				panic(err)
			}
		})

		require.NoError(t, json.NewEncoder(file).Encode(jwksPublic))
		require.NoError(t, file.Close())

		cfg.JWTAuth.JWKSetFile = file.Name()
	}

	scenario(t, "verifies a token signed with a key from the set", func(t *testing.T, sc scenarioContext) {
		token := sign(t, &jwKeys[0], jwt.Claims{Subject: subject}, nil)
		verifiedClaims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		assert.Equal(t, verifiedClaims["sub"], subject)
	}, configure)

	scenario(t, "verifies a token signed with another key from the set", func(t *testing.T, sc scenarioContext) {
		token := sign(t, &jwKeys[1], jwt.Claims{Subject: subject}, nil)
		verifiedClaims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		assert.Equal(t, verifiedClaims["sub"], subject)
	}, configure)

	scenario(t, "rejects a token signed with a key not from the set", func(t *testing.T, sc scenarioContext) {
		token := sign(t, jwKeys[2], jwt.Claims{Subject: subject}, nil)
		_, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	}, configure)
}

func TestVerifyUsingJWKSetURL(t *testing.T) {
	t.Run("should refuse to start with non-https URL", func(t *testing.T) {
		var err error

		_, err = initAuthService(t, func(t *testing.T, cfg *setting.Cfg) {
			cfg.JWTAuth.JWKSetURL = "https://example.com/.well-known/jwks.json"
		})
		require.NoError(t, err)

		_, err = initAuthService(t, func(t *testing.T, cfg *setting.Cfg) {
			cfg.JWTAuth.JWKSetURL = "http://example.com/.well-known/jwks.json"
		})
		require.NoError(t, err)

		_, err = initAuthService(t, func(t *testing.T, cfg *setting.Cfg) {
			cfg.Env = setting.Prod
			cfg.JWTAuth.JWKSetURL = "http://example.com/.well-known/jwks.json"
		})
		require.Error(t, err)
	})

	jwkHTTPScenario(t, "verifies a token signed with a key from the set", func(t *testing.T, sc scenarioContext) {
		token := sign(t, &jwKeys[0], jwt.Claims{Subject: subject}, nil)
		verifiedClaims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		assert.Equal(t, verifiedClaims["sub"], subject)
	})

	jwkHTTPScenario(t, "verifies a token signed with another key from the set", func(t *testing.T, sc scenarioContext) {
		token := sign(t, &jwKeys[1], jwt.Claims{Subject: subject}, nil)
		verifiedClaims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		assert.Equal(t, verifiedClaims["sub"], subject)
	})

	jwkHTTPScenario(t, "rejects a token signed with a key not from the set", func(t *testing.T, sc scenarioContext) {
		token := sign(t, jwKeys[2], jwt.Claims{Subject: subject}, nil)
		_, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	})
}

func TestCachingJWKHTTPResponse(t *testing.T) {
	jwkCachingScenario(t, "caches the jwk response", func(t *testing.T, sc cachingScenarioContext) {
		for i := 0; i < 5; i++ {
			token := sign(t, &jwKeys[0], jwt.Claims{Subject: subject}, nil)
			_, err := sc.authJWTSvc.Verify(sc.ctx, token)
			require.NoError(t, err, "verify call %d", i+1)
		}

		assert.Equal(t, 1, *sc.reqCount)
	})

	jwkCachingScenario(t, "respects TTL setting (while cached)", func(t *testing.T, sc cachingScenarioContext) {
		var err error

		token0 := sign(t, &jwKeys[0], jwt.Claims{Subject: subject}, nil)
		token1 := sign(t, &jwKeys[1], jwt.Claims{Subject: subject}, nil)

		_, err = sc.authJWTSvc.Verify(sc.ctx, token0)
		require.NoError(t, err)
		_, err = sc.authJWTSvc.Verify(sc.ctx, token1)
		require.Error(t, err)

		assert.Equal(t, 1, *sc.reqCount)
	}, func(t *testing.T, cfg *setting.Cfg) {
		// Arbitrary high value, several times what the test should take.
		cfg.JWTAuth.CacheTTL = time.Minute
	})

	jwkCachingScenario(t, "does not cache the response when TTL is zero", func(t *testing.T, sc cachingScenarioContext) {
		for i := 0; i < 2; i++ {
			_, err := sc.authJWTSvc.Verify(sc.ctx, sign(t, &jwKeys[i], jwt.Claims{Subject: subject}, nil))
			require.NoError(t, err, "verify call %d", i+1)
		}

		assert.Equal(t, 2, *sc.reqCount)
	}, func(t *testing.T, cfg *setting.Cfg) {
		cfg.JWTAuth.CacheTTL = 0
	})
}

func TestSignatureWithNoneAlgorithm(t *testing.T) {
	scenario(t, "rejects a token signed with \"none\" algorithm", func(t *testing.T, sc scenarioContext) {
		token := signNone(t, jwt.Claims{Subject: "foo"})
		_, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	}, configurePKIXPublicKeyFile)
}

func TestClaimValidation(t *testing.T) {
	key := rsaKeys[0]

	scenario(t, "validates iss field for equality", func(t *testing.T, sc scenarioContext) {
		tokenValid := sign(t, key, jwt.Claims{Issuer: "http://foo"}, nil)
		tokenInvalid := sign(t, key, jwt.Claims{Issuer: "http://bar"}, nil)

		_, err := sc.authJWTSvc.Verify(sc.ctx, tokenValid)
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, tokenInvalid)
		require.Error(t, err)
	}, configurePKIXPublicKeyFile, func(t *testing.T, cfg *setting.Cfg) {
		cfg.JWTAuth.ExpectClaims = `{"iss": "http://foo"}`
	})

	scenario(t, "validates sub field for equality", func(t *testing.T, sc scenarioContext) {
		var err error

		tokenValid := sign(t, key, jwt.Claims{Subject: "foo"}, nil)
		tokenInvalid := sign(t, key, jwt.Claims{Subject: "bar"}, nil)

		_, err = sc.authJWTSvc.Verify(sc.ctx, tokenValid)
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, tokenInvalid)
		require.Error(t, err)
	}, configurePKIXPublicKeyFile, func(t *testing.T, cfg *setting.Cfg) {
		cfg.JWTAuth.ExpectClaims = `{"sub": "foo"}`
	})

	scenario(t, "validates aud field for inclusion", func(t *testing.T, sc scenarioContext) {
		var err error

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{Audience: []string{"bar", "foo"}}, nil))
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{Audience: []string{"foo", "bar", "baz"}}, nil))
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{Audience: []string{"foo"}}, nil))
		require.Error(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{Audience: []string{"bar", "baz"}}, nil))
		require.Error(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{Audience: []string{"baz"}}, nil))
		require.Error(t, err)
	}, configurePKIXPublicKeyFile, func(t *testing.T, cfg *setting.Cfg) {
		cfg.JWTAuth.ExpectClaims = `{"aud": ["foo", "bar"]}`
	})

	scenario(t, "validates non-registered (custom) claims for equality", func(t *testing.T, sc scenarioContext) {
		var err error

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, map[string]any{"my-str": "foo", "my-number": 123}, nil))
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, map[string]any{"my-str": "bar", "my-number": 123}, nil))
		require.Error(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, map[string]any{"my-str": "foo", "my-number": 100}, nil))
		require.Error(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, map[string]any{"my-str": "foo"}, nil))
		require.Error(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, map[string]any{"my-number": 123}, nil))
		require.Error(t, err)
	}, configurePKIXPublicKeyFile, func(t *testing.T, cfg *setting.Cfg) {
		cfg.JWTAuth.ExpectClaims = `{"my-str": "foo", "my-number": 123}`
	})

	scenario(t, "validates exp claim of the token", func(t *testing.T, sc scenarioContext) {
		var err error

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}, nil))
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{Expiry: jwt.NewNumericDate(time.Now().Add(-time.Hour))}, nil))
		require.Error(t, err)
	}, configurePKIXPublicKeyFile)

	scenario(t, "validates nbf claim of the token", func(t *testing.T, sc scenarioContext) {
		var err error

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{NotBefore: jwt.NewNumericDate(time.Now().Add(-time.Hour))}, nil))
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{NotBefore: jwt.NewNumericDate(time.Now().Add(time.Hour))}, nil))
		require.Error(t, err)
	}, configurePKIXPublicKeyFile)

	scenario(t, "validates iat claim of the token", func(t *testing.T, sc scenarioContext) {
		var err error

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{IssuedAt: jwt.NewNumericDate(time.Now().Add(-time.Hour))}, nil))
		require.NoError(t, err)

		_, err = sc.authJWTSvc.Verify(sc.ctx, sign(t, key, jwt.Claims{IssuedAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}, nil))
		require.Error(t, err)
	}, configurePKIXPublicKeyFile)
}

func jwkHTTPScenario(t *testing.T, desc string, fn scenarioFunc, cbs ...configureFunc) {
	t.Helper()
	t.Run(desc, func(t *testing.T) {
		ts := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := json.NewEncoder(w).Encode(jwksPublic); err != nil {
				panic(err)
			}
		}))
		t.Cleanup(ts.Close)

		configure := func(t *testing.T, cfg *setting.Cfg) {
			cfg.JWTAuth.JWKSetURL = ts.URL
		}
		runner := scenarioRunner(func(t *testing.T, sc scenarioContext) {
			keySet := sc.authJWTSvc.keySet.(*keySetHTTP)
			keySet.client = ts.Client()
			fn(t, sc)
		}, append([]configureFunc{configure}, cbs...)...)
		runner(t)
	})
}

func jwkCachingScenario(t *testing.T, desc string, fn cachingScenarioFunc, cbs ...configureFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		var reqCount int

		// We run a server that each call responds differently.
		ts := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if reqCount++; reqCount > 2 {
				panic("calling more than two times is not supported")
			}
			jwks := jose.JSONWebKeySet{
				Keys: []jose.JSONWebKey{jwksPublic.Keys[reqCount-1]},
			}
			if err := json.NewEncoder(w).Encode(jwks); err != nil {
				panic(err)
			}
		}))
		t.Cleanup(ts.Close)

		configure := func(t *testing.T, cfg *setting.Cfg) {
			cfg.JWTAuth.JWKSetURL = ts.URL
			cfg.JWTAuth.CacheTTL = time.Hour
		}
		runner := scenarioRunner(func(t *testing.T, sc scenarioContext) {
			keySet := sc.authJWTSvc.keySet.(*keySetHTTP)
			keySet.client = ts.Client()
			fn(t, cachingScenarioContext{scenarioContext: sc, reqCount: &reqCount})
		}, append([]configureFunc{configure}, cbs...)...)

		runner(t)
	})
}

func TestBase64Paddings(t *testing.T) {
	key := rsaKeys[0]

	scenario(t, "verifies a token with base64 padding (non compliant rfc7515#section-2 but accepted)", func(t *testing.T, sc scenarioContext) {
		token := sign(t, key, jwt.Claims{
			Subject: subject,
		}, nil)
		var tokenParts []string
		for i, part := range strings.Split(token, ".") {
			// Create parts with different padding numbers to test multiple cases.
			tokenParts = append(tokenParts, part+strings.Repeat(string(base64.StdPadding), i))
		}
		token = strings.Join(tokenParts, ".")
		verifiedClaims, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
		assert.Equal(t, verifiedClaims["sub"], subject)
	}, configurePKIXPublicKeyFile)
}

func scenario(t *testing.T, desc string, fn scenarioFunc, cbs ...configureFunc) {
	t.Helper()

	t.Run(desc, scenarioRunner(fn, cbs...))
}

func initAuthService(t *testing.T, cbs ...configureFunc) (*AuthService, error) {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.JWTAuth.Enabled = true
	cfg.JWTAuth.ExpectClaims = "{}"

	for _, cb := range cbs {
		cb(t, cfg)
	}

	service := newService(cfg, remotecache.NewFakeStore(t))
	err := service.init()
	return service, err
}

func scenarioRunner(fn scenarioFunc, cbs ...configureFunc) func(t *testing.T) {
	return func(t *testing.T) {
		authJWTSvc, err := initAuthService(t, cbs...)
		require.NoError(t, err)

		fn(t, scenarioContext{
			ctx:        context.Background(),
			cfg:        authJWTSvc.Cfg,
			authJWTSvc: authJWTSvc,
		})
	}
}

func configurePKIXPublicKeyFile(t *testing.T, cfg *setting.Cfg) {
	t.Helper()

	file, err := os.CreateTemp(os.TempDir(), "public-key-*.pem")
	require.NoError(t, err)
	t.Cleanup(func() {
		if err := os.Remove(file.Name()); err != nil {
			panic(err)
		}
	})

	blockBytes, err := x509.MarshalPKIXPublicKey(rsaKeys[0].Public())
	require.NoError(t, err)

	require.NoError(t, pem.Encode(file, &pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: blockBytes,
	}))
	require.NoError(t, file.Close())

	cfg.JWTAuth.KeyFile = file.Name()
}
