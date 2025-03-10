package fakes

import (
	"context"
	"errors"

	"github.com/google/uuid"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
)

var ErrSecretNotFound = errors.New("secret not found")

type FakeKeeper struct {
	values map[string]map[string]string
}

var _ contracts.Keeper = (*FakeKeeper)(nil)

func NewFakeKeeper(tracer tracing.Tracer, encryptionManager *manager.EncryptionManager, store encryptionstorage.EncryptedValueStorage) (*FakeKeeper, error) {
	return &FakeKeeper{
		values: make(map[string]map[string]string),
	}, nil
}

func (s *FakeKeeper) Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (contracts.ExternalID, error) {
	ns, ok := s.values[namespace]
	if !ok {
		ns = make(map[string]string)
	}
	uid := uuid.New().String()
	ns[uid] = exposedValueOrRef
	s.values[namespace] = ns

	return contracts.ExternalID(uid), nil
}

func (s *FakeKeeper) Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	ns, ok := s.values[namespace]
	if !ok {
		return "", ErrSecretNotFound
	}
	exposedVal, ok := ns[externalID.String()]
	if !ok {
		return "", ErrSecretNotFound
	}

	return secretv0alpha1.NewExposedSecureValue(exposedVal), nil
}

func (s *FakeKeeper) Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID) error {
	return nil
}

func (s *FakeKeeper) Update(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID, exposedValueOrRef string) error {
	ns, ok := s.values[namespace]
	if !ok {
		return ErrSecretNotFound
	}
	_, ok = ns[externalID.String()]
	if !ok {
		return ErrSecretNotFound
	}

	ns[externalID.String()] = exposedValueOrRef
	return nil
}
