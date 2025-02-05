package reststorage

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

func NewFakeDecryptStore(securevaluestore contracts.SecureValueStorage) contracts.DecryptStorage {
	return &fakeDecryptStorage{
		securevaluestore: securevaluestore,
	}
}

type fakeDecryptStorage struct {
	securevaluestore contracts.SecureValueStorage
}

func (s *fakeDecryptStorage) Decrypt(ctx context.Context, nn xkube.NameNamespace) (secretv0alpha1.ExposedSecureValue, error) {
	_, err := s.securevaluestore.Read(ctx, nn)
	if err != nil {
		return "", contracts.ErrSecureValueNotFound
	}

	// Always return save value as the secret value is not stored in the fake store.
	return secretv0alpha1.ExposedSecureValue("super duper secure"), nil
}
