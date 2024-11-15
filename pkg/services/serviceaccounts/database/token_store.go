package database

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

const maxRetrievedTokens = 300

func (s *ServiceAccountsStoreImpl) ListTokens(
	ctx context.Context, query *serviceaccounts.GetSATokensQuery,
) ([]apikey.APIKey, error) {
	result := make([]apikey.APIKey, 0)
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		quotedUser := s.sqlStore.GetDialect().Quote("user")
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

		if err := sess.Find(&result); err != nil {
			return fmt.Errorf("%s: %w", "list token error", err)
		}
		return nil
	})
	return result, err
}

func (s *ServiceAccountsStoreImpl) AddServiceAccountToken(ctx context.Context, serviceAccountId int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	var apiKey *apikey.APIKey

	return apiKey, s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := s.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{OrgID: cmd.OrgId, ID: serviceAccountId}); err != nil {
			return err
		}

		addKeyCmd := &apikey.AddCommand{
			Name:             cmd.Name,
			Role:             org.RoleViewer,
			OrgID:            cmd.OrgId,
			Key:              cmd.Key,
			SecondsToLive:    cmd.SecondsToLive,
			ServiceAccountID: &serviceAccountId,
		}

		key, err := s.apiKeyService.AddAPIKey(ctx, addKeyCmd)
		if err != nil {
			switch {
			case errors.Is(err, apikey.ErrDuplicate):
				return serviceaccounts.ErrDuplicateToken.Errorf("service account token with name %s already exists in the organization", cmd.Name)
			case errors.Is(err, apikey.ErrInvalidExpiration):
				return serviceaccounts.ErrInvalidTokenExpiration.Errorf("invalid service account token expiration value %d", cmd.SecondsToLive)
			}

			return err
		}

		apiKey = key
		return nil
	})
}

func (s *ServiceAccountsStoreImpl) DeleteServiceAccountToken(ctx context.Context, orgId, serviceAccountId, tokenId int64) error {
	rawSQL := "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id=?"

	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		result, err := sess.Exec(rawSQL, tokenId, orgId, serviceAccountId)
		if err != nil {
			return err
		}
		affected, err := result.RowsAffected()
		if affected == 0 {
			return serviceaccounts.ErrServiceAccountTokenNotFound.Errorf("service account token with id %d not found", tokenId)
		}

		return err
	})
}

func (s *ServiceAccountsStoreImpl) RevokeServiceAccountToken(ctx context.Context, orgId, serviceAccountId, tokenId int64) error {
	rawSQL := "UPDATE api_key SET is_revoked = ? WHERE id=? and org_id=? and service_account_id=?"

	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		result, err := sess.Exec(rawSQL, s.sqlStore.GetDialect().BooleanStr(true), tokenId, orgId, serviceAccountId)
		if err != nil {
			return err
		}
		affected, err := result.RowsAffected()
		if affected == 0 {
			return serviceaccounts.ErrServiceAccountTokenNotFound.Errorf("service account token with id %d not found for service account with id %d", tokenId, serviceAccountId)
		}

		return err
	})
}

// assignApiKeyToServiceAccount sets the API key service account ID
func (s *ServiceAccountsStoreImpl) assignApiKeyToServiceAccount(ctx context.Context, apiKeyId int64, serviceAccountId int64) error {
	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		key := apikey.APIKey{ID: apiKeyId}
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

		if _, err := sess.ID(key.ID).Update(&key); err != nil {
			s.log.Warn("Could not update api key", "err", err)
			return err
		}
		return nil
	})
}
