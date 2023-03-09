package oauthserver

import (
	"context"
	"crypto/rsa"
	"net/http"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// TmpOrgID is the orgID we use while global service accounts are not supported.
const TmpOrgID int64 = 1

var (
	allOrgsOAuthScope = "org.*"
)

type OAuth2Service interface {
	RegisterExternalService(ctx context.Context, app *ExternalServiceRegistration) (*ClientDTO, error)
	GetExternalService(ctx context.Context, id string) (*Client, error)
	HandleTokenRequest(rw http.ResponseWriter, req *http.Request)
	HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request)
	GetServerPublicKey() *rsa.PublicKey
}

type KeyOption struct {
	// URL       string `json:"url,omitempty"` // TODO allow specifying a URL to fetch the key from
	PublicPEM string `json:"publicPEM,omitempty"`
	Generate  bool   `json:"generate,omitempty"`
}

type ExternalServiceRegistration struct {
	ExternalServiceName    string                     `json:"name"`
	Permissions            []accesscontrol.Permission `json:"permissions,omitempty"`
	ImpersonatePermissions []accesscontrol.Permission `json:"impersonatePermissions,omitempty"`
	RedirectURI            *string                    `json:"redirectUri,omitempty"`
	Key                    *KeyOption                 `json:"key,omitempty"`
}
