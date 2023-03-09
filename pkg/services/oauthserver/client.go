package oauthserver

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"

	"github.com/ory/fosite"
	"golang.org/x/crypto/bcrypt"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

// ParsePublicKeyPem parses the public key from the PEM encoded public key.
func ParsePublicKeyPem(publicPem []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(publicPem)
	if block == nil {
		return nil, errors.New("could not decode PEM block")
	}

	// TODO: use x509.ParsePKIXPublicKey instead?
	return x509.ParsePKCS1PublicKey(block.Bytes)
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
	return &ClientDTO{
		ExternalServiceName: c.ExternalServiceName,
		ID:                  c.ClientID,
		Secret:              c.Secret,
		GrantTypes:          c.GrantTypes,
		RedirectURI:         c.RedirectURI,
		KeyResult: &KeyResult{
			PublicPem: string(c.PublicPem),
		},
	}
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

// GetScopes returns the scopes this client is allowed to request.
func (c *Client) GetScopes() fosite.Arguments {
	// TODO cache scopes in client
	ret := []string{"openid"}

	// Org Scope
	orgScopes := map[string]bool{}
	for _, orgID := range c.OrgIDs {
		if orgID == ac.GlobalOrgID {
			orgScopes[allOrgsOAuthScope] = true
		} else {
			orgScopes[fmt.Sprintf("org.%v", orgID)] = true
		}
	}
	for k := range orgScopes {
		ret = append(ret, k)
	}

	permissionBasedScopes := map[string]bool{}
	for i := range c.SelfPermissions {
		switch c.SelfPermissions[i].Action {
		case "users:impersonate":
			permissionBasedScopes["impersonate"] = true
		case "users:read":
			permissionBasedScopes["profile"] = true
			permissionBasedScopes["email"] = true
		case "users.permissions:read":
			permissionBasedScopes["permissions"] = true
		case "teams:read":
			permissionBasedScopes["teams"] = true
		}
	}
	for k := range permissionBasedScopes {
		ret = append(ret, k)
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
