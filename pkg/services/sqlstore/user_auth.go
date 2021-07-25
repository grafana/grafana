package sqlstore

import (
	"encoding/base64"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var getTime = time.Now

const genericOAuthModule = "oauth_generic_oauth"

func init() {
	bus.AddHandler("sql", GetExternalUserInfoByLogin)
	bus.AddHandler("sql", GetAuthInfo)
	bus.AddHandler("sql", SetAuthInfo)
	bus.AddHandler("sql", UpdateAuthInfo)
	bus.AddHandler("sql", DeleteAuthInfo)
}

func GetExternalUserInfoByLogin(query *models.GetExternalUserInfoByLoginQuery) error {
	userQuery := models.GetUserByLoginQuery{LoginOrEmail: query.LoginOrEmail}
	err := bus.Dispatch(&userQuery)
	if err != nil {
		return err
	}

	authInfoQuery := &models.GetAuthInfoQuery{UserId: userQuery.Result.Id}
	if err := bus.Dispatch(authInfoQuery); err != nil {
		return err
	}

	query.Result = &models.ExternalUserInfo{
		UserId:     userQuery.Result.Id,
		Login:      userQuery.Result.Login,
		Email:      userQuery.Result.Email,
		Name:       userQuery.Result.Name,
		IsDisabled: userQuery.Result.IsDisabled,
		AuthModule: authInfoQuery.Result.AuthModule,
		AuthId:     authInfoQuery.Result.AuthId,
	}
	return nil
}

func GetAuthInfo(query *models.GetAuthInfoQuery) error {
	userAuth := &models.UserAuth{
		UserId:     query.UserId,
		AuthModule: query.AuthModule,
		AuthId:     query.AuthId,
	}
	has, err := x.Desc("created").Get(userAuth)
	if err != nil {
		return err
	}

	if !has {
		return models.ErrUserNotFound
	}

	secretAccessToken, err := decodeAndDecrypt(userAuth.OAuthAccessToken)
	if err != nil {
		return err
	}
	secretRefreshToken, err := decodeAndDecrypt(userAuth.OAuthRefreshToken)
	if err != nil {
		return err
	}
	secretTokenType, err := decodeAndDecrypt(userAuth.OAuthTokenType)
	if err != nil {
		return err
	}
	userAuth.OAuthAccessToken = secretAccessToken
	userAuth.OAuthRefreshToken = secretRefreshToken
	userAuth.OAuthTokenType = secretTokenType

	query.Result = userAuth
	return nil
}

func SetAuthInfo(cmd *models.SetAuthInfoCommand) error {
	return inTransaction(func(sess *DBSession) error {
		authUser := &models.UserAuth{
			UserId:     cmd.UserId,
			AuthModule: cmd.AuthModule,
			AuthId:     cmd.AuthId,
			Created:    getTime(),
		}

		if cmd.OAuthToken != nil {
			secretAccessToken, err := encryptAndEncode(cmd.OAuthToken.AccessToken)
			if err != nil {
				return err
			}
			secretRefreshToken, err := encryptAndEncode(cmd.OAuthToken.RefreshToken)
			if err != nil {
				return err
			}
			secretTokenType, err := encryptAndEncode(cmd.OAuthToken.TokenType)
			if err != nil {
				return err
			}

			authUser.OAuthAccessToken = secretAccessToken
			authUser.OAuthRefreshToken = secretRefreshToken
			authUser.OAuthTokenType = secretTokenType
			authUser.OAuthExpiry = cmd.OAuthToken.Expiry
		}

		_, err := sess.Insert(authUser)
		return err
	})
}

func UpdateAuthInfo(cmd *models.UpdateAuthInfoCommand) error {
	return inTransaction(func(sess *DBSession) error {
		authUser := &models.UserAuth{
			UserId:     cmd.UserId,
			AuthModule: cmd.AuthModule,
			AuthId:     cmd.AuthId,
			Created:    getTime(),
		}

		if cmd.OAuthToken != nil {
			secretAccessToken, err := encryptAndEncode(cmd.OAuthToken.AccessToken)
			if err != nil {
				return err
			}
			secretRefreshToken, err := encryptAndEncode(cmd.OAuthToken.RefreshToken)
			if err != nil {
				return err
			}
			secretTokenType, err := encryptAndEncode(cmd.OAuthToken.TokenType)
			if err != nil {
				return err
			}

			authUser.OAuthAccessToken = secretAccessToken
			authUser.OAuthRefreshToken = secretRefreshToken
			authUser.OAuthTokenType = secretTokenType
			authUser.OAuthExpiry = cmd.OAuthToken.Expiry
		}

		cond := &models.UserAuth{
			UserId:     cmd.UserId,
			AuthModule: cmd.AuthModule,
		}
		upd, err := sess.Update(authUser, cond)
		sqlog.Debug("Updated user_auth", "user_id", cmd.UserId, "auth_module", cmd.AuthModule, "rows", upd)
		return err
	})
}

func DeleteAuthInfo(cmd *models.DeleteAuthInfoCommand) error {
	return inTransaction(func(sess *DBSession) error {
		_, err := sess.Delete(cmd.UserAuth)
		return err
	})
}

// decodeAndDecrypt will decode the string with the standard bas64 decoder
// and then decrypt it with grafana's secretKey
func decodeAndDecrypt(s string) (string, error) {
	// Bail out if empty string since it'll cause a segfault in util.Decrypt
	if s == "" {
		return "", nil
	}
	decoded, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return "", err
	}
	decrypted, err := util.Decrypt(decoded, setting.SecretKey)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}

// encryptAndEncode will encrypt a string with grafana's secretKey, and
// then encode it with the standard bas64 encoder
func encryptAndEncode(s string) (string, error) {
	encrypted, err := util.Encrypt([]byte(s), setting.SecretKey)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}
