package extsvcauth

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ServiceAccounts AuthProvider = "ServiceAccounts"

	// TmpOrgID is the orgID we use while global service accounts are not supported.
	TmpOrgID int64 = 1
)

type AuthProvider string

//go:generate mockery --name ExternalServiceRegistry --structname ExternalServiceRegistryMock --output tests --outpkg tests --filename extsvcregmock.go
type ExternalServiceRegistry interface {
	// HasExternalService returns whether an external service has been saved with that name.
	HasExternalService(ctx context.Context, name string) (bool, error)

	// GetExternalServiceNames returns the names of external services registered in store.
	GetExternalServiceNames(ctx context.Context) ([]string, error)

	// RemoveExternalService removes an external service and its associated resources from the database (ex: service account, token).
	RemoveExternalService(ctx context.Context, name string) error

	// SaveExternalService creates or updates an external service in the database. Based on the requested auth provider,
	// it generates client_id, secrets and any additional provider specificities (ex: rsa keys). It also ensures that the
	// associated service account has the correct permissions.
	SaveExternalService(ctx context.Context, cmd *ExternalServiceRegistration) (*ExternalService, error)
}

type SelfCfg struct {
	// Enabled allows the service to request access tokens for itself
	Enabled bool
	// Permissions are the permissions that the external service needs its associated service account to have.
	Permissions []accesscontrol.Permission
}

// ExternalServiceRegistration represents the registration form to save new client.
type ExternalServiceRegistration struct {
	Name string
	// Self access configuration
	Self SelfCfg
	// Auth Provider that the client will use to connect to Grafana
	AuthProvider AuthProvider
	// Auth Provider specific config
	OAuthProviderCfg *OAuthProviderCfg
}

// ExternalService represents the credentials that the ExternalService can use to connect to Grafana.
type ExternalService struct {
	Name       string
	ID         string
	Secret     string
	OAuthExtra *OAuthExtra // Auth Provider specificities (ex: ecdsa key pair)
}

type KeyOption struct {
	// URL       string `json:"url,omitempty"` // TODO allow specifying a URL (to a .jwks file) to fetch the key from
	// PublicPEM contains the Base64 encoded public key in PEM format
	PublicPEM string
	Generate  bool
}

// ProviderCfg represents the registration form specificities needed to register OAuth2 clients.
type OAuthProviderCfg struct {
	// RedirectURI is the URI that is used in the code flow.
	// Note that this is not used yet.
	RedirectURI *string
	// Key is the option to specify a public key or ask the server to generate a crypto key pair.
	Key *KeyOption
}

type KeyResult struct {
	URL        string
	PrivatePem string
	PublicPem  string
	Generated  bool
}

// OAuthExtra represents the specificities of an OAuth2 client.
type OAuthExtra struct {
	Audiences   string
	GrantTypes  string
	KeyResult   *KeyResult
	RedirectURI string
}
