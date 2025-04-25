package secrets

import (
	"context"

	"github.com/grafana/grafana/pkg/services/secrets"
)

// A secrets encryption service. It only operates on values, no names or similar.
// It is likely we will need to change this when the multi-tenant service comes around.
//
// FIXME: this is a temporary service/package until we can make use of
// the new secrets service in app platform.
//
//go:generate mockery --name Service --structname MockService --inpackage --filename secret_mock.go --with-expecter
type Service interface {
	Encrypt(ctx context.Context, data []byte) ([]byte, error)
	Decrypt(ctx context.Context, data []byte) ([]byte, error)
}

var _ Service = (*singleTenant)(nil)

type singleTenant struct {
	inner secrets.Service
}

func NewSingleTenant(svc secrets.Service) *singleTenant {
	return &singleTenant{svc}
}

func (s *singleTenant) Encrypt(ctx context.Context, data []byte) ([]byte, error) {
	return s.inner.Encrypt(ctx, data, secrets.WithoutScope())
}

func (s *singleTenant) Decrypt(ctx context.Context, data []byte) ([]byte, error) {
	return s.inner.Decrypt(ctx, data)
}
