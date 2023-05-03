package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errDecodingBasicAuthHeader = errutil.NewBase(errutil.StatusBadRequest, "basic-auth.invalid-header", errutil.WithPublicMessage("Invalid Basic Auth Header"))
)

var _ authn.ContextAwareClient = new(Basic)

func ProvideBasic(client authn.PasswordClient) *Basic {
	return &Basic{client}
}

type Basic struct {
	client authn.PasswordClient
}

func (c *Basic) String() string {
	return c.Name()
}

func (c *Basic) Name() string {
	return authn.ClientBasic
}

func (c *Basic) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	username, password, ok := getBasicAuthFromRequest(r)
	if !ok {
		return nil, errDecodingBasicAuthHeader.Errorf("failed to decode basic auth header")
	}

	return c.client.AuthenticatePassword(ctx, r, username, password)
}

func (c *Basic) Test(ctx context.Context, r *authn.Request) bool {
	return looksLikeBasicAuthRequest(r)
}

func (c *Basic) Priority() uint {
	return 40
}

func looksLikeBasicAuthRequest(r *authn.Request) bool {
	_, _, ok := getBasicAuthFromRequest(r)
	return ok
}

func getBasicAuthFromRequest(r *authn.Request) (string, string, bool) {
	if r.HTTPRequest == nil {
		return "", "", false
	}

	return r.HTTPRequest.BasicAuth()
}
