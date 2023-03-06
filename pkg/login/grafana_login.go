package login

import (
	"context"
	"crypto/subtle"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

var validatePassword = func(providedPassword string, userPassword string, userSalt string) error {
	passwordHashed, err := util.EncodePassword(providedPassword, userSalt)
	if err != nil {
		return err
	}
	if subtle.ConstantTimeCompare([]byte(passwordHashed), []byte(userPassword)) != 1 {
		return ErrInvalidCredentials
	}

	return nil
}

var loginUsingGrafanaDB = func(ctx context.Context, query *login.LoginUserQuery, userService user.Service) error {
	userQuery := user.GetUserByLoginQuery{LoginOrEmail: query.Username}

	user, err := userService.GetByLogin(ctx, &userQuery)
	if err != nil {
		return err
	}

	if user.IsDisabled {
		return ErrUserDisabled
	}

	if err := validatePassword(query.Password, user.Password, user.Salt); err != nil {
		return err
	}
	query.User = user
	return nil
}
