package database

import (
	"context"
	"encoding/base64"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/user"
)

var GetTime = time.Now

type AuthInfoStore struct {
	sqlStore       db.DB
	secretsService secrets.Service
	logger         log.Logger
	userService    user.Service
}

func ProvideAuthInfoStore(sqlStore db.DB, secretsService secrets.Service, userService user.Service) login.Store {
	store := &AuthInfoStore{
		sqlStore:       sqlStore,
		secretsService: secretsService,
		logger:         log.New("login.authinfo.store"),
		userService:    userService,
	}
	// FIXME: disabled the metric collection for duplicate user entries
	// due to query performance issues that is clogging the users Grafana instance
	// InitDuplicateUserMetrics()
	return store
}

func (s *AuthInfoStore) GetExternalUserInfoByLogin(ctx context.Context, query *login.GetExternalUserInfoByLoginQuery) (*login.ExternalUserInfo, error) {
	userQuery := user.GetUserByLoginQuery{LoginOrEmail: query.LoginOrEmail}
	usr, err := s.userService.GetByLogin(ctx, &userQuery)
	if err != nil {
		return nil, err
	}

	authInfoQuery := &login.GetAuthInfoQuery{UserId: usr.ID}
	authInfo, err := s.GetAuthInfo(ctx, authInfoQuery)
	if err != nil {
		return nil, err
	}

	result := &login.ExternalUserInfo{
		UserId:     usr.ID,
		Login:      usr.Login,
		Email:      usr.Email,
		Name:       usr.Name,
		IsDisabled: usr.IsDisabled,
		AuthModule: authInfo.AuthModule,
		AuthId:     authInfo.AuthId,
	}
	return result, nil
}

// GetAuthInfo returns the auth info for a user
// It will return the latest auth info for a user
func (s *AuthInfoStore) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	if query.UserId == 0 && query.AuthId == "" {
		return nil, user.ErrUserNotFound
	}

	userAuth := &login.UserAuth{
		UserId:     query.UserId,
		AuthModule: query.AuthModule,
		AuthId:     query.AuthId,
	}

	var has bool
	var err error

	err = s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		has, err = sess.Desc("created").Get(userAuth)
		return err
	})
	if err != nil {
		return nil, err
	}

	if !has {
		return nil, user.ErrUserNotFound
	}

	secretAccessToken, err := s.decodeAndDecrypt(userAuth.OAuthAccessToken)
	if err != nil {
		return nil, err
	}
	secretRefreshToken, err := s.decodeAndDecrypt(userAuth.OAuthRefreshToken)
	if err != nil {
		return nil, err
	}
	secretTokenType, err := s.decodeAndDecrypt(userAuth.OAuthTokenType)
	if err != nil {
		return nil, err
	}
	secretIdToken, err := s.decodeAndDecrypt(userAuth.OAuthIdToken)
	if err != nil {
		return nil, err
	}
	userAuth.OAuthAccessToken = secretAccessToken
	userAuth.OAuthRefreshToken = secretRefreshToken
	userAuth.OAuthTokenType = secretTokenType
	userAuth.OAuthIdToken = secretIdToken

	return userAuth, nil
}

func (s *AuthInfoStore) GetUserLabels(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	userAuths := []login.UserAuth{}
	params := make([]interface{}, 0, len(query.UserIDs))
	for _, id := range query.UserIDs {
		params = append(params, id)
	}

	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table("user_auth").In("user_id", params).OrderBy("created").Find(&userAuths)
	})

	if err != nil {
		return nil, err
	}

	labelMap := make(map[int64]string, len(userAuths))

	for i := range userAuths {
		labelMap[userAuths[i].UserId] = userAuths[i].AuthModule
	}

	return labelMap, nil
}

func (s *AuthInfoStore) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	authUser := &login.UserAuth{
		UserId:     cmd.UserId,
		AuthModule: cmd.AuthModule,
		AuthId:     cmd.AuthId,
		Created:    GetTime(),
	}

	if cmd.OAuthToken != nil {
		secretAccessToken, err := s.encryptAndEncode(cmd.OAuthToken.AccessToken)
		if err != nil {
			return err
		}
		secretRefreshToken, err := s.encryptAndEncode(cmd.OAuthToken.RefreshToken)
		if err != nil {
			return err
		}
		secretTokenType, err := s.encryptAndEncode(cmd.OAuthToken.TokenType)
		if err != nil {
			return err
		}

		var secretIdToken string
		if idToken, ok := cmd.OAuthToken.Extra("id_token").(string); ok && idToken != "" {
			secretIdToken, err = s.encryptAndEncode(idToken)
			if err != nil {
				return err
			}
		}

		authUser.OAuthAccessToken = secretAccessToken
		authUser.OAuthRefreshToken = secretRefreshToken
		authUser.OAuthTokenType = secretTokenType
		authUser.OAuthIdToken = secretIdToken
		authUser.OAuthExpiry = cmd.OAuthToken.Expiry
	}

	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(authUser)
		return err
	})
}

