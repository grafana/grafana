package oauthserver

import (
	"context"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/ory/fosite"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

// ParsePublicKeyPem parses the public key from the PEM encoded public key.
func ParsePublicKeyPem(publicPem []byte) (interface{}, error) {
	block, _ := pem.Decode(publicPem)
	if block == nil {
		return nil, errors.New("could not decode PEM block")
	}

	switch block.Type {
	case "PUBLIC KEY":
		return x509.ParsePKIXPublicKey(block.Bytes)
	case "RSA PUBLIC KEY":
		return x509.ParsePKCS1PublicKey(block.Bytes)
	default:
		return nil, fmt.Errorf("unknown key type %q", block.Type)
	}
}

type KeyResult struct {
	URL        string `json:"url,omitempty"`
	PrivatePem string `json:"private,omitempty"`
	PublicPem  string `json:"public,omitempty"`
	Generated  bool   `json:"generated,omitempty"`
}

type ClientDTO struct {
	ExternalServiceName string     `json:"name"`
	ID                  string     `json:"clientId"`
	Secret              string     `json:"clientSecret"`
	GrantTypes          string     `xorm:"grant_types"` // CSV value
	RedirectURI         string     `json:"redirectUri,omitempty"`
	KeyResult           *KeyResult `json:"key,omitempty"`
}

type Client struct {
	ID                     int64           `xorm:"id pk autoincr"`
	OrgIDs                 []int64         `xorm:"org_id"`
	ExternalServiceName    string          `xorm:"app_name"`
	ClientID               string          `xorm:"client_id"`
	Secret                 string          `xorm:"secret"`
	GrantTypes             string          `xorm:"grant_types"` // CSV value
	PublicPem              []byte          `xorm:"public_pem"`
	ServiceAccountID       int64           `xorm:"service_account_id"`
	SelfPermissions        []ac.Permission `xorm:"self_permissions"`
	ImpersonatePermissions []ac.Permission `xorm:"impersonate_permissions"`
	RedirectURI            string          `xorm:"redirect_uri"`

	SignedInUser      *user.SignedInUser
	Scopes            []string
	ImpersonateScopes []string
}

func (c *Client) ToDTO() *ClientDTO {
	c2 := ClientDTO{
		ExternalServiceName: c.ExternalServiceName,
		ID:                  c.ClientID,
		Secret:              c.Secret,
		GrantTypes:          c.GrantTypes,
		RedirectURI:         c.RedirectURI,
	}
	if len(c.PublicPem) > 0 {
		c2.KeyResult = &KeyResult{PublicPem: string(c.PublicPem)}
	}
	return &c2
}

func (c *Client) LogID() string {
	return "{externalServiceName: " + c.ExternalServiceName + ", clientID: " + c.ClientID + "}"
}

// GetID returns the client ID.
func (c *Client) GetID() string { return c.ClientID }

// GetHashedSecret returns the hashed secret as it is stored in the store.
func (c *Client) GetHashedSecret() []byte {
	// Hashed version is stored in the secret field
	return []byte(c.Secret)
}

// GetRedirectURIs returns the client's allowed redirect URIs.
func (c *Client) GetRedirectURIs() []string {
	return []string{c.RedirectURI}
}

// GetGrantTypes returns the client's allowed grant types.
func (c *Client) GetGrantTypes() fosite.Arguments {
	return fosite.Arguments(strings.Split(c.GrantTypes, ","))
}

// GetResponseTypes returns the client's allowed response types.
// All allowed combinations of response types have to be listed, each combination having
// response types of the combination separated by a space.
func (c *Client) GetResponseTypes() fosite.Arguments {
	// TODO
	return fosite.Arguments{"code"}
}

func (c *Client) GetOpenIDScope() fosite.Arguments {
	return fosite.Arguments([]string{"openid"})
}

func (c *Client) GetOrgScopes() fosite.Arguments {
	ret := []string{}
	for _, orgID := range c.OrgIDs {
		if orgID == ac.GlobalOrgID {
			ret = append(ret, allOrgsOAuthScope)
		} else {
			ret = append(ret, fmt.Sprintf("org.%v", orgID))
		}
	}
	return fosite.Arguments(ret)
}

// GetScopes returns the scopes this client is allowed to request on its behalf.
func (c *Client) GetScopes() fosite.Arguments {
	if c.Scopes != nil {
		return fosite.Arguments(c.Scopes)
	}

	ret := c.GetOrgScopes()
	ret = append(ret, "profile", "email", "groups", "entitlements")

	if c.SignedInUser != nil && c.SignedInUser.Permissions != nil {
		perms := c.SignedInUser.Permissions[TmpOrgID]
		for action := range perms {
			// Add all other action that the plugin is allowed to request
			ret = append(ret, action)
		}
	}

	c.Scopes = ret
	return fosite.Arguments(ret)
}

// GetScopes returns the scopes this client is allowed to request on a specific user.
func (c *Client) GetScopesOnUser(ctx context.Context, accessControl ac.AccessControl, userID int64) fosite.Arguments {
	ev := ac.EvalPermission(ac.ActionUsersImpersonate, ac.Scope("users", "id", strconv.FormatInt(userID, 10)))
	hasAccess, errAccess := accessControl.Evaluate(ctx, c.SignedInUser, ev)
	if errAccess != nil || !hasAccess {
		return nil
	}

	if c.ImpersonateScopes != nil {
		return fosite.Arguments(c.ImpersonateScopes)
	}

	// Org Scope
	ret := c.GetOrgScopes()

	if c.ImpersonatePermissions != nil {
		perms := c.ImpersonatePermissions
		for i := range perms {
			if perms[i].Action == ac.ActionUsersRead && perms[i].Scope == ScopeGlobalUsersSelf {
				ret = append(ret, "profile", "email")
				continue
			}
			if perms[i].Action == ac.ActionUsersPermissionsRead && perms[i].Scope == ScopeUsersSelf {
				ret = append(ret, "entitlements")
				continue
			}
			if perms[i].Action == ac.ActionTeamsRead && perms[i].Scope == ScopeTeamsSelf {
				ret = append(ret, "groups")
				continue
			}
			// Add all other action that the plugin is allowed to request
			ret = append(ret, perms[i].Action)
		}
	}

	c.ImpersonateScopes = ret
	return fosite.Arguments(ret)
}

// IsPublic returns true, if this client is marked as public.
func (c *Client) IsPublic() bool {
	return false
}

// GetAudience returns the allowed audience(s) for this client.
func (c *Client) GetAudience() fosite.Arguments {
	// TODO: This is to be inline with the PoC, check what we should really return here
	return fosite.Arguments{c.ClientID}
}
