package signingkeystore

import (
	"context"
	"crypto"
	"crypto/x509"
	"database/sql"
	"encoding/pem"
	"errors"
	"time"

	"github.com/go-jose/go-jose/v3"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type SigningStore interface {
	// GetJWKS returns the JSON Web Key Set for the service
	GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error)
	// AddPrivateKey adds a private key to the service. If the key already exists, it will be updated if force is true.
	// If force is false, the key will only be updated if it has expired. If the key does not exist, it will be added.
	// If expiresAt is nil, the key will not expire. Retrieve the result key with GetPrivateKey.
	AddPrivateKey(ctx context.Context, keyID string, alg jose.SignatureAlgorithm, privateKey crypto.Signer, expiresAt *time.Time, force bool) error
	// GetPrivateKey returns the private key with the specified key ID
	GetPrivateKey(ctx context.Context, keyID string) (crypto.Signer, error)
}

var _ SigningStore = (*Store)(nil)

type Store struct {
	dbStore db.DB
}

type SigningKey struct {
	ID         int64                   `json:"-" db:"id"`
	KeyID      string                  `json:"key_id" db:"key_id"`
	PrivateKey []byte                  `json:"private_key" db:"private_key"`
	AddedAt    time.Time               `json:"added_at" db:"added_at"`
	ExpiresAt  *time.Time              `json:"expires_at" db:"expires_at"`
	Alg        jose.SignatureAlgorithm `json:"alg" db:"alg"`
}

func NewSigningKeyStore(dbStore db.DB) *Store {
	return &Store{
		dbStore: dbStore,
	}
}

func (s *Store) GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error) {
	keySet := jose.JSONWebKeySet{}

	keys := []*SigningKey{}
	err := s.dbStore.GetSqlxSession().Select(ctx, &keys, "SELECT * FROM signing_key")
	if err != nil {
		return keySet, err
	}

	for _, key := range keys {
		assertedKey, err := decodePrivateKey(key)
		if err != nil {
			return keySet, err
		}

		keySet.Keys = append(keySet.Keys, jose.JSONWebKey{
			Key:       assertedKey.Public(),
			Algorithm: string(key.Alg),
			KeyID:     key.KeyID,
			Use:       "sig",
		})
	}

	return keySet, nil
}

func decodePrivateKey(signingKey *SigningKey) (crypto.Signer, error) {
	block, _ := pem.Decode(signingKey.PrivateKey)
	if block == nil {
		return nil, errors.New("failed to decode private key PEM")
	}

	parsedKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	assertedKey, ok := parsedKey.(crypto.Signer)
	if !ok {
		return nil, errors.New("failed to assert private key as crypto.Signer")
	}
	return assertedKey, nil
}

// AddPrivateKey adds a private key to the service.
func (s *Store) AddPrivateKey(ctx context.Context,
	keyID string, alg jose.SignatureAlgorithm, privateKey crypto.Signer, expiresAt *time.Time, force bool) error {
	// Encode private key to binary format
	pKeyBytes, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return err
	}

	// Encode private key to PEM format
	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: pKeyBytes,
	})

	key := &SigningKey{
		KeyID:      keyID,
		PrivateKey: privateKeyPEM,
		AddedAt:    time.Now(),
		Alg:        alg,
		ExpiresAt:  expiresAt,
	}

	dbSession := s.dbStore.GetSqlxSession()
	err = dbSession.WithTransaction(ctx, func(tx *session.SessionTx) error {
		existingKey := SigningKey{}
		err := tx.Get(ctx, &existingKey, "SELECT * FROM signing_key WHERE key_id = ?", keyID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		if len(existingKey.PrivateKey) == 0 {
			_, err = tx.Exec(ctx,
				"INSERT INTO signing_key (key_id, private_key, added_at, alg, expires_at) VALUES (?, ?, ?, ?, ?)",
				key.KeyID, key.PrivateKey, key.AddedAt, key.Alg, key.ExpiresAt)
			return err
		}

		if force || (existingKey.ExpiresAt != nil && existingKey.ExpiresAt.Before(time.Now())) {
			_, err = tx.Exec(ctx,
				"UPDATE signing_key SET private_key = ?, added_at = ?, alg = ?, expires_at = ? WHERE key_id = ?",
				key.PrivateKey, key.AddedAt, key.Alg, key.ExpiresAt, key.KeyID)
			return err
		}

		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

// GetPrivateKey returns the private key with the specified key ID
func (s *Store) GetPrivateKey(ctx context.Context, keyID string) (crypto.Signer, error) {
	key := &SigningKey{}
	err := s.dbStore.GetSqlxSession().Get(ctx, key, "SELECT * FROM signing_key WHERE key_id = ?", keyID)
	if err != nil {
		return nil, err
	}

	signKey, err := decodePrivateKey(key)
	if err != nil {
		return nil, err
	}

	return signKey, nil
}
