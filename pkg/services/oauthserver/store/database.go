package store

import (
	"context"
	"crypto/ecdsa"
	"crypto/rsa"
	"errors"

	"gopkg.in/square/go-jose.v2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/utils"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type store struct {
	db db.DB
}

func NewStore(db db.DB) oauthserver.Store {
	return &store{db: db}
}

func createImpersonatePermissions(sess *db.Session, client *oauthserver.ExternalService) error {
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

func registerExternalService(sess *db.Session, client *oauthserver.ExternalService) error {
	insertQuery := []interface{}{
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

func (s *store) RegisterExternalService(ctx context.Context, client *oauthserver.ExternalService) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return registerExternalService(sess, client)
	})
}

func recreateImpersonatePermissions(sess *db.Session, client *oauthserver.ExternalService, prevClientID string) error {
	deletePermQuery := `DELETE FROM oauth_impersonate_permission WHERE client_id = ?`
	if _, errDelPerm := sess.Exec(deletePermQuery, prevClientID); errDelPerm != nil {
		return errDelPerm
	}

	if len(client.ImpersonatePermissions) == 0 {
		return nil
	}

	return createImpersonatePermissions(sess, client)
}

func updateExternalService(sess *db.Session, client *oauthserver.ExternalService, prevClientID string) error {
	updateQuery := []interface{}{
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

func (s *store) SaveExternalService(ctx context.Context, client *oauthserver.ExternalService) error {
	if client.Name == "" {
		return oauthserver.ErrClientRequiredName
	}
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		previous, errFetchExtSvc := getExternalServiceByName(sess, client.Name)
		if errFetchExtSvc != nil {
			var srcError errutil.Error
			if errors.As(errFetchExtSvc, &srcError) {
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

func (s *store) GetExternalService(ctx context.Context, id string) (*oauthserver.ExternalService, error) {
	res := &oauthserver.ExternalService{}
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
			return oauthserver.ErrClientNotFound(id)
		}

		impersonatePermQuery := `SELECT action, scope FROM oauth_impersonate_permission WHERE client_id = ?`
		return sess.SQL(impersonatePermQuery, id).Find(&res.ImpersonatePermissions)
	})

	return res, err
}

// GetPublicKey returns public key, issued by 'issuer', and assigned for subject. Public key is used to check
// signature of jwt assertion in authorization grants.
func (s *store) GetExternalServicePublicKey(ctx context.Context, clientID string) (*jose.JSONWebKey, error) {
	res := &oauthserver.ExternalService{}
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
			return oauthserver.ErrClientNotFound(clientID)
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

func (s *store) GetExternalServiceByName(ctx context.Context, name string) (*oauthserver.ExternalService, error) {
	res := &oauthserver.ExternalService{}
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

func getExternalServiceByName(sess *db.Session, name string) (*oauthserver.ExternalService, error) {
	res := &oauthserver.ExternalService{}
	getClientQuery := `SELECT
		id, name, client_id, secret, grant_types, audiences, service_account_id, public_pem, redirect_uri
		FROM oauth_client
		WHERE name = ?`
	found, err := sess.SQL(getClientQuery, name).Get(res)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, oauthserver.ErrClientNotFound(name)
	}

	impersonatePermQuery := `SELECT action, scope FROM oauth_impersonate_permission WHERE client_id = ?`
	errPerm := sess.SQL(impersonatePermQuery, res.ClientID).Find(&res.ImpersonatePermissions)

	return res, errPerm
}
