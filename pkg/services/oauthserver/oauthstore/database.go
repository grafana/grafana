package oauthstore

import (
	"context"

	"gopkg.in/square/go-jose.v2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/oauthserver"
)

type Store struct {
	db db.DB
}

func NewStore(db db.DB) *Store {
	return &Store{
		db: db,
	}
}

func (s *Store) RegisterExternalService(ctx context.Context, client *oauthserver.Client) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		insertQuery := []interface{}{
			`INSERT INTO oauth_client (app_name, client_id, secret, grant_types, service_account_id, public_pem, redirect_uri) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			client.ExternalServiceName,
			client.ClientID,
			client.Secret,
			client.GrantTypes,
			client.ServiceAccountID,
			client.PublicPem,
			client.RedirectURI,
		}
		_, err := sess.Exec(insertQuery...)
		if err != nil {
			return err
		}

		if len(client.ImpersonatePermissions) == 0 {
			return nil
		}

		insertPermQuery := make([]interface{}, 1, len(client.ImpersonatePermissions)*3+1)
		insertPermStmt := `INSERT INTO oauth_impersonate_permission (client_id, action, scope) VALUES `
		for _, perm := range client.ImpersonatePermissions {
			insertPermStmt += "(?, ?, ?),"
			insertPermQuery = append(insertPermQuery, client.ClientID, perm.Action, perm.Scope)
		}
		insertPermQuery[0] = insertPermStmt[:len(insertPermStmt)-1]
		_, err = sess.Exec(insertPermQuery...)
		return err
	})
}

func (s *Store) GetExternalService(ctx context.Context, id string) (*oauthserver.Client, error) {
	res := &oauthserver.Client{}
	if id == "" {
		return nil, oauthserver.ErrClientRequiredID
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		getClientQuery := `SELECT
		id, app_name, client_id, secret, grant_types, service_account_id, public_pem, redirect_uri
		FROM oauth_client
		WHERE client_id = ?`
		found, err := sess.SQL(getClientQuery, id).Get(res)
		if err != nil {
			return err
		}
		if !found {
			return oauthserver.ErrClientNotFound(id)
		}

		impersonatePermQuery := `SELECT action, scope FROM oauth_impersonate_permission WHERE client_id = ?`
		return sess.SQL(impersonatePermQuery, id).Find(&res.ImpersonatePermissions)
	})

	return res, err
}

// GetPublicKey returns public key, issued by 'issuer', and assigned for subject. Public key is used to check
// signature of jwt assertion in authorization grants.
func (s *Store) GetExternalServicePublicKey(ctx context.Context, id string) (*jose.JSONWebKey, error) {
	res := &oauthserver.Client{}
	if id == "" {
		return nil, oauthserver.ErrClientRequiredID
	}

	if err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		getKeyQuery := `SELECT public_pem FROM oauth_client WHERE client_id = ?`
		found, err := sess.SQL(getKeyQuery, id).Get(res)
		if err != nil {
			return err
		}
		if !found {
			return oauthserver.ErrClientNotFound(id)
		}
		return nil
	}); err != nil {
		return nil, err
	}

	key, errParseKey := oauthserver.ParsePublicKeyPem(res.PublicPem)
	if errParseKey != nil {
		return nil, errParseKey
	}

	return &jose.JSONWebKey{
		KeyID:     "1",
		Algorithm: "RS256",
		Key:       key,
	}, nil
}

func (s *Store) GetExternalServiceByName(ctx context.Context, app string) (*oauthserver.Client, error) {
	res := &oauthserver.Client{}
	if app == "" {
		return nil, oauthserver.ErrClientRequiredName
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var errGetByName error
		res, errGetByName = getExternalServiceByName(sess, app)
		return errGetByName
	})

	return res, err
}

func getExternalServiceByName(sess *db.Session, app string) (*oauthserver.Client, error) {
	res := &oauthserver.Client{}
	getClientQuery := `SELECT
		id, app_name, client_id, secret, grant_types, service_account_id, public_pem, redirect_uri
		FROM oauth_client
		WHERE app_name = ?`
	found, err := sess.SQL(getClientQuery, app).Get(res)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, oauthserver.ErrClientNotFound(app)
	}

	impersonatePermQuery := `SELECT action, scope FROM oauth_impersonate_permission WHERE client_id = ?`
	errPerm := sess.SQL(impersonatePermQuery, res.ClientID).Find(&res.ImpersonatePermissions)
	return res, errPerm
}

func (s *Store) UpdateExternalService(ctx context.Context, cmd *oauthserver.UpdateClientCommand) (*oauthserver.Client, error) {
	res := &oauthserver.Client{}
	if cmd == nil || cmd.ExternalServiceName == "" {
		return nil, oauthserver.ErrClientRequiredName
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		previous, errFetchPrevious := getExternalServiceByName(sess, cmd.ExternalServiceName)
		if errFetchPrevious != nil {
			return errFetchPrevious
		}
		newID := previous.ClientID

		query := `UPDATE oauth_client SET `
		args := []interface{}{"query_placeholder"}
		if cmd.RedirectURI != nil {
			query += ` redirect_uri = ? ,`
			args = append(args, *cmd.RedirectURI)
		}
		if cmd.GrantTypes != nil {
			query += ` grant_types = ? ,`
			args = append(args, *cmd.GrantTypes)
		}
		if cmd.PublicPem != nil {
			query += ` public_pem = ? ,`
			args = append(args, cmd.PublicPem)
		}
		if cmd.ServiceAccountID != nil {
			query += ` service_account_id = ? ,`
			args = append(args, *cmd.ServiceAccountID)
		}
		if cmd.Secret != nil {
			query += ` secret = ? ,`
			args = append(args, *cmd.Secret)
		}
		if cmd.ClientID != nil {
			newID = *cmd.ClientID
			query += ` client_id = ? ,`
			args = append(args, newID)
		}

		// Only update if there are any changes
		if len(args) > 1 {
			query = query[:len(query)-1]
			query += `WHERE app_name = ?`
			args = append(args, cmd.ExternalServiceName)

			args[0] = query
			_, errUpdate := sess.Exec(args...)
			if errUpdate != nil {
				return errUpdate
			}
		}

		if cmd.ImpersonatePermissions != nil {
			deletePermQuery := `DELETE FROM oauth_impersonate_permission WHERE client_id = ?`
			_, errDelPerm := sess.Exec(deletePermQuery, previous.ClientID)
			if errDelPerm != nil {
				return errDelPerm
			}

			if len(cmd.ImpersonatePermissions) == 0 {
				return nil
			}

			insertPermQuery := make([]interface{}, 1, len(cmd.ImpersonatePermissions)*3+1)
			insertPermStmt := `INSERT INTO oauth_impersonate_permission (client_id, action, scope) VALUES `
			for _, perm := range cmd.ImpersonatePermissions {
				insertPermStmt += "(?, ?, ?),"
				insertPermQuery = append(insertPermQuery, newID, perm.Action, perm.Scope)
			}
			insertPermQuery[0] = insertPermStmt[:len(insertPermStmt)-1]
			_, errInsertPerm := sess.Exec(insertPermQuery...)
			return errInsertPerm
		}
		return nil
	})

	return res, err
}
