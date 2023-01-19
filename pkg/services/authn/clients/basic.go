package clients

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errDecodingBasicAuthHeader = errutil.NewBase(errutil.StatusBadRequest, "basic-auth.invalid-header", errutil.WithPublicMessage("Invalid Basic Auth Header"))
)

var _ authn.Client = new(Basic)

func ProvideBasic(client authn.PasswordClient) *Basic {
	return &Basic{client}
}

type Basic struct {
	client authn.PasswordClient
}

func (c *Basic) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	username, password, err := util.DecodeBasicAuthHeader(getBasicAuthHeaderFromRequest(r))
	if err != nil {
		return nil, errDecodingBasicAuthHeader.Errorf("failed to decode basic auth header: %w", err)
	}

	return c.client.AuthenticatePassword(ctx, r, username, password)
}

func (c *Basic) Test(ctx context.Context, r *authn.Request) bool {
	return looksLikeBasicAuthRequest(r)
}

func looksLikeBasicAuthRequest(r *authn.Request) bool {
	return getBasicAuthHeaderFromRequest(r) != ""
}

func getBasicAuthHeaderFromRequest(r *authn.Request) string {
	if r.HTTPRequest == nil {
		return ""
	}

	header := r.HTTPRequest.Header.Get(authorizationHeaderName)
	if header == "" {
		return ""
	}

	if !strings.HasPrefix(header, basicPrefix) {
		return ""
	}

	return header
}
