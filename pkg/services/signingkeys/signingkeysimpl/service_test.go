package signingkeysimpl

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"io"
	"testing"

	"github.com/go-jose/go-jose/v3"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
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

func setupTestService(t *testing.T) *Service {
	svc := &Service{
		log:  log.NewNopLogger(),
		keys: map[string]crypto.Signer{serverPrivateKeyID: getPrivateKey(t)},
	}
	return svc
}

func TestEmbeddedKeyService_GetJWK(t *testing.T) {
	tests := []struct {
		name    string
		keyID   string
		want    jose.JSONWebKey
		wantErr bool
	}{
		{name: "creates a JSON Web Key successfully",
			keyID: "default",
			want: jose.JSONWebKey{
				Key: getPrivateKey(t).Public(),
				Use: "sig",
			},
			wantErr: false,
		},
		{name: "returns error when the specified key was not found",
			keyID:   "not-existing-key-id",
			want:    jose.JSONWebKey{},
			wantErr: true,
		},
	}
	svc := setupTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.GetJWK(tt.keyID)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, got, tt.want)
		})
	}
}

func TestEmbeddedKeyService_GetJWK_OnlyPublicKeyShared(t *testing.T) {
	svc := setupTestService(t)
	jwk, err := svc.GetJWK("default")

	require.NoError(t, err)

	jwkJson, err := jwk.MarshalJSON()
	require.NoError(t, err)

	kvs := make(map[string]interface{})
	err = json.Unmarshal(jwkJson, &kvs)
	require.NoError(t, err)

	// check that the private key is not shared
	require.NotContains(t, kvs, "d")
	require.NotContains(t, kvs, "p")
	require.NotContains(t, kvs, "q")
}

func TestEmbeddedKeyService_GetJWKS(t *testing.T) {
	svc := &Service{
		log: log.NewNopLogger(),
		keys: map[string]crypto.Signer{
			serverPrivateKeyID: getPrivateKey(t),
			"other":            getPrivateKey(t),
		},
	}
	jwk := svc.GetJWKS()

	require.Equal(t, 2, len(jwk.Keys))
}

func TestEmbeddedKeyService_GetJWKS_OnlyPublicKeyShared(t *testing.T) {
	svc := setupTestService(t)
	jwks := svc.GetJWKS()

	jwksJson, err := json.Marshal(jwks)
	require.NoError(t, err)

	type keys struct {
		Keys []map[string]interface{} `json:"keys"`
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

func TestEmbeddedKeyService_GetPublicKey(t *testing.T) {
	tests := []struct {
		name    string
		keyID   string
		want    crypto.PublicKey
		wantErr bool
	}{
		{
			name:    "returns the public key successfully",
			keyID:   "default",
			want:    getPrivateKey(t).Public(),
			wantErr: false,
		},
		{
			name:    "returns error when the specified key was not found",
			keyID:   "not-existent-key-id",
			want:    nil,
			wantErr: true,
		},
	}
	svc := setupTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.GetPublicKey(tt.keyID)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, got, tt.want)
		})
	}
}

func TestEmbeddedKeyService_GetPrivateKey(t *testing.T) {
	tests := []struct {
		name    string
		keyID   string
		want    crypto.PrivateKey
		wantErr bool
	}{
		{
			name:    "returns the private key successfully",
			keyID:   "default",
			want:    getPrivateKey(t),
			wantErr: false,
		},
		{
			name:    "returns error when the specified key was not found",
			keyID:   "not-existent-key-id",
			want:    nil,
			wantErr: true,
		},
	}
	svc := setupTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.GetPrivateKey(tt.keyID)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, got, tt.want)
		})
	}
}

func TestEmbeddedKeyService_AddPrivateKey(t *testing.T) {
	tests := []struct {
		name    string
		keyID   string
		wantErr bool
	}{
		{
			name:    "adds the private key successfully",
			keyID:   "new-key-id",
			wantErr: false,
		},
		{
			name:    "returns error when the specified key is already in the store",
			keyID:   serverPrivateKeyID,
			wantErr: true,
		},
	}
	svc := setupTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := svc.AddPrivateKey(tt.keyID, &dummyPrivateKey{})
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestProvideEmbeddedSigningKeysService(t *testing.T) {
	s, err := ProvideEmbeddedSigningKeysService()
	require.NoError(t, err)
	require.NotNil(t, s)

	// Verify that ProvideEmbeddedSigningKeysService generates an ECDSA private key by default
	require.IsType(t, &ecdsa.PrivateKey{}, s.GetServerPrivateKey())
}

type dummyPrivateKey struct {
}

func (d dummyPrivateKey) Public() crypto.PublicKey {
	return ""
}

func (d dummyPrivateKey) Sign(rand io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	return nil, nil
}
