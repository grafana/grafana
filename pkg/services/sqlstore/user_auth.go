package sqlstore

import (
	"encoding/base64"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var getTime = time.Now

func init() {
	bus.AddHandler("sql", GetUserByAuthInfo)
	bus.AddHandler("sql", GetAuthInfo)
	bus.AddHandler("sql", SetAuthInfo)
	bus.AddHandler("sql", UpdateAuthInfo)
	bus.AddHandler("sql", DeleteAuthInfo)
}

func GetUserByAuthInfo(query *m.GetUserByAuthInfoQuery) error {
	user := &m.User{}
	has := false
	var err error
	authQuery := &m.GetAuthInfoQuery{}

	// Try to find the user by auth module and id first
	if query.AuthModule != "" && query.AuthId != "" {
		authQuery.AuthModule = query.AuthModule
		authQuery.AuthId = query.AuthId

		err = GetAuthInfo(authQuery)
		if err != m.ErrUserNotFound {
			if err != nil {
				return err
			}

			// if user id was specified and doesn't match the user_auth entry, remove it
			if query.UserId != 0 && query.UserId != authQuery.Result.UserId {
				err = DeleteAuthInfo(&m.DeleteAuthInfoCommand{
					UserAuth: authQuery.Result,
				})
				if err != nil {
					sqlog.Error("Error removing user_auth entry", "error", err)
				}

				authQuery.Result = nil
			} else {
				has, err = x.Id(authQuery.Result.UserId).Get(user)
				if err != nil {
					return err
				}

				if !has {
					// if the user has been deleted then remove the entry
					err = DeleteAuthInfo(&m.DeleteAuthInfoCommand{
						UserAuth: authQuery.Result,
					})
					if err != nil {
						sqlog.Error("Error removing user_auth entry", "error", err)
					}

					authQuery.Result = nil
				}
			}
		}
	}

	// If not found, try to find the user by id
	if !has && query.UserId != 0 {
		has, err = x.Id(query.UserId).Get(user)
		if err != nil {
			return err
		}
	}

	// If not found, try to find the user by email address
	if !has && query.Email != "" {
		user = &m.User{Email: query.Email}
		has, err = x.Get(user)
		if err != nil {
			return err
		}
	}

	// If not found, try to find the user by login
	if !has && query.Login != "" {
		user = &m.User{Login: query.Login}
		has, err = x.Get(user)
		if err != nil {
			return err
		}
	}

	// No user found
	if !has {
		return m.ErrUserNotFound
	}

	// create authInfo record to link accounts
	if authQuery.Result == nil && query.AuthModule != "" {
		cmd2 := &m.SetAuthInfoCommand{
			UserId:     user.Id,
			AuthModule: query.AuthModule,
			AuthId:     query.AuthId,
		}
		if err := SetAuthInfo(cmd2); err != nil {
			return err
		}
	}

	query.Result = user
	return nil
}

func GetAuthInfo(query *m.GetAuthInfoQuery) error {
	userAuth := &m.UserAuth{
		UserId:     query.UserId,
		AuthModule: query.AuthModule,
		AuthId:     query.AuthId,
	}
	has, err := x.Desc("created").Get(userAuth)
	if err != nil {
		return err
	}
	if !has {
		return m.ErrUserNotFound
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

func SetAuthInfo(cmd *m.SetAuthInfoCommand) error {
	return inTransaction(func(sess *DBSession) error {
		authUser := &m.UserAuth{
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

func UpdateAuthInfo(cmd *m.UpdateAuthInfoCommand) error {
	return inTransaction(func(sess *DBSession) error {
		authUser := &m.UserAuth{
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

		cond := &m.UserAuth{
			UserId:     cmd.UserId,
			AuthModule: cmd.AuthModule,
		}

		_, err := sess.Update(authUser, cond)
		return err
	})
}

func DeleteAuthInfo(cmd *m.DeleteAuthInfoCommand) error {
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
