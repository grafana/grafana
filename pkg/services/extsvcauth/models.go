package extsvcauth

import (
	"context"

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	OAuth2Server AuthProvider = "OAuth2Server"

	// TmpOrgID is the orgID we use while global service accounts are not supported.
	TmpOrgID int64 = 1
)

type AuthProvider string

type ExternalServiceRegistry interface {
	// SaveExternalService creates or updates an external service in the database. Based on the requested auth provider,
	// it generates client_id, secrets and any additional provider specificities (ex: rsa keys). It also ensures that the
	// associated service account has the correct permissions.
	SaveExternalService(ctx context.Context, cmd *ExternalServiceRegistration) (*ExternalService, error)
}

//go:generate mockery --name ExtSvcAccountsService --structname MockExtSvcAccountsService --output extsvcmocks --outpkg extsvcmocks --filename extsvcaccmock.go
type ExtSvcAccountsService interface {
	// ManageExtSvcAccount creates, updates or deletes the service account associated with an external service
	ManageExtSvcAccount(ctx context.Context, cmd *ManageExtSvcAccountCmd) (int64, error)
	// RetrieveExtSvcAccount fetches an external service account by ID
	RetrieveExtSvcAccount(ctx context.Context, orgID, saID int64) (*ExtSvcAccount, error)
}

// ExtSvcAccount represents the service account associated to an external service
type ExtSvcAccount struct {
	ID         int64
	Login      string
	Name       string
	OrgID      int64
	IsDisabled bool
	Role       roletype.RoleType
}

type ManageExtSvcAccountCmd struct {
	ExtSvcSlug  string
	Enabled     bool // disabled: the service account and its permissions will be deleted
	OrgID       int64
	Permissions []accesscontrol.Permission
}

type SelfCfg struct {
	// Enabled allows the service to request access tokens for itself
	Enabled bool
	// Permissions are the permissions that the external service needs its associated service account to have.
	Permissions []accesscontrol.Permission
}

type ImpersonationCfg struct {
	// Enabled allows the service to request access tokens to impersonate users
	Enabled bool
	// Groups allows the service to list the impersonated user's teams
	Groups bool
	// Permissions are the permissions that the external service needs when impersonating a user.
	// The intersection of this set with the impersonated user's permission guarantees that the client will not
	// gain more privileges than the impersonated user has and vice versa.
	Permissions []accesscontrol.Permission
}

// ExternalServiceRegistration represents the registration form to save new client.
type ExternalServiceRegistration struct {
	Name string
	// Impersonation access configuration
	// (this is not available on all auth providers)
	Impersonation ImpersonationCfg
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
