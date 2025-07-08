package fakes

import (
	"context"
	"errors"

	"github.com/google/uuid"

	secretv1beta1 "github.com/grafana/grafana/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

var ErrSecretNotFound = errors.New("secret not found")

type FakeKeeper struct {
	values map[string]map[string]string
}

var _ contracts.Keeper = (*FakeKeeper)(nil)

func NewFakeKeeper() *FakeKeeper {
	return &FakeKeeper{
		values: make(map[string]map[string]string),
	}
}

func (s *FakeKeeper) Store(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace string, exposedValueOrRef string) (contracts.ExternalID, error) {
	ns, ok := s.values[namespace]
	if !ok {
		ns = make(map[string]string)
	}
	uid := uuid.New().String()
	ns[uid] = exposedValueOrRef
	s.values[namespace] = ns

	return contracts.ExternalID(uid), nil
}

func (s *FakeKeeper) Expose(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace string, externalID contracts.ExternalID) (secretv1beta1.ExposedSecureValue, error) {
	ns, ok := s.values[namespace]
	if !ok {
		return "", ErrSecretNotFound
	}
	exposedVal, ok := ns[externalID.String()]
	if !ok {
		return "", ErrSecretNotFound
	}

	return secretv1beta1.NewExposedSecureValue(exposedVal), nil
}

func (s *FakeKeeper) Delete(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace string, externalID contracts.ExternalID) error {
	return nil
}

func (s *FakeKeeper) Update(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace string, externalID contracts.ExternalID, exposedValueOrRef string) error {
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