// UpdateAuthInfoDate updates the auth info for the user with the latest date.
// Avoids overlapping entries hiding the last used one (ex: LDAP->SAML->LDAP).
func (s *AuthInfoStore) UpdateAuthInfoDate(ctx context.Context, authInfo *login.UserAuth) error {
	authInfo.Created = GetTime()

	cond := &login.UserAuth{
		Id:         authInfo.Id,
		UserId:     authInfo.UserId,
		AuthModule: authInfo.AuthModule,
	}
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Cols("created").Update(authInfo, cond)
		return err
	})
}

func (s *AuthInfoStore) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	authUser := &login.UserAuth{
		UserId:     cmd.UserId,
		AuthModule: cmd.AuthModule,
		AuthId:     cmd.AuthId,
		Created:    GetTime(),
	}

	if cmd.OAuthToken != nil {
		secretAccessToken, err := s.encryptAndEncode(cmd.OAuthToken.AccessToken)
		if err != nil {
			return err
		}
		secretRefreshToken, err := s.encryptAndEncode(cmd.OAuthToken.RefreshToken)
		if err != nil {
			return err
		}
		secretTokenType, err := s.encryptAndEncode(cmd.OAuthToken.TokenType)
		if err != nil {
			return err
		}

		var secretIdToken string
		if idToken, ok := cmd.OAuthToken.Extra("id_token").(string); ok && idToken != "" {
			secretIdToken, err = s.encryptAndEncode(idToken)
			if err != nil {
				return err
			}
		}

		authUser.OAuthAccessToken = secretAccessToken
		authUser.OAuthRefreshToken = secretRefreshToken
		authUser.OAuthTokenType = secretTokenType
		authUser.OAuthIdToken = secretIdToken
		authUser.OAuthExpiry = cmd.OAuthToken.Expiry
	}

	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		upd, err := sess.MustCols("o_auth_expiry").Where("user_id = ? AND auth_module = ?", cmd.UserId, cmd.AuthModule).Update(authUser)
		s.logger.Debug("Updated user_auth", "user_id", cmd.UserId,
			"auth_id", cmd.AuthId, "auth_module", cmd.AuthModule, "rows", upd)
		return err
	})
}

func (s *AuthInfoStore) DeleteAuthInfo(ctx context.Context, cmd *login.DeleteAuthInfoCommand) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Delete(cmd.UserAuth)
		return err
	})
}

func (s *AuthInfoStore) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM user_auth WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}

func (s *AuthInfoStore) GetUserById(ctx context.Context, id int64) (*user.User, error) {
	query := user.GetUserByIDQuery{ID: id}
	user, err := s.userService.GetByID(ctx, &query)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *AuthInfoStore) GetUserByLogin(ctx context.Context, login string) (*user.User, error) {
	query := user.GetUserByLoginQuery{LoginOrEmail: login}
	usr, err := s.userService.GetByLogin(ctx, &query)
	if err != nil {
		return nil, err
	}

	return usr, nil
}

func (s *AuthInfoStore) GetUserByEmail(ctx context.Context, email string) (*user.User, error) {
	query := user.GetUserByEmailQuery{Email: email}
	usr, err := s.userService.GetByEmail(ctx, &query)
	if err != nil {
		return nil, err
	}

	return usr, nil
}

// decodeAndDecrypt will decode the string with the standard base64 decoder and then decrypt it
func (s *AuthInfoStore) decodeAndDecrypt(str string) (string, error) {
	// Bail out if empty string since it'll cause a segfault in Decrypt
	if str == "" {
		return "", nil
	}
	decoded, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return "", err
	}
	decrypted, err := s.secretsService.Decrypt(context.Background(), decoded)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}

// encryptAndEncode will encrypt a string with grafana's secretKey, and
// then encode it with the standard bas64 encoder
func (s *AuthInfoStore) encryptAndEncode(str string) (string, error) {
	encrypted, err := s.secretsService.Encrypt(context.Background(), []byte(str), secrets.WithoutScope())
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}
