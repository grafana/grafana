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
	"golang.org/x/crypto/bcrypt"

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
	SignedInUser           *user.SignedInUser
	// Domain           string `xorm:"domain"`
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
	//TODO: see what we do here, the secret should be stored hashed, that means we'd loose the original
	hashedSecret, err := bcrypt.GenerateFromPassword([]byte(c.Secret), 12)
	if err != nil {
		// TODO: log error
		return []byte{}
	}
	return hashedSecret
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

// GetScopes returns the scopes this client is allowed to request.
func (c *Client) GetScopes() fosite.Arguments {
	// TODO cache scopes in client
	ret := c.GetOrgScopes()

	// Org Scope
	if c.SignedInUser != nil && c.SignedInUser.Permissions != nil {
		if permissions, permOk := c.SignedInUser.Permissions[TmpOrgID]; permOk {
			if _, ok := permissions[ac.ActionUsersImpersonate]; ok {
				ret = append(ret, "impersonate")
			}
			if _, ok := permissions[ac.ActionUsersRead]; ok {
				ret = append(ret, "profile", "email")
			}
			if _, ok := permissions[ac.ActionUsersPermissionsRead]; ok {
				ret = append(ret, "permissions")
			}
			if _, ok := permissions[ac.ActionTeamsRead]; ok {
				ret = append(ret, "teams")
			}
		}
	}

	return fosite.Arguments(ret)
}

// GetScopes returns the scopes this client is allowed to request on a specific user.
func (c *Client) GetScopesOnUser(ctx context.Context, accessControl ac.AccessControl, userID int64) fosite.Arguments {
	ret := []string{}
	id := strconv.FormatInt(userID, 10)
	userScope := ac.Scope("users", "id", id)
	globalUserScope := ac.Scope("global.users", "id", id)

	hasAccess := func(action string, scope *string) bool {
		ev := ac.EvalPermission(action)
		if scope != nil {
			ev = ac.EvalPermission(action, *scope)
		}
		hasAccess, errAccess := accessControl.Evaluate(ctx, c.SignedInUser, ev)
		return errAccess == nil && hasAccess
	}

	if hasAccess(ac.ActionUsersImpersonate, &userScope) {
		ret = append(ret, "impersonate")
	}
	if hasAccess(ac.ActionUsersRead, &globalUserScope) {
		ret = append(ret, "profile", "email")
	}
	if hasAccess(ac.ActionUsersPermissionsRead, &userScope) {
		ret = append(ret, "permissions")
	}
	if hasAccess(ac.ActionTeamsRead, nil) {
		ret = append(ret, "teams")
	}

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
