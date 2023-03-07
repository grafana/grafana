package oauthserver

import (
	"context"
	"crypto/rsa"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type OAuth2Service interface {
	RegisterApp(ctx context.Context, app *AppRegistration) (*Client, error)
	GetClient(ctx context.Context, id string) (*Client, error)
}

type KeyOption struct {
	URL      string `json:"url,omitempty"`
	Value    string `json:"value,omitempty"`
	Generate bool   `json:"generate,omitempty"`
}

type KeyResult struct {
	URL       string          `json:"url,omitempty"`
	Private   string          `json:"private,omitempty"`
	Public    string          `json:"public,omitempty"`
	Generated bool            `json:"generated,omitempty"`
	Key       *rsa.PrivateKey `json:"-"`
}

type AppRegistration struct {
	AppName     string                     `json:"name"`
	Permissions []accesscontrol.Permission `json:"permissions,omitempty"`
	RedirectURI *string                    `json:"redirectUri,omitempty"`
	Key         *KeyOption                 `json:"key,omitempty"`
}

type Client struct {
	ID               string     `json:"clientId" xorm:"client_id"`
	Secret           string     `json:"clientSecret" xorm:"secret"`
	Domain           string     `json:"domain,omitempty" xorm:"domain"`  // TODO: what it is used for?
	UserID           string     `json:"userID,omitempty" xorm:"user_id"` // TODO: what it is used for?
	AppName          string     `json:"name" xorm:"app_name"`
	RedirectURI      string     `json:"redirectUri,omitempty" xorm:"redirect_uri"`
	ServiceAccountID int64      `json:"serviceAccountId,omitempty" xorm:"service_account_id"`
	Key              *KeyResult `json:"key,omitempty" xorm:"key"`
}
