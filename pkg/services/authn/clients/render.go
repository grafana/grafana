package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

const (
	renderCookieName = "renderKey"
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
	if r.HTTPRequest == nil {
		return false
	}
	return getRenderKey(r) != ""
}

func getRenderKey(r *authn.Request) string {
	cookie, err := r.HTTPRequest.Cookie(renderCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
