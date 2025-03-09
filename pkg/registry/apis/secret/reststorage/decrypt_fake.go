package reststorage

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

func NewFakeDecryptStore(securevaluestore contracts.SecureValueMetadataStorage) contracts.DecryptStorage {
	return &fakeDecryptStorage{
		securevaluemetadatastore: securevaluestore,
	}
}

type fakeDecryptStorage struct {
	securevaluemetadatastore contracts.SecureValueMetadataStorage
}

func (s *fakeDecryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv0alpha1.ExposedSecureValue, error) {
	_, err := s.securevaluemetadatastore.Read(ctx, namespace, name)
	if err != nil {
		return "", contracts.ErrSecureValueNotFound
	}

	// Always return save value as the secret value is not stored in the fake store.
	return secretv0alpha1.ExposedSecureValue("super duper secure"), nil
}
