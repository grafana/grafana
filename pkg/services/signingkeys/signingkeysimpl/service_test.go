package signingkeysimpl

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystore"
)

const (
	privateKeyPem = `-----BEGIN PRIVATE KEY-----
MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCAv8mcYDAugBtzfGYP9
ielIkb6/Ys51o7KjHxtANhPesw==
-----END PRIVATE KEY-----`
)

func getPrivateKey(t *testing.T) *ecdsa.PrivateKey {
	pemBlock, _ := pem.Decode([]byte(privateKeyPem))
	privateKey, err := x509.ParsePKCS8PrivateKey(pemBlock.Bytes)
	require.NoError(t, err)
	return privateKey.(*ecdsa.PrivateKey)
}

func TestEmbeddedKeyService_GetJWKS_OnlyPublicKeyShared(t *testing.T) {
	mockStore := signingkeystore.NewFakeStore()

	_, err := mockStore.AddPrivateKey(context.Background(), signingkeys.ServerPrivateKeyID, jose.ES256, getPrivateKey(t), nil, false)
	require.NoError(t, err)

	_, err = mockStore.AddPrivateKey(context.Background(), "other", jose.ES256, getPrivateKey(t), nil, false)
	require.NoError(t, err)

	svc := &Service{
		log:   log.NewNopLogger(),
		store: mockStore,
	}
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
	mockStore := signingkeystore.NewFakeStore()

	svc := &Service{
		log:   log.NewNopLogger(),
		store: mockStore,
	}

	wantedKeyID := keyMonthScopedID("test", jose.ES256)
	assert.Equal(t, wantedKeyID, fmt.Sprintf("test-%s-es256", time.Now().UTC().Format("2006-01")))

	// only ES256 is supported
	_, _, err := svc.GetOrCreatePrivateKey(context.Background(), "test", jose.RS256)
	require.Error(t, err)

	// first call should generate a key
	_, key, err := svc.GetOrCreatePrivateKey(context.Background(), "test", jose.ES256)
	require.NoError(t, err)
	require.NotNil(t, key)

	assert.Contains(t, mockStore.PrivateKeys, wantedKeyID)

	// second call should return the same key
	id, key2, err := svc.GetOrCreatePrivateKey(context.Background(), "test", jose.ES256)
	require.NoError(t, err)
	require.NotNil(t, key2)
	require.Equal(t, key, key2)
	require.Equal(t, wantedKeyID, id)

	assert.Len(t, mockStore.PrivateKeys, 1)
}
