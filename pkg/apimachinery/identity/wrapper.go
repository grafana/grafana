package identity

import (
	"time"

	"github.com/grafana/authlib/claims"
)

var _ claims.IdentityClaims = &IDClaimsWrapper{}
var _ claims.AccessClaims = &IDClaimsWrapper{}

type IDClaimsWrapper struct {
	Source Requester
}

// GetAuthenticatedBy implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetAuthenticatedBy() string {
	return i.Source.GetAuthenticatedBy()
}

// GetDisplayName implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetDisplayName() string {
	return i.Source.GetDisplayName()
}

// GetEmail implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetEmail() string {
	return i.Source.GetEmail()
}

// GetEmailVerified implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetEmailVerified() bool {
	return i.Source.IsEmailVerified()
}

// GetIdentityType implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetIdentityType() claims.IdentityType {
	return i.Source.GetIdentityType()
}

// GetInternalID implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetInternalID() int64 {
	v, _ := i.Source.GetInternalID()
	return v
}

// GetOrgID implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetOrgID() int64 {
	return i.Source.GetOrgID()
}

// GetRawUID implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetRawUID() string {
	return i.Source.GetRawIdentifier()
}

// GetUsername implements claims.IdentityClaims.
func (i *IDClaimsWrapper) GetUsername() string {
	return i.Source.GetLogin()
}

// GetAudience implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetAudience() []string {
	return []string{}
}

// GetDelegatedPermissions implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetDelegatedPermissions() []string {
	return []string{}
}

// GetExpiry implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetExpiry() *time.Time {
	return nil
}

// GetIssuedAt implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetIssuedAt() *time.Time {
	return nil
}

// GetIssuer implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetIssuer() string {
	return ""
}

// GetJTI implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetJTI() string {
	return ""
}

// GetNamespace implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetNamespace() string {
	return i.Source.GetAllowedKubernetesNamespace()
}

// GetNotBefore implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetNotBefore() *time.Time {
	return nil
}

// GetPermissions implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetPermissions() []string {
	return []string{}
}

// GetScopes implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetScopes() []string {
	return []string{}
}

// GetSubject implements claims.AccessClaims.
func (i *IDClaimsWrapper) GetSubject() string {
	return ""
}
