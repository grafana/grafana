package oauthserver

import (
	"context"
	"strconv"
	"strings"

	"github.com/ory/fosite"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/user"
)

type OAuthExternalService struct {
	ID               int64  `xorm:"id pk autoincr"`
	Name             string `xorm:"name"`
	ClientID         string `xorm:"client_id"`
	Secret           string `xorm:"secret"`
	RedirectURI      string `xorm:"redirect_uri"` // Not used yet (code flow)
	GrantTypes       string `xorm:"grant_types"`  // CSV value
	Audiences        string `xorm:"audiences"`    // CSV value
	PublicPem        []byte `xorm:"public_pem"`
	ServiceAccountID int64  `xorm:"service_account_id"`
	// SelfPermissions are the registered service account permissions (registered and managed permissions)
	SelfPermissions []ac.Permission
	// ImpersonatePermissions is the restriction set of permissions while impersonating
	ImpersonatePermissions []ac.Permission

	// SignedInUser refers to the current Service Account identity/user
	SignedInUser      *user.SignedInUser
	Scopes            []string
	ImpersonateScopes []string
}

// ToExternalService converts the ExternalService (used internally by the oauthserver) to extsvcauth.ExternalService (used outside the package)
// If object must contain Key pairs, pass them as parameters, otherwise only the client PublicPem will be added.
func (c *OAuthExternalService) ToExternalService(keys *extsvcauth.KeyResult) *extsvcauth.ExternalService {
	c2 := &extsvcauth.ExternalService{
		ID:     c.ClientID,
		Name:   c.Name,
		Secret: c.Secret,
		OAuthExtra: &extsvcauth.OAuthExtra{
			GrantTypes:  c.GrantTypes,
			Audiences:   c.Audiences,
			RedirectURI: c.RedirectURI,
			KeyResult:   keys,
		},
	}

	// Fallback to only display the public pem
	if keys == nil && len(c.PublicPem) > 0 {
		c2.OAuthExtra.KeyResult = &extsvcauth.KeyResult{PublicPem: string(c.PublicPem)}
	}

	return c2
}

func (c *OAuthExternalService) LogID() string {
	return "{name: " + c.Name + ", clientID: " + c.ClientID + "}"
}

// GetID returns the client ID.
func (c *OAuthExternalService) GetID() string { return c.ClientID }

// GetHashedSecret returns the hashed secret as it is stored in the store.
func (c *OAuthExternalService) GetHashedSecret() []byte {
	// Hashed version is stored in the secret field
	return []byte(c.Secret)
}

// GetRedirectURIs returns the client's allowed redirect URIs.
func (c *OAuthExternalService) GetRedirectURIs() []string {
	return []string{c.RedirectURI}
}

// GetGrantTypes returns the client's allowed grant types.
func (c *OAuthExternalService) GetGrantTypes() fosite.Arguments {
	return strings.Split(c.GrantTypes, ",")
}

// GetResponseTypes returns the client's allowed response types.
// All allowed combinations of response types have to be listed, each combination having
// response types of the combination separated by a space.
func (c *OAuthExternalService) GetResponseTypes() fosite.Arguments {
	return fosite.Arguments{"code"}
}

// GetScopes returns the scopes this client is allowed to request on its own behalf.
func (c *OAuthExternalService) GetScopes() fosite.Arguments {
	if c.Scopes != nil {
		return c.Scopes
	}

	ret := []string{"profile", "email", "groups", "entitlements"}
	if c.SignedInUser != nil && c.SignedInUser.Permissions != nil {
		perms := c.SignedInUser.Permissions[TmpOrgID]
		for action := range perms {
			// Add all actions that the plugin is allowed to request
			ret = append(ret, action)
		}
	}

	c.Scopes = ret
	return ret
}

// GetScopes returns the scopes this client is allowed to request on a specific user.
func (c *OAuthExternalService) GetScopesOnUser(ctx context.Context, accessControl ac.AccessControl, userID int64) []string {
	ev := ac.EvalPermission(ac.ActionUsersImpersonate, ac.Scope("users", "id", strconv.FormatInt(userID, 10)))
	hasAccess, errAccess := accessControl.Evaluate(ctx, c.SignedInUser, ev)
	if errAccess != nil || !hasAccess {
		return nil
	}

	if c.ImpersonateScopes != nil {
		return c.ImpersonateScopes
	}

	ret := []string{}
	if c.ImpersonatePermissions != nil {
		perms := c.ImpersonatePermissions
		for i := range perms {
			if perms[i].Action == ac.ActionUsersRead && perms[i].Scope == ScopeGlobalUsersSelf {
				ret = append(ret, "profile", "email", ac.ActionUsersRead)
				continue
			}
			if perms[i].Action == ac.ActionUsersPermissionsRead && perms[i].Scope == ScopeUsersSelf {
				ret = append(ret, "entitlements", ac.ActionUsersPermissionsRead)
				continue
			}
			if perms[i].Action == ac.ActionTeamsRead && perms[i].Scope == ScopeTeamsSelf {
				ret = append(ret, "groups", ac.ActionTeamsRead)
				continue
			}
			// Add all actions that the plugin is allowed to request
			ret = append(ret, perms[i].Action)
		}
	}

	c.ImpersonateScopes = ret
	return ret
}

// IsPublic returns true, if this client is marked as public.
func (c *OAuthExternalService) IsPublic() bool {
	return false
}

// GetAudience returns the allowed audience(s) for this client.
func (c *OAuthExternalService) GetAudience() fosite.Arguments {
	return strings.Split(c.Audiences, ",")
}
