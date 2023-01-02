package clients

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Client = new(Basic)

func ProvideBasic() *Basic {
	return &Basic{}
}

type Basic struct {
}

func (b *Basic) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	//TODO implement me
	panic("implement me")
}

func (b *Basic) ClientParams() *authn.ClientParams {
	return &authn.ClientParams{}
}

func (b *Basic) Test(ctx context.Context, r *authn.Request) bool {
	if r.HTTPRequest == nil {
		return false
	}

	header := r.HTTPRequest.Header.Get(authorizationHeaderName)
	if header == "" {
		return false
	}

	return strings.HasPrefix(header, basicPrefix)
}
