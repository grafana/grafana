package authtoken

import (
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"

	"gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "JWTService",
		Instance:     &JWT{},
		InitPriority: registry.High,
	})
}

type JWT struct {
	Cfg *setting.Cfg `inject:""`

	rsaSigner     jose.Signer
	rsaPrivateKey *rsa.PrivateKey
}

func (j *JWT) Init() error {
	rsaPrivateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	j.rsaPrivateKey = rsaPrivateKey
	signer, err := newInMemoryRSASigner(rsaPrivateKey)
	if err != nil {
		return err
	}
	j.rsaSigner = signer
	return nil
}

func newInMemoryRSASigner(rsaPrivateKey *rsa.PrivateKey) (jose.Signer, error) {
	algorithm := jose.RS256
	return jose.NewSigner(jose.SigningKey{Algorithm: algorithm, Key: rsaPrivateKey}, (&jose.SignerOptions{}).WithType("JWT"))
}

type IdentityTokenClaims struct {
	jwt.Claims
	Identity
}

func (j *JWT) IssuePluginToken(pluginID string, orgID int64) (string, error) {
	stdClaims := jwt.Claims{
		Subject: fmt.Sprintf("plugin:%d-%s", orgID, pluginID),
		Issuer:  "grafana",
	}
	idClaims := IdentityTokenClaims{
		Claims: stdClaims,
		Identity: Identity{
			Type: IdentityTypePlugin,
			PluginIdentity: &PluginIdentity{
				PluginID: pluginID,
				OrgID:    orgID,
			},
		},
	}
	return jwt.Signed(j.rsaSigner).Claims(idClaims).CompactSerialize()
}

func (j *JWT) IssueUserToken(user *models.SignedInUser) (string, error) {
	stdClaims := jwt.Claims{
		Subject: fmt.Sprintf("user:%d-%d", user.OrgId, user.UserId),
		Issuer:  "grafana",
	}
	idClaims := IdentityTokenClaims{
		Claims: stdClaims,
		Identity: Identity{
			Type: IdentityTypeUser,
			UserIdentity: &UserIdentity{
				OrgID:  user.OrgId,
				UserID: user.UserId,
			},
		},
	}
	return jwt.Signed(j.rsaSigner).Claims(idClaims).CompactSerialize()
}

var errEmptyIdentityType = errors.New("empty identity type")
var errEmptyIdentityMeta = errors.New("empty identity meta")

func (j *JWT) ValidateToken(rawToken string) (*Identity, error) {
	token, err := jwt.ParseSigned(rawToken)
	if err != nil {
		return nil, err
	}
	var idClaims IdentityTokenClaims
	err = token.Claims(&j.rsaPrivateKey.PublicKey, &idClaims)
	if err != nil {
		return nil, err
	}
	err = idClaims.Claims.Validate(jwt.Expected{
		Issuer: "grafana",
		Time:   time.Now(),
	})
	if err != nil {
		return nil, err
	}
	if string(idClaims.Identity.Type) == "" {
		return nil, errEmptyIdentityType
	}
	switch idClaims.Identity.Type {
	case IdentityTypeUser:
		if idClaims.UserIdentity == nil {
			return nil, errEmptyIdentityMeta
		}
	case IdentityTypePlugin:
		if idClaims.PluginIdentity == nil {
			return nil, errEmptyIdentityMeta
		}
	}
	return &idClaims.Identity, nil
}
