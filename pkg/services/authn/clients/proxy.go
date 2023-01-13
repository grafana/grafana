package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Client = new(Proxy)

func ProvideProxy() *Proxy {
	return &Proxy{}
}

type Proxy struct {
}

func (p Proxy) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	//TODO implement me
	panic("implement me")
}

func (p Proxy) Test(ctx context.Context, r *authn.Request) bool {
	//TODO implement me
	panic("implement me")
}
