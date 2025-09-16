package signingkeystore

import (
	"context"
	"crypto"

	"github.com/go-jose/go-jose/v4"

	"github.com/grafana/grafana/pkg/services/signingkeys"
)

var _ SigningStore = (*FakeStore)(nil)

type FakeStore struct {
	Keys        map[string]signingkeys.SigningKey
	PrivateKeys map[string]crypto.Signer
	jwks        jose.JSONWebKeySet
}

func NewFakeStore() *FakeStore {
	return &FakeStore{
		PrivateKeys: make(map[string]crypto.Signer),
		Keys:        make(map[string]signingkeys.SigningKey),
		jwks:        jose.JSONWebKeySet{},
	}
}

func (s *FakeStore) Add(ctx context.Context, key *signingkeys.SigningKey, force bool) (*signingkeys.SigningKey, error) {
	if !force {
		if _, ok := s.Keys[key.KeyID]; ok {
			return nil, signingkeys.ErrSigningKeyAlreadyExists
		}
	}

	s.Keys[key.KeyID] = *key
	return key, nil
}

func (s *FakeStore) List(ctx context.Context) ([]signingkeys.SigningKey, error) {
	out := make([]signingkeys.SigningKey, 0, len(s.Keys))
	for _, key := range s.Keys {
		out = append(out, key)
	}
	return out, nil
}

func (s *FakeStore) Get(ctx context.Context, keyID string) (*signingkeys.SigningKey, error) {
	if key, ok := s.Keys[keyID]; ok {
		return &key, nil
	}

	return nil, signingkeys.ErrSigningKeyNotFound
}
