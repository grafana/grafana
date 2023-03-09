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
