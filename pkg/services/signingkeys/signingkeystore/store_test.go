package signingkeystore

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationSigningKeyStore(t *testing.T) {
	ctx := context.Background()

	testCases := []struct {
		name     string
		keyFunc  func() (crypto.Signer, error)
		keyID    string
		alg      jose.SignatureAlgorithm
		expected jose.JSONWebKey
	}{
		{
			name: "RSA key",
			keyFunc: func() (crypto.Signer, error) {
				return rsa.GenerateKey(rand.Reader, 2048)
			},
			keyID: "test-rsa-key",
			alg:   jose.RS256,
			expected: jose.JSONWebKey{
				Key:       &rsa.PublicKey{},
				Algorithm: "RS256",
				KeyID:     "test-rsa-key",
				Use:       "sig",
			},
		},
		{
			name: "Elliptic Curve key",
			keyFunc: func() (crypto.Signer, error) {
				return ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
			},
			keyID: "test-ec-key",
			alg:   jose.ES256,
			expected: jose.JSONWebKey{
				Key:       &ecdsa.PublicKey{},
				Algorithm: "ES256",
				KeyID:     "test-ec-key",
				Use:       "sig",
			},
		},
	}

	for _, tc := range testCases {
		dbStore := db.InitTestDB(t)

		store := NewSigningKeyStore(dbStore)
		t.Run(tc.name, func(t *testing.T) {
			key, err := tc.keyFunc()
			assert.NoError(t, err)

			err = store.AddPrivateKey(ctx, tc.keyID, tc.alg, key, nil, true)
			assert.NoError(t, err)

			retrievedKey, err := store.GetPrivateKey(ctx, tc.keyID)
			assert.NoError(t, err)

			assert.Equal(t, key.Public(), retrievedKey.Public())

			jwks, err := store.GetJWKS(ctx)
			assert.NoError(t, err)

			require.Len(t, jwks.Keys, 1)
			assert.Equal(t, key.Public(), jwks.Keys[0].Key)
			assert.Equal(t, tc.expected.Algorithm, jwks.Keys[0].Algorithm)
			assert.Equal(t, tc.expected.KeyID, jwks.Keys[0].KeyID)
			assert.Equal(t, tc.expected.Use, jwks.Keys[0].Use)
		})
	}
}

func TestIntegrationAddPrivateKey(t *testing.T) {
	ctx := context.Background()

	dbStore := db.InitTestDB(t)

	store := NewSigningKeyStore(dbStore)

	key1 := generateRSAKey(t)
	key2 := generateECKey(t)
	key3 := generateECKey(t)

	testCases := []struct {
		name        string
		keyID       string
		alg         jose.SignatureAlgorithm
		privateKey  crypto.Signer
		expiresAt   *time.Time
		force       bool
		expectedErr error
		expectedKey crypto.Signer
	}{
		{
			name:        "Add new private key",
			keyID:       "test-key-1",
			alg:         jose.RS256,
			privateKey:  key1,
			force:       false,
			expectedKey: key1,
		},
		{
			name:        "Add new private key with expiration",
			keyID:       "test-key-2",
			alg:         jose.ES256,
			privateKey:  key2,
			expiresAt:   &[]time.Time{time.Now().Add(24 * time.Hour)}[0],
			force:       false,
			expectedKey: key2,
		},
		{
			name:        "Fail to replace unexpired key",
			keyID:       "test-key-1",
			alg:         jose.RS256,
			privateKey:  key3,
			expiresAt:   &[]time.Time{time.Now().Add(-24 * time.Hour)}[0],
			force:       false,
			expectedErr: nil,
			expectedKey: key1,
		},
		{
			name:        "Replace key1 private key with force, already expired",
			keyID:       "test-key-1",
			alg:         jose.ES256,
			privateKey:  key3,
			expiresAt:   &[]time.Time{time.Now().Add(-24 * time.Hour)}[0],
			force:       true,
			expectedKey: key3,
		},
		{
			name:        "Replace key1 private key with no force, is expired",
			keyID:       "test-key-1",
			alg:         jose.ES256,
			privateKey:  key1,
			expiresAt:   &[]time.Time{time.Now().Add(24 * time.Hour)}[0],
			force:       false,
			expectedKey: key1,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := store.AddPrivateKey(ctx, tc.keyID, tc.alg, tc.privateKey, tc.expiresAt, tc.force)
			if tc.expectedErr != nil {
				assert.EqualError(t, err, tc.expectedErr.Error())
				return
			}
			assert.NoError(t, err)

			retrievedKey, err := store.GetPrivateKey(ctx, tc.keyID)
			assert.NoError(t, err)

			assert.Equal(t, tc.expectedKey.Public(), retrievedKey.Public())
		})
	}
}

func generateRSAKey(t *testing.T) *rsa.PrivateKey {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return key
}

func generateECKey(t *testing.T) *ecdsa.PrivateKey {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	return key
}
