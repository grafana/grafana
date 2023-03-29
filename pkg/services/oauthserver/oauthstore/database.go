package oauthstore

import (
	"context"

	"gopkg.in/square/go-jose.v2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type store struct {
	db db.DB
}

func NewStore(db db.DB) oauthserver.Store {
	return &store{
		db: db,
	}
}

func createImpersonatePermissions(sess *db.Session, client *oauthserver.Client) error {
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
	_, err := sess.Exec(insertPermQuery...)
	return err
}

func registerExternalService(sess *db.Session, client *oauthserver.Client) error {
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

	return createImpersonatePermissions(sess, client)
}

func (s *store) RegisterExternalService(ctx context.Context, client *oauthserver.Client) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return registerExternalService(sess, client)
	})
}

func recreateImpersonatePermissions(sess *db.Session, client *oauthserver.Client, prevClientID string) error {
	deletePermQuery := `DELETE FROM oauth_impersonate_permission WHERE client_id = ?`
	_, errDelPerm := sess.Exec(deletePermQuery, prevClientID)
	if errDelPerm != nil {
		return errDelPerm
	}

	if len(client.ImpersonatePermissions) == 0 {
		return nil
	}

	return createImpersonatePermissions(sess, client)
}

func updateExternalService(sess *db.Session, client *oauthserver.Client, prevClientID string) error {
	updateQuery := []interface{}{
		`UPDATE oauth_client SET client_id = ?, secret = ?, grant_types = ?, service_account_id = ?, public_pem = ?, redirect_uri = ? WHERE app_name = ?`,
		client.ClientID,
		client.Secret,
		client.GrantTypes,
		client.ServiceAccountID,
		client.PublicPem,
		client.RedirectURI,
		client.ExternalServiceName,
	}
	_, err := sess.Exec(updateQuery...)
	if err != nil {
		return err
	}

	// TODO rethink this maybe recreating isn't performant enough
	return recreateImpersonatePermissions(sess, client, prevClientID)
}

func (s *store) SaveExternalService(ctx context.Context, client *oauthserver.Client) error {
	if client.ExternalServiceName == "" {
		return oauthserver.ErrClientRequiredName
	}
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		previous, errFetchExtSvc := getExternalServiceByName(sess, client.ExternalServiceName)
		if errFetchExtSvc != nil {
			if srcError, ok := errFetchExtSvc.(errutil.Error); ok {
				if srcError.MessageID != oauthserver.ErrClientNotFoundMessageID {
					return errFetchExtSvc
				}
			}
		}
		if previous == nil {
			return registerExternalService(sess, client)
		}
		return updateExternalService(sess, client, previous.ClientID)
	})
}

func (s *store) GetExternalService(ctx context.Context, id string) (*oauthserver.Client, error) {
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
func (s *store) GetExternalServicePublicKey(ctx context.Context, id string) (*jose.JSONWebKey, error) {
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

func (s *store) GetExternalServiceByName(ctx context.Context, app string) (*oauthserver.Client, error) {
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
