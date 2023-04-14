package signingkeysimpl

import (
	"crypto"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"reflect"
	"testing"

	"github.com/go-jose/go-jose/v3"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

const (
	privateKeyPem = `-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----`
)

func getPrivateKey(t *testing.T) *rsa.PrivateKey {
	pemBlock, _ := pem.Decode([]byte(privateKeyPem))
	privateKey, err := x509.ParsePKCS1PrivateKey(pemBlock.Bytes)
	require.NoError(t, err)
	return privateKey
}

func setupTestService(t *testing.T) *Service {
	svc := &Service{
		log:  log.NewNopLogger(),
		keys: map[string]crypto.Signer{"default": getPrivateKey(t)},
	}
	return svc
}

func TestEmbeddedKeyService_GetJWKS(t *testing.T) {
	svc := &Service{
		log: log.NewNopLogger(),
		keys: map[string]crypto.Signer{
			"default": getPrivateKey(t),
			"other":   getPrivateKey(t),
		},
	}
	jwk := svc.GetJWKS()

	require.Equal(t, 2, len(jwk.Keys))
}

func TestEmbeddedKeyService_GetJWK(t *testing.T) {
	type args struct {
		keyID string
	}
	tests := []struct {
		name    string
		args    args
		want    jose.JSONWebKey
		wantErr bool
	}{
		{name: "creates a JSON Web Key successfully",
			args: args{"default"},
			want: jose.JSONWebKey{
				Key: getPrivateKey(t).Public(),
				Use: "sig",
			},
			wantErr: false,
		},
		{name: "returns error when the specified key was not found",
			args:    args{"not-existing-key-id"},
			want:    jose.JSONWebKey{},
			wantErr: true,
		},
	}
	svc := setupTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.GetJWK(tt.args.keyID)
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

func TestEmbeddedKeyService_GetPublicKey(t *testing.T) {
	type args struct {
		keyID string
	}
	tests := []struct {
		name    string
		args    args
		want    crypto.PublicKey
		wantErr bool
	}{
		{
			name:    "returns the public key successfully",
			args:    args{"default"},
			want:    getPrivateKey(t).Public(),
			wantErr: false,
		},
		{
			name:    "returns error when the specified key was not found",
			args:    args{"not-existent-key-id"},
			want:    nil,
			wantErr: true,
		},
	}
	svc := setupTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.GetPublicKey(tt.args.keyID)
			if (err != nil) != tt.wantErr {
				t.Errorf("EmbeddedKeyService.GetPublicKey() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("EmbeddedKeyService.GetPublicKey() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEmbeddedKeyService_GetPrivateKey(t *testing.T) {
	type args struct {
		keyID string
	}
	tests := []struct {
		name    string
		args    args
		want    crypto.PrivateKey
		wantErr bool
	}{
		{
			name:    "returns the private key successfully",
			args:    args{"default"},
			want:    getPrivateKey(t),
			wantErr: false,
		},
		{
			name:    "returns error when the specified key was not found",
			args:    args{"not-existent-key-id"},
			want:    nil,
			wantErr: true,
		},
	}
	svc := setupTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := svc.GetPrivateKey(tt.args.keyID)
			if (err != nil) != tt.wantErr {
				t.Errorf("EmbeddedKeyService.GetPrivateKey() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("EmbeddedKeyService.GetPrivateKey() = %v, want %v", got, tt.want)
			}
		})
	}
}
