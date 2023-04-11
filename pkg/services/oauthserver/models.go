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

var (
	allOrgsOAuthScope = "org.*"
)

type OAuth2Service interface {
	RegisterExternalService(ctx context.Context, app *ExternalServiceRegistration) (*ClientDTO, error)
	SaveExternalService(ctx context.Context, cmd *ExternalServiceRegistration) (*ClientDTO, error)
	GetExternalService(ctx context.Context, id string) (*Client, error)
	HandleTokenRequest(rw http.ResponseWriter, req *http.Request)
	HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request)
	GetServerPublicKey() interface{}
}

type Store interface {
	RegisterExternalService(ctx context.Context, client *Client) error
	SaveExternalService(ctx context.Context, client *Client) error
	GetExternalService(ctx context.Context, id string) (*Client, error)
	GetExternalServiceByName(ctx context.Context, app string) (*Client, error)

	GetExternalServicePublicKey(ctx context.Context, clientID string) (*jose.JSONWebKey, error)
}

type KeyOption struct {
	// URL       string `json:"url,omitempty"` // TODO allow specifying a URL (to a .jwks file) to fetch the key from
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
