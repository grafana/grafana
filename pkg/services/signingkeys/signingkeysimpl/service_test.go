package signingkeysimpl

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/signingkeys"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
)

const (
	privateKeyPem = `-----BEGIN PRIVATE KEY-----
MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCAv8mcYDAugBtzfGYP9
ielIkb6/Ys51o7KjHxtANhPesw==
-----END PRIVATE KEY-----`
)

func getPrivateKey(t *testing.T, svc *Service) string {
	pemBlock, _ := pem.Decode([]byte(privateKeyPem))
	privateKey, err := x509.ParsePKCS8PrivateKey(pemBlock.Bytes)
	require.NoError(t, err)

	bytes, err := svc.encodePrivateKey(context.Background(), privateKey.(*ecdsa.PrivateKey))
	require.NoError(t, err)
	return string(bytes)
}

func TestEmbeddedKeyService_GetJWKS_OnlyPublicKeyShared(t *testing.T) {
	svc := &Service{
		log:            log.NewNopLogger(),
		store:          signingkeystore.NewFakeStore(),
		secretsService: secretstest.NewFakeSecretsService(),
		remoteCache:    remotecache.NewFakeCacheStorage(),
		localCache:     localcache.New(privateKeyTTL, 10*time.Hour),
	}

	_, _, err := svc.GetOrCreatePrivateKey(context.Background(), "key-1", jose.ES256)
	require.NoError(t, err)
	_, _, err = svc.GetOrCreatePrivateKey(context.Background(), "key-2", jose.ES256)
	require.NoError(t, err)
	jwks, err := svc.GetJWKS(context.Background())
	require.NoError(t, err)

	require.Equal(t, 2, len(jwks.Keys))

	jwksJson, err := json.Marshal(jwks)
	require.NoError(t, err)

	type keys struct {
		Keys []map[string]any `json:"keys"`
	}

	var kvs keys

	err = json.Unmarshal(jwksJson, &kvs)
	require.NoError(t, err)

	for _, kv := range kvs.Keys {
		// check that the private key is not shared
		require.NotContains(t, kv, "d")
		require.NotContains(t, kv, "p")
		require.NotContains(t, kv, "q")
	}
}

func TestEmbeddedKeyService_GetOrCreatePrivateKey(t *testing.T) {
	cacheStorage := remotecache.NewFakeCacheStorage()
	svc := &Service{
		log:            log.NewNopLogger(),
		store:          signingkeystore.NewFakeStore(),
		secretsService: secretstest.NewFakeSecretsService(),
		remoteCache:    cacheStorage,
		localCache:     localcache.New(privateKeyTTL, 10*time.Hour),
	}

	wantedKeyID := keyMonthScopedID("test", jose.ES256)
	assert.Equal(t, wantedKeyID, fmt.Sprintf("test-%s-es256", time.Now().UTC().Format("2006-01")))

	err := cacheStorage.Set(context.Background(), jwksCacheKey, []byte("invalid"), 0)
	require.NoError(t, err)

	// only ES256 is supported
	_, _, err = svc.GetOrCreatePrivateKey(context.Background(), "test", jose.RS256)
	require.Error(t, err)

	_, err = cacheStorage.Get(context.Background(), jwksCacheKey)
	require.NoError(t, err)
	require.Len(t, cacheStorage.Storage, 1)

	// first call should generate a key
	_, key, err := svc.GetOrCreatePrivateKey(context.Background(), "test", jose.ES256)
	require.NoError(t, err)
	require.NotNil(t, key)

	// new key is generated, so jwks cache should be voided
	require.Len(t, cacheStorage.Storage, 0)

	err = cacheStorage.Set(context.Background(), jwksCacheKey, []byte("invalid"), 0)
	require.NoError(t, err)

	// second call should return the same key
	id, key2, err := svc.GetOrCreatePrivateKey(context.Background(), "test", jose.ES256)
	require.NoError(t, err)
	require.NotNil(t, key2)
	require.Equal(t, key, key2)
	require.Equal(t, wantedKeyID, id)

	// no new key is generated, so jwks cache should not be voided
	require.Len(t, cacheStorage.Storage, 1)
}

func TestExposeJWKS(t *testing.T) {
	// create a new service instance
	mockStore := signingkeystore.NewFakeStore()
	cacheStorage := remotecache.NewFakeCacheStorage()
	svc := &Service{
		log:            log.NewNopLogger(),
		store:          mockStore,
		remoteCache:    cacheStorage,
		secretsService: secretstest.NewFakeSecretsService(),
		localCache:     localcache.New(privateKeyTTL, 10*time.Hour),
	}

	routerRegister := routing.NewRouteRegister()

	svc.registerAPIEndpoints(routerRegister)

	server := webtest.NewServer(t, routerRegister)
	_, err := mockStore.Add(context.Background(), &signingkeys.SigningKey{
		KeyID:      "test-key",
		PrivateKey: getPrivateKey(t, svc),
		AddedAt:    time.Now(),
		Alg:        jose.ES256,
	}, false)

	require.NoError(t, err)

	// create a new request context
	req := server.NewRequest(http.MethodGet, "/api/signing-keys/keys", nil)
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1,
		Permissions: map[int64]map[string][]string{}})
	res, err := server.Send(req)
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, res.StatusCode)
	assert.Equal(t, "application/json", res.Header.Get("Content-Type"))

	// check the response body
	expected := `{"keys":[{"use":"sig","kty":"EC","kid":"test-key","crv":"P-256","alg":"ES256","x":"YYpLNYcnJp7FmSkPBHEOvwmCspeJvUYiOC3vo2h7jsY","y":"2PDsIq8bryoBUmLBYW1tlpy6fhMcHVNnaOApWStRYGw"}]}`

	body, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	assert.JSONEq(t, expected, string(body), string(body))
	require.NoError(t, res.Body.Close())
	assert.Contains(t, cacheStorage.Storage, jwksCacheKey)
}
