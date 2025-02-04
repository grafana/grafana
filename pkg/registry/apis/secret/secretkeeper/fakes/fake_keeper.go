package fakes

import (
	"context"

	"github.com/google/uuid"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
)

type FakeKeeper struct {
	values map[string]map[string]string
}

var _ keepertypes.Keeper = (*FakeKeeper)(nil)

func NewFakeKeeper(tracer tracing.Tracer, encryptionManager *manager.EncryptionManager, store encryptionstorage.EncryptedValueStorage) (*FakeKeeper, error) {
	return &FakeKeeper{
		values: make(map[string]map[string]string),
	}, nil
}

func (s *FakeKeeper) Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (keepertypes.ExternalID, error) {
	ns, ok := s.values[namespace]
	if !ok {
		ns = make(map[string]string)
	}
	uid := uuid.New().String()
	ns[uid] = exposedValueOrRef
	s.values[namespace] = ns

	return keepertypes.ExternalID(uid), nil
}

func (s *FakeKeeper) Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	ns, ok := s.values[namespace]
	if !ok {
		return "", keepertypes.ErrSecretNotFound
	}
	exposedVal, ok := ns[externalID.String()]
	if !ok {
		return "", keepertypes.ErrSecretNotFound
	}

	return secretv0alpha1.NewExposedSecureValue(exposedVal), nil
}

func (s *FakeKeeper) Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID keepertypes.ExternalID) error {
	return nil
}
