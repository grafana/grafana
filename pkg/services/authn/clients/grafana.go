package clients

import (
	"context"
	"crypto/subtle"
	"errors"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

var _ authn.PasswordClient = new(Grafana)

func ProvideGrafana(userService user.Service) *Grafana {
	return &Grafana{userService}
}

type Grafana struct {
	userService user.Service
}

func (c Grafana) AuthenticatePassword(ctx context.Context, orgID int64, username, password string) (*authn.Identity, error) {
	usr, err := c.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: username})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, errIdentityNotFound.Errorf("no user fund: %w", err)
		}
		return nil, err
	}

	if ok := comparePassword(password, usr.Salt, usr.Password); !ok {
		return nil, errInvalidPassword.Errorf("invalid password")
	}

	signedInUser, err := c.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{OrgID: orgID, UserID: usr.ID})
	if err != nil {
		return nil, err
	}

	return authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, signedInUser.UserID), signedInUser, authn.ClientParams{}), nil
}

func comparePassword(password, salt, hash string) bool {
	// It is ok to ignore the error here because util.EncodePassword can never return a error
	hashedPassword, _ := util.EncodePassword(password, salt)
	return subtle.ConstantTimeCompare([]byte(hashedPassword), []byte(hash)) == 1
}
