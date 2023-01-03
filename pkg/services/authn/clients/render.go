package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Client = new(Render)

func ProvideRender() *Render {
	return &Render{}
}

type Render struct {
}

func (c *Render) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	//TODO implement me
	panic("implement me")
}

func (c *Render) ClientParams() *authn.ClientParams {
	//TODO implement me
	panic("implement me")
}

func (c *Render) Test(ctx context.Context, r *authn.Request) bool {
	//TODO implement me
	panic("implement me")
}
