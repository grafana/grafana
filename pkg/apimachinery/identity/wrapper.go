package identity

import (
	"strings"
	"time"

	"github.com/grafana/authlib/claims"
)

var _ claims.IdentityClaims = &IDClaimsWrapper{}
var _ claims.AccessClaims = &IDClaimsWrapper{}

type IDClaimsWrapper struct {
	Source Requester
}

func (i *IDClaimsWrapper) NamespaceMatches(namespace string) bool {
	// for multi-tenant operators, access tokens will have a namespace claim of "*"
	// an argument of "*" can be passed in to determine cluster-scoped access
	simpleCase := i.Source.GetAllowedKubernetesNamespace() == namespace
	if simpleCase {
		return true
	}

	// for more ambiguous stack namespace claim checks
	parts := strings.Split(i.Source.GetAllowedKubernetesNamespace(), "-")
	if len(parts) < 2 {
		return false
	}

	namespaceParts := strings.Split(namespace, "-")
	if len(namespaceParts) < 2 {
		return false
	}

	if (parts[0] == "stack" || parts[0] == "stacks") && (namespaceParts[0] == "stack" || namespaceParts[0] == "stacks") {
		return namespaceParts[1] == parts[1]
	}

	return false
}

func (i *IDClaimsWrapper) IsNil() bool {
	return i.Source.IsNil()
}

// GetAuthenticatedBy implements claims.IdentityClaims.
func (i *IDClaimsWrapper) AuthenticatedBy() string {
	return i.Source.GetAuthenticatedBy()
}

// GetDisplayName implements claims.IdentityClaims.
func (i *IDClaimsWrapper) DisplayName() string {
	return i.Source.GetDisplayName()
}

// GetEmail implements claims.IdentityClaims.
func (i *IDClaimsWrapper) Email() string {
	return i.Source.GetEmail()
}

// GetEmailVerified implements claims.IdentityClaims.
func (i *IDClaimsWrapper) EmailVerified() bool {
	return i.Source.IsEmailVerified()
}

// GetIdentityType implements claims.IdentityClaims.
func (i *IDClaimsWrapper) IdentityType() claims.IdentityType {
	return i.Source.GetIdentityType()
}

// GetRawUID implements claims.IdentityClaims.
func (i *IDClaimsWrapper) Identifier() string {
	return i.Source.GetRawIdentifier()
}

// GetUsername implements claims.IdentityClaims.
func (i *IDClaimsWrapper) Username() string {
	return i.Source.GetLogin()
}

// GetAudience implements claims.AccessClaims.
func (i *IDClaimsWrapper) Audience() []string {
	return []string{}
}

// GetDelegatedPermissions implements claims.AccessClaims.
func (i *IDClaimsWrapper) DelegatedPermissions() []string {
	return []string{}
}

// GetExpiry implements claims.AccessClaims.
func (i *IDClaimsWrapper) Expiry() *time.Time {
	return nil
}

// GetIssuedAt implements claims.AccessClaims.
func (i *IDClaimsWrapper) IssuedAt() *time.Time {
	return nil
}

// GetIssuer implements claims.AccessClaims.
func (i *IDClaimsWrapper) Issuer() string {
	return ""
}

// GetJTI implements claims.AccessClaims.
func (i *IDClaimsWrapper) JTI() string {
	return ""
}

// GetNamespace implements claims.AccessClaims.
func (i *IDClaimsWrapper) Namespace() string {
	return i.Source.GetAllowedKubernetesNamespace()
}

// GetNotBefore implements claims.AccessClaims.
func (i *IDClaimsWrapper) NotBefore() *time.Time {
	return nil
}

// GetPermissions implements claims.AccessClaims.
func (i *IDClaimsWrapper) Permissions() []string {
	return []string{}
}

// GetScopes implements claims.AccessClaims.
func (i *IDClaimsWrapper) Scopes() []string {
	return []string{}
}

// GetSubject implements claims.AccessClaims.
func (i *IDClaimsWrapper) Subject() string {
	return ""
}
