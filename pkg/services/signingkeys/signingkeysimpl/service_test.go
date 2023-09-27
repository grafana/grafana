package signingkeysimpl

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"testing"

	"github.com/go-jose/go-jose/v3"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
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

	err := mockStore.AddPrivateKey(context.Background(), signingkeys.ServerPrivateKeyID, jose.ES256, getPrivateKey(t), nil, false)
	require.NoError(t, err)

	err = mockStore.AddPrivateKey(context.Background(), "other", jose.ES256, getPrivateKey(t), nil, false)
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

func TestIntegrationProvideEmbeddedSigningKeysService(t *testing.T) {
	s, err := ProvideEmbeddedSigningKeysService(db.InitTestDB(t), fakes.NewFakeSecretsService())
	require.NoError(t, err)
	require.NotNil(t, s)

	key, err := s.GetPrivateKey(context.Background(), signingkeys.ServerPrivateKeyID)
	require.NoError(t, err)

	// Verify that ProvideEmbeddedSigningKeysService generates an ECDSA private key by default
	require.IsType(t, &ecdsa.PrivateKey{}, key)
}
