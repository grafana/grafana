package store

import (
	"context"
	"crypto/ecdsa"
	"crypto/rsa"
	"errors"

	"gopkg.in/square/go-jose.v2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver/utils"
)

type store struct {
	db db.DB
}

func NewStore(db db.DB) oauthserver.Store {
	return &store{db: db}
}

func createImpersonatePermissions(sess *db.Session, client *oauthserver.OAuthExternalService) error {
	if len(client.ImpersonatePermissions) == 0 {
		return nil
	}

	insertPermQuery := make([]any, 1, len(client.ImpersonatePermissions)*3+1)
	insertPermStmt := `INSERT INTO oauth_impersonate_permission (client_id, action, scope) VALUES `
	for _, perm := range client.ImpersonatePermissions {
		insertPermStmt += "(?, ?, ?),"
		insertPermQuery = append(insertPermQuery, client.ClientID, perm.Action, perm.Scope)
	}
	insertPermQuery[0] = insertPermStmt[:len(insertPermStmt)-1]
	_, err := sess.Exec(insertPermQuery...)
	return err
}

func registerExternalService(sess *db.Session, client *oauthserver.OAuthExternalService) error {
	insertQuery := []any{
		`INSERT INTO oauth_client (name, client_id, secret, grant_types, audiences, service_account_id, public_pem, redirect_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		client.Name,
		client.ClientID,
		client.Secret,
		client.GrantTypes,
		client.Audiences,
		client.ServiceAccountID,
		client.PublicPem,
		client.RedirectURI,
	}
	if _, err := sess.Exec(insertQuery...); err != nil {
		return err
	}

	return createImpersonatePermissions(sess, client)
}

func (s *store) RegisterExternalService(ctx context.Context, client *oauthserver.OAuthExternalService) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return registerExternalService(sess, client)
	})
}

func recreateImpersonatePermissions(sess *db.Session, client *oauthserver.OAuthExternalService, prevClientID string) error {
	deletePermQuery := `DELETE FROM oauth_impersonate_permission WHERE client_id = ?`
	if _, errDelPerm := sess.Exec(deletePermQuery, prevClientID); errDelPerm != nil {
		return errDelPerm
	}

	if len(client.ImpersonatePermissions) == 0 {
		return nil
	}

	return createImpersonatePermissions(sess, client)
}

func updateExternalService(sess *db.Session, client *oauthserver.OAuthExternalService, prevClientID string) error {
	updateQuery := []any{
		`UPDATE oauth_client SET client_id = ?, secret = ?, grant_types = ?, audiences = ?, service_account_id = ?, public_pem = ?, redirect_uri = ? WHERE name = ?`,
		client.ClientID,
		client.Secret,
		client.GrantTypes,
		client.Audiences,
		client.ServiceAccountID,
		client.PublicPem,
		client.RedirectURI,
		client.Name,
	}
	if _, err := sess.Exec(updateQuery...); err != nil {
		return err
	}

	return recreateImpersonatePermissions(sess, client, prevClientID)
}

func (s *store) SaveExternalService(ctx context.Context, client *oauthserver.OAuthExternalService) error {
	if client.Name == "" {
		return oauthserver.ErrClientRequiredName
	}
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		previous, errFetchExtSvc := getExternalServiceByName(sess, client.Name)
		if errFetchExtSvc != nil && !errors.Is(errFetchExtSvc, oauthserver.ErrClientNotFound) {
			return errFetchExtSvc
		}
		if previous == nil {
			return registerExternalService(sess, client)
		}
		return updateExternalService(sess, client, previous.ClientID)
	})
}

func (s *store) GetExternalService(ctx context.Context, id string) (*oauthserver.OAuthExternalService, error) {
	res := &oauthserver.OAuthExternalService{}
	if id == "" {
		return nil, oauthserver.ErrClientRequiredID
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		getClientQuery := `SELECT
		id, name, client_id, secret, grant_types, audiences, service_account_id, public_pem, redirect_uri
		FROM oauth_client
		WHERE client_id = ?`
		found, err := sess.SQL(getClientQuery, id).Get(res)
		if err != nil {
			return err
		}
		if !found {
			res = nil
			return oauthserver.ErrClientNotFoundFn(id)
		}

		impersonatePermQuery := `SELECT action, scope FROM oauth_impersonate_permission WHERE client_id = ?`
		return sess.SQL(impersonatePermQuery, id).Find(&res.ImpersonatePermissions)
	})

	return res, err
}

// GetPublicKey returns public key, issued by 'issuer', and assigned for subject. Public key is used to check
// signature of jwt assertion in authorization grants.
func (s *store) GetExternalServicePublicKey(ctx context.Context, clientID string) (*jose.JSONWebKey, error) {
	res := &oauthserver.OAuthExternalService{}
	if clientID == "" {
		return nil, oauthserver.ErrClientRequiredID
	}

	if err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		getKeyQuery := `SELECT public_pem FROM oauth_client WHERE client_id = ?`
		found, err := sess.SQL(getKeyQuery, clientID).Get(res)
		if err != nil {
			return err
		}
		if !found {
			return oauthserver.ErrClientNotFoundFn(clientID)
		}
		return nil
	}); err != nil {
		return nil, err
	}

	key, errParseKey := utils.ParsePublicKeyPem(res.PublicPem)
	if errParseKey != nil {
		return nil, errParseKey
	}

	var alg string
	switch key.(type) {
	case *rsa.PublicKey:
		alg = oauthserver.RS256
	case *ecdsa.PublicKey:
		alg = oauthserver.ES256
	}

	return &jose.JSONWebKey{
		Algorithm: alg,
		Key:       key,
	}, nil
}

func (s *store) GetExternalServiceByName(ctx context.Context, name string) (*oauthserver.OAuthExternalService, error) {
	res := &oauthserver.OAuthExternalService{}
	if name == "" {
		return nil, oauthserver.ErrClientRequiredName
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var errGetByName error
		res, errGetByName = getExternalServiceByName(sess, name)
		return errGetByName
	})

	return res, err
}

func getExternalServiceByName(sess *db.Session, name string) (*oauthserver.OAuthExternalService, error) {
	res := &oauthserver.OAuthExternalService{}
	getClientQuery := `SELECT
		id, name, client_id, secret, grant_types, audiences, service_account_id, public_pem, redirect_uri
		FROM oauth_client
		WHERE name = ?`
	found, err := sess.SQL(getClientQuery, name).Get(res)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, oauthserver.ErrClientNotFoundFn(name)
	}

	impersonatePermQuery := `SELECT action, scope FROM oauth_impersonate_permission WHERE client_id = ?`
	errPerm := sess.SQL(impersonatePermQuery, res.ClientID).Find(&res.ImpersonatePermissions)

	return res, errPerm
}

// FIXME: If we ever do a search method remove that method
func (s *store) GetExternalServiceNames(ctx context.Context) ([]string, error) {
	res := []string{}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(`SELECT name FROM oauth_client`).Find(&res)
	})

	return res, err
}

func (s *store) UpdateExternalServiceGrantTypes(ctx context.Context, clientID, grantTypes string) error {
	if clientID == "" {
		return oauthserver.ErrClientRequiredID
	}

	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		query := `UPDATE oauth_client SET grant_types = ? WHERE client_id = ?`
		_, err := sess.Exec(query, grantTypes, clientID)
		return err
	})
}

func (s *store) DeleteExternalService(ctx context.Context, id string) error {
	if id == "" {
		return oauthserver.ErrClientRequiredID
	}

	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Exec(`DELETE FROM oauth_client WHERE client_id = ?`, id); err != nil {
			return err
		}

		_, err := sess.Exec(`DELETE FROM oauth_impersonate_permission WHERE client_id = ?`, id)
		return err
	})
}
