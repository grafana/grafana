package oauthserver

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// TmpOrgID is the orgID we use while global service accounts are not supported.
const TmpOrgID int64 = 1

var (
	allOrgsOAuthScope = "org.*"
)

type OAuth2Service interface {
	RegisterApp(ctx context.Context, app *AppRegistration) (*ClientDTO, error)
	GetApp(ctx context.Context, id string) (*Client, error)
	HandleTokenRequest(rw http.ResponseWriter, req *http.Request)
	HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request)
}

type KeyOption struct {
	// URL       string `json:"url,omitempty"` // TODO allow specifying a URL to fetch the key from
	PublicPEM string `json:"publicPEM,omitempty"`
	Generate  bool   `json:"generate,omitempty"`
}

type AppRegistration struct {
	AppName                string                     `json:"name"`
	Permissions            []accesscontrol.Permission `json:"permissions,omitempty"`
	ImpersonatePermissions []accesscontrol.Permission `json:"impersonatePermissions,omitempty"`
	RedirectURI            *string                    `json:"redirectUri,omitempty"`
	Key                    *KeyOption                 `json:"key,omitempty"`
}
