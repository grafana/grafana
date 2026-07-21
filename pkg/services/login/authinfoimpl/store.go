package authinfoimpl

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var GetTime = time.Now

type Store struct {
	sql            legacysql.LegacyDatabaseProvider
	secretsService secrets.Service //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	logger         log.Logger
}

func ProvideStore(ctx context.Context, sql legacysql.LegacyDatabaseProvider,
	secretsService secrets.Service, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
) (login.Store, error) {
	store := &Store{
		sql:            sql,
		secretsService: secretsService,
		logger:         log.New("login.authinfo.store"),
	}

	if err := store.authInfoUserUIDMigration(ctx); err != nil {
		return nil, err
	}

	return store, nil
}

type getAuthInfoQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable string
	UserID        int64
	AuthModule    string
	AuthID        string
}

func (q getAuthInfoQuery) Validate() error { return nil }

// GetAuthInfo returns the auth info for a user
// It will return the latest auth info for a user
func (s *Store) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	if query.UserId == 0 && query.AuthId == "" {
		return nil, user.ErrUserNotFound
	}

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	userAuth := &login.UserAuth{}
	var has bool
	err = dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		dbQuery := getAuthInfoQuery{
			SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
			UserAuthTable: dbHelper.Table("user_auth"),
			UserID:        query.UserId,
			AuthModule:    query.AuthModule,
			AuthID:        query.AuthId,
		}
		querySQL, err := sqltemplate.Execute(getAuthInfoTemplate, dbQuery)
		if err != nil {
			return err
		}

		has, err = sess.SQL(querySQL, dbQuery.GetArgs()...).Get(userAuth)
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

type getUsersRecentlyUsedLabelQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable string
	UserIDs       []int64
}

func (q getUsersRecentlyUsedLabelQuery) Validate() error { return nil }

func (s *Store) GetUsersRecentlyUsedLabel(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	userAuths := []login.UserAuth{}
	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		dbQuery := getUsersRecentlyUsedLabelQuery{
			SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
			UserAuthTable: dbHelper.Table("user_auth"),
			UserIDs:       query.UserIDs,
		}
		querySQL, err := sqltemplate.Execute(getUsersRecentlyUsedLabelTemplate, dbQuery)
		if err != nil {
			return err
		}

		return sess.SQL(querySQL, dbQuery.GetArgs()...).Find(&userAuths)
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

type getUserAuthModulesQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable string
	UserID        int64
}

func (q getUserAuthModulesQuery) Validate() error { return nil }

// GetUserAuthModules returns all auth modules a user has used ordered by most recently used first.
func (s *Store) GetUserAuthModules(ctx context.Context, userID int64) ([]string, error) {
	rows := make([]struct {
		AuthModule string `xorm:"auth_module"`
	}, 0)
	dbHelper, err := s.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		dbQuery := getUserAuthModulesQuery{
			SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
			UserAuthTable: dbHelper.Table("user_auth"),
			UserID:        userID,
		}
		querySQL, err := sqltemplate.Execute(getUserAuthModulesTemplate, dbQuery)
		if err != nil {
			return err
		}

		return sess.SQL(querySQL, dbQuery.GetArgs()...).Find(&rows)
	})
	if err != nil {
		return nil, err
	}
	modules := make([]string, 0, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for _, r := range rows {
		if _, ok := seen[r.AuthModule]; ok {
			continue
		}
		seen[r.AuthModule] = struct{}{}
		modules = append(modules, r.AuthModule)
	}
	return modules, nil
}

type insertAuthInfoQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable     string
	UserID            int64
	UserUID           string
	AuthModule        string
	AuthID            string
	Created           legacysql.DBTime
	OAuthAccessToken  string
	OAuthRefreshToken string
	OAuthIDToken      string
	OAuthTokenType    string
	OAuthExpiry       legacysql.DBTime
	ExternalUID       string
}

func (q insertAuthInfoQuery) Validate() error { return nil }

func (s *Store) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	authUser := &login.UserAuth{
		UserId:      cmd.UserId,
		UserUID:     cmd.UserUID,
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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		dbQuery := insertAuthInfoQuery{
			SQLTemplate:       sqltemplate.New(dbHelper.DialectForDriver()),
			UserAuthTable:     dbHelper.Table("user_auth"),
			UserID:            authUser.UserId,
			UserUID:           authUser.UserUID,
			AuthModule:        authUser.AuthModule,
			AuthID:            authUser.AuthId,
			Created:           legacysql.NewDBTime(authUser.Created),
			OAuthAccessToken:  authUser.OAuthAccessToken,
			OAuthRefreshToken: authUser.OAuthRefreshToken,
			OAuthIDToken:      authUser.OAuthIdToken,
			OAuthTokenType:    authUser.OAuthTokenType,
			OAuthExpiry:       legacysql.NewDBTime(authUser.OAuthExpiry),
			ExternalUID:       authUser.ExternalUID,
		}
		querySQL, err := sqltemplate.Execute(insertAuthInfoTemplate, dbQuery)
		if err != nil {
			return err
		}

		_, err = sess.Exec(append([]any{querySQL}, dbQuery.GetArgs()...)...)
		return err
	})
}

type updateAuthInfoQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable     string
	UserID            int64
	AuthModule        string
	OAuthAccessToken  string
	OAuthRefreshToken string
	OAuthIDToken      string
	OAuthTokenType    string
	OAuthExpiry       legacysql.DBTime
}

func (q updateAuthInfoQuery) Validate() error { return nil }

type findDuplicateAuthInfoQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable string
	UserID        int64
	AuthModule    string
	AuthID        string
}

func (q findDuplicateAuthInfoQuery) Validate() error { return nil }

type deleteDuplicateAuthInfoQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable string
	UserID        int64
	AuthModule    string
	AuthID        string
	ID            int64
}

func (q deleteDuplicateAuthInfoQuery) Validate() error { return nil }

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

	dbHelper, err := s.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		updateQuery := updateAuthInfoQuery{
			SQLTemplate:       sqltemplate.New(dbHelper.DialectForDriver()),
			UserAuthTable:     dbHelper.Table("user_auth"),
			UserID:            authUser.UserId,
			AuthModule:        authUser.AuthModule,
			OAuthAccessToken:  authUser.OAuthAccessToken,
			OAuthRefreshToken: authUser.OAuthRefreshToken,
			OAuthIDToken:      authUser.OAuthIdToken,
			OAuthTokenType:    authUser.OAuthTokenType,
			OAuthExpiry:       legacysql.NewDBTime(authUser.OAuthExpiry),
		}
		updateSQL, err := sqltemplate.Execute(updateAuthInfoTemplate, updateQuery)
		if err != nil {
			return err
		}

		result, err := sess.Exec(append([]any{updateSQL}, updateQuery.GetArgs()...)...)
		if err != nil {
			return err
		}
		upd, err := result.RowsAffected()
		if err != nil {
			return err
		}

		s.logger.Debug("Updated user_auth", "user_id", cmd.UserId, "auth_id", cmd.AuthId, "auth_module", cmd.AuthModule, "rows", upd)

		// Clean up duplicated entries
		if upd > 1 {
			var id int64
			findQuery := findDuplicateAuthInfoQuery{
				SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
				UserAuthTable: dbHelper.Table("user_auth"),
				UserID:        cmd.UserId,
				AuthModule:    cmd.AuthModule,
				AuthID:        cmd.AuthId,
			}
			findSQL, err := sqltemplate.Execute(findDuplicateAuthInfoTemplate, findQuery)
			if err != nil {
				return err
			}

			ok, err := sess.SQL(findSQL, findQuery.GetArgs()...).Get(&id)
			if err != nil {
				return err
			}

			if !ok {
				return nil
			}

			deleteQuery := deleteDuplicateAuthInfoQuery{
				SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
				UserAuthTable: dbHelper.Table("user_auth"),
				UserID:        cmd.UserId,
				AuthModule:    cmd.AuthModule,
				AuthID:        cmd.AuthId,
				ID:            id,
			}
			deleteSQL, err := sqltemplate.Execute(deleteDuplicateAuthInfoTemplate, deleteQuery)
			if err != nil {
				return err
			}

			_, err = sess.Exec(append([]any{deleteSQL}, deleteQuery.GetArgs()...)...)
			return err
		}

		return nil
	})
}

type deleteUserAuthInfoQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable string
	UserID        int64
}

func (q deleteUserAuthInfoQuery) Validate() error { return nil }

func (s *Store) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	dbHelper, err := s.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		dbQuery := deleteUserAuthInfoQuery{
			SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
			UserAuthTable: dbHelper.Table("user_auth"),
			UserID:        userID,
		}
		querySQL, err := sqltemplate.Execute(deleteUserAuthInfoTemplate, dbQuery)
		if err != nil {
			return err
		}

		_, err = sess.Exec(append([]any{querySQL}, dbQuery.GetArgs()...)...)
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

type authInfoUserUIDMigrationQuery struct {
	sqltemplate.SQLTemplate
	UserAuthTable string
	UserTable     string
}

func (q authInfoUserUIDMigrationQuery) Validate() error { return nil }

// authInfoUserUIDMigration ensures that all auth_info user_uids are set.
// To protect against upgrade / downgrade we need to run this for a couple of releases.
func (s *Store) authInfoUserUIDMigration(ctx context.Context) error {
	dbHelper, err := s.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		dbQuery := authInfoUserUIDMigrationQuery{
			SQLTemplate:   sqltemplate.New(dbHelper.DialectForDriver()),
			UserAuthTable: dbHelper.Table("user_auth"),
			UserTable:     dbHelper.Table("user"),
		}
		querySQL, err := sqltemplate.Execute(authInfoUserUIDMigrationTemplate, dbQuery)
		if err != nil {
			return err
		}

		_, err = sess.Exec(append([]any{querySQL}, dbQuery.GetArgs()...)...)
		return err
	})
}
