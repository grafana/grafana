package secret

import (
	"context"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

var _ SecureValueStore = (*noopStore)(nil)

// This store does nothing and is used when the feature toggle gating Secrets is off.
type noopStore struct{}

func (*noopStore) Create(ctx context.Context, s *secret.SecureValue) (*secret.SecureValue, error) {
	return new(secret.SecureValue), nil
}

func (*noopStore) Update(ctx context.Context, s *secret.SecureValue) (*secret.SecureValue, error) {
	return new(secret.SecureValue), nil
}

func (*noopStore) Delete(ctx context.Context, ns string, name string) (*secret.SecureValue, bool, error) {
	return new(secret.SecureValue), false, nil
}

func (*noopStore) List(ctx context.Context, ns string, options *internalversion.ListOptions) (*secret.SecureValueList, error) {
	return new(secret.SecureValueList), nil
}

func (*noopStore) Read(ctx context.Context, ns string, name string) (*secret.SecureValue, error) {
	return new(secret.SecureValue), nil
}

func (*noopStore) Decrypt(ctx context.Context, ns string, name string) (*secret.SecureValue, error) {
	return new(secret.SecureValue), nil
}

func (*noopStore) History(ctx context.Context, ns string, name string, continueToken string) (*secret.SecureValueActivityList, error) {
	return new(secret.SecureValueActivityList), nil
}
