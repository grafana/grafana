package authnimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Service = new(Service)

type Service struct {
	clients map[string]authn.Client
}

func (s Service) Authenticate(ctx context.Context, client string, r *authn.Request) (*authn.Identity, error) {
	panic("implement me")
}
