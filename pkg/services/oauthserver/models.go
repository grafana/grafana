package oauthserver

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/plugins"
	"gopkg.in/square/go-jose.v2"
)

const (
	// TmpOrgID is the orgID we use while global service accounts are not supported.
	TmpOrgID int64 = 1
	// NoServiceAccountID is the ID we use for client that have no service account associated.
	NoServiceAccountID int64 = 0
)

var (
	allOrgsOAuthScope = "org.*"
)

type OAuth2Service interface {
	RegisterExternalService(ctx context.Context, app *plugins.ExternalServiceRegistration) (*plugins.ClientDTO, error)
	SaveExternalService(ctx context.Context, cmd *plugins.ExternalServiceRegistration) (*plugins.ClientDTO, error)
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

const (
	RS256 = "RS256"
	ES256 = "ES256"
)
