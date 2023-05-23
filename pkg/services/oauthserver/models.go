package oauthserver

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"gopkg.in/square/go-jose.v2"
)

const (
	// TmpOrgID is the orgID we use while global service accounts are not supported.
	TmpOrgID int64 = 1
	// NoServiceAccountID is the ID we use for client that have no service account associated.
	NoServiceAccountID int64 = 0

	// List of scopes used to identify the impersonated user.
	ScopeUsersSelf       = "users:self"
	ScopeGlobalUsersSelf = "global.users:self"
	ScopeTeamsSelf       = "teams:self"
)

// OAuth2Service represents a service in charge of managing OAuth2 clients
// and handling OAuth2 requests (token, introspection)
type OAuth2Service interface {
	// SaveExternalService creates or updates an external service in the database, it ensures that the associated
	// service account has the correct permissions
	SaveExternalService(ctx context.Context, cmd *ExternalServiceRegistration) (*ClientDTO, error)
	// GetExternalService retrieves an external service from store by client_id. It populates the SelfPermissions and
	// SignedInUser from the associated service account.
	GetExternalService(ctx context.Context, id string) (*Client, error)

	// HandleTokenRequest handles the client's OAuth2 query to obtain an access_token by presenting its authorization
	// grant (ex: client_credentials, jwtbearer)
	HandleTokenRequest(rw http.ResponseWriter, req *http.Request)
	// HandleIntrospectionRequest handles the OAuth2 query to determine the active state of an OAuth 2.0 token and
	// to determine meta-information about this token
	HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request)
}

//go:generate mockery --name Store --structname MockStore --outpkg oauthtest --filename store_mock.go --output ./oauthtest/

type Store interface {
	RegisterExternalService(ctx context.Context, client *Client) error
	SaveExternalService(ctx context.Context, client *Client) error
	GetExternalService(ctx context.Context, id string) (*Client, error)
	GetExternalServiceByName(ctx context.Context, app string) (*Client, error)

	GetExternalServicePublicKey(ctx context.Context, clientID string) (*jose.JSONWebKey, error)
}

type KeyOption struct {
	// URL       string `json:"url,omitempty"` // TODO allow specifying a URL (to a .jwks file) to fetch the key from
	// PublicPEM contains the Base64 encoded public key in PEM format
	PublicPEM string `json:"public_pem,omitempty"`
	Generate  bool   `json:"generate,omitempty"`
}

type ExternalServiceRegistration struct {
	ExternalServiceName    string                     `json:"name"`
	Permissions            []accesscontrol.Permission `json:"permissions,omitempty"`
	ImpersonatePermissions []accesscontrol.Permission `json:"impersonatePermissions,omitempty"`
	RedirectURI            *string                    `json:"redirectUri,omitempty"`
	Key                    *KeyOption                 `json:"key,omitempty"`
}

const (
	RS256 = "RS256"
	ES256 = "ES256"
)
