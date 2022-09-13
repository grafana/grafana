package database

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/pkg/errors"
)

const maxRetrievedTokens = 300

func (s *ServiceAccountsStoreImpl) ListTokens(
	ctx context.Context, query *serviceaccounts.GetSATokensQuery,
) ([]apikey.APIKey, error) {
	result := make([]apikey.APIKey, 0)
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		quotedUser := s.sqlStore.Dialect.Quote("user")
		sess := dbSession.Limit(maxRetrievedTokens, 0).Where("api_key.service_account_id IS NOT NULL")

		if query.OrgID != nil {
			sess = sess.Where(quotedUser+".org_id=?", *query.OrgID)
			sess = sess.Where("api_key.org_id=?", *query.OrgID)
		}

		if query.ServiceAccountID != nil {
			sess = sess.Where("api_key.service_account_id=?", *query.ServiceAccountID)
		}

		sess = sess.Join("inner", quotedUser, quotedUser+".id = api_key.service_account_id").
			Asc("api_key.name")

		return errors.Wrapf(sess.Find(&result), "list token error")
	})
	return result, err
}

func (s *ServiceAccountsStoreImpl) AddServiceAccountToken(ctx context.Context, serviceAccountId int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := s.RetrieveServiceAccount(ctx, cmd.OrgId, serviceAccountId); err != nil {
			return err
		}

		addKeyCmd := &apikey.AddCommand{
			Name:             cmd.Name,
			Role:             org.RoleViewer,
			OrgId:            cmd.OrgId,
			Key:              cmd.Key,
			SecondsToLive:    cmd.SecondsToLive,
			ServiceAccountID: &serviceAccountId,
		}

		if err := s.apiKeyService.AddAPIKey(ctx, addKeyCmd); err != nil {
			switch {
			case errors.Is(err, apikey.ErrDuplicate):
				return ErrDuplicateToken
			case errors.Is(err, apikey.ErrInvalidExpiration):
				return ErrInvalidTokenExpiration
			}

			return err
		}

		cmd.Result = addKeyCmd.Result
		return nil
	})
}

func (s *ServiceAccountsStoreImpl) DeleteServiceAccountToken(ctx context.Context, orgId, serviceAccountId, tokenId int64) error {
	rawSQL := "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id=?"

	return s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		result, err := sess.Exec(rawSQL, tokenId, orgId, serviceAccountId)
		if err != nil {
			return err
		}
		affected, err := result.RowsAffected()
		if affected == 0 {
			return ErrServiceAccountTokenNotFound
		}

		return err
	})
}

func (s *ServiceAccountsStoreImpl) RevokeServiceAccountToken(ctx context.Context, orgId, serviceAccountId, tokenId int64) error {
	rawSQL := "UPDATE api_key SET is_revoked = ? WHERE id=? and org_id=? and service_account_id=?"

	return s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		result, err := sess.Exec(rawSQL, s.sqlStore.Dialect.BooleanStr(true), tokenId, orgId, serviceAccountId)
		if err != nil {
			return err
		}
		affected, err := result.RowsAffected()
		if affected == 0 {
			return ErrServiceAccountTokenNotFound
		}

		return err
	})
}

// assignApiKeyToServiceAccount sets the API key service account ID
func (s *ServiceAccountsStoreImpl) assignApiKeyToServiceAccount(sess *sqlstore.DBSession, apiKeyId int64, serviceAccountId int64) error {
	key := apikey.APIKey{Id: apiKeyId}
	exists, err := sess.Get(&key)
	if err != nil {
		s.log.Warn("API key not loaded", "err", err)
		return err
	}
	if !exists {
		s.log.Warn("API key not found", "err", err)
		return apikey.ErrNotFound
	}
	key.ServiceAccountId = &serviceAccountId

	if _, err := sess.ID(key.Id).Update(&key); err != nil {
		s.log.Warn("Could not update api key", "err", err)
		return err
	}

	return nil
}

// detachApiKeyFromServiceAccount converts service account token to old API key
func (s *ServiceAccountsStoreImpl) detachApiKeyFromServiceAccount(sess *sqlstore.DBSession, apiKeyId int64) error {
	key := apikey.APIKey{Id: apiKeyId}
	exists, err := sess.Get(&key)
	if err != nil {
		s.log.Warn("Cannot get API key", "err", err)
		return err
	}
	if !exists {
		s.log.Warn("API key not found", "err", err)
		return apikey.ErrNotFound
	}
	key.ServiceAccountId = nil

	if _, err := sess.ID(key.Id).AllCols().Update(&key); err != nil {
		s.log.Error("Could not update api key", "err", err)
		return err
	}

	return nil
}
