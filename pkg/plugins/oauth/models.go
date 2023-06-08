package oauth

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type KeyOption struct {
	// URL       string `json:"url,omitempty"` // TODO allow specifying a URL (to a .jwks file) to fetch the key from
	// PublicPEM contains the Base64 encoded public key in PEM format
	PublicPEM string `json:"public_pem,omitempty"`
	Generate  bool   `json:"generate,omitempty"`
}

type SelfCfg struct {
	// Enabled allows the service to request access tokens for itself using the client_credentials grant
	Enabled bool `json:"enabled"`
	// Permissions are the permissions that the external service needs its associated service account to have.
	Permissions []accesscontrol.Permission `json:"permissions,omitempty"`
}
type ImpersonationCfg struct {
	// Enabled allows the service to request access tokens to impersonate users using the jwtbearer grant
	Enabled bool `json:"enabled"`
	// Groups allows the service to list the impersonated user's teams
	Groups bool `json:"groups"`
	// Permissions are the permissions that the external service needs when impersonating a user.
	// The intersection of this set with the impersonated user's permission guarantees that the client will not
	// gain more privileges than the impersonated user has.
	Permissions []accesscontrol.Permission `json:"permissions,omitempty"`
}

// ExternalServiceRegistration represents the registration form to save new OAuth2 client.
type ExternalServiceRegistration struct {
	// Name is the name of the external service.
	// This is translated to the plugin ID.
	Name string `json:"name,omitempty"`
	// RedirectURI is the URI that is used in the code flow.
	// Note that this is not used yet.
	RedirectURI *string `json:"redirectUri,omitempty"`
	// Impersonation access configuration
	Impersonation ImpersonationCfg `json:"impersonation"`
	// Self access configuration
	Self SelfCfg `json:"self"`
	// Key is the option to specify a public key or ask the server to generate a crypto key pair.
	Key *KeyOption `json:"key,omitempty"`
}

type KeyResult struct {
	URL        string `json:"url,omitempty"`
	PrivatePem string `json:"private,omitempty"`
	PublicPem  string `json:"public,omitempty"`
	Generated  bool   `json:"generated,omitempty"`
}

type ExternalServiceDTO struct {
	Name        string     `json:"name"`
	ID          string     `json:"clientId"`
	Secret      string     `json:"clientSecret"`
	RedirectURI string     `json:"redirectUri,omitempty"` // Not used yet (code flow)
	GrantTypes  string     `json:"grantTypes"`            // CSV value
	Audiences   string     `json:"audiences"`             // CSV value
	KeyResult   *KeyResult `json:"key,omitempty"`
}

type ExternalServiceRegister interface {
	// SaveExternalService creates or updates an external service in the database, it generates client_id and secrets and
	// it ensures that the associated service account has the correct permissions.
	SaveExternalService(ctx context.Context, cmd *ExternalServiceRegistration) (*ExternalServiceDTO, error)
}
