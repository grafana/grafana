package authinfoimpl

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

type Store struct {
	sqlStore       db.DB
	secretsService secrets.Service
	logger         log.Logger
}

func ProvideStore(sqlStore db.DB, secretsService secrets.Service) login.Store {
	store := &Store{
		sqlStore:       sqlStore,
		secretsService: secretsService,
		logger:         log.New("login.authinfo.store"),
	}

	return store
}

// GetAuthInfo returns the auth info for a user
// It will return the latest auth info for a user
func (s *Store) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
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

func (s *Store) GetUserLabels(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
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

func (s *Store) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	authUser := &login.UserAuth{
		UserId:      cmd.UserId,
		AuthModule:  cmd.AuthModule,
		AuthId:      cmd.AuthId,
		ExternalUID: cmd.ExternalUID,
		Created:     GetTime(),
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

func (s *Store) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	authUser := &login.UserAuth{
		UserId:      cmd.UserId,
		AuthModule:  cmd.AuthModule,
		AuthId:      cmd.AuthId,
		Created:     GetTime(),
		ExternalUID: cmd.ExternalUID,
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
		upd, err := sess.MustCols("o_auth_expiry", "o_auth_access_token", "o_auth_refresh_token", "o_auth_id_token", "o_auth_token_type").
			Where("user_id = ? AND auth_module = ?", cmd.UserId, cmd.AuthModule).
			Update(authUser)

		s.logger.Debug("Updated user_auth", "user_id", cmd.UserId, "auth_id", cmd.AuthId, "auth_module", cmd.AuthModule, "rows", upd)

		// Clean up duplicated entries
		if upd > 1 {
			var id int64
			ok, err := sess.SQL(
				"SELECT id FROM user_auth WHERE user_id = ? AND auth_module = ? AND auth_id = ?",
				cmd.UserId, cmd.AuthModule, cmd.AuthId,
			).Get(&id)
			if err != nil {
				return err
			}

			if !ok {
				return nil
			}

			_, err = sess.Exec(
				"DELETE FROM user_auth WHERE user_id = ? AND auth_module = ? AND auth_id = ? AND id != ?",
				cmd.UserId, cmd.AuthModule, cmd.AuthId, id,
			)
			return err
		}

		return err
	})
}

func (s *Store) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "DELETE FROM user_auth WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}

// decodeAndDecrypt will decode the string with the standard base64 decoder and then decrypt it
func (s *Store) decodeAndDecrypt(str string) (string, error) {
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
func (s *Store) encryptAndEncode(str string) (string, error) {
	encrypted, err := s.secretsService.Encrypt(context.Background(), []byte(str), secrets.WithoutScope())
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}
