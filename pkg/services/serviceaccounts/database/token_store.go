package database

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"xorm.io/xorm"
)

func (s *ServiceAccountsStoreImpl) ListTokens(ctx context.Context, orgId int64, serviceAccountId int64) ([]*apikey.APIKey, error) {
	result := make([]*apikey.APIKey, 0)
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var sess *xorm.Session

		quotedUser := s.sqlStore.Dialect.Quote("user")
		sess = dbSession.
			Join("inner", quotedUser, quotedUser+".id = api_key.service_account_id").
			Where(quotedUser+".org_id=? AND "+quotedUser+".id=?", orgId, serviceAccountId).
			Asc("api_key.name")

		return sess.Find(&result)
	})
	return result, err
}

func (s *ServiceAccountsStoreImpl) AddServiceAccountToken(ctx context.Context, serviceAccountId int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := s.RetrieveServiceAccount(ctx, cmd.OrgId, serviceAccountId); err != nil {
			return err
		}

		key := apikey.APIKey{OrgId: cmd.OrgId, Name: cmd.Name}
		exists, _ := sess.Get(&key)
		if exists {
			return ErrDuplicateToken
		}

		updated := time.Now()
		var expires *int64 = nil
		if cmd.SecondsToLive > 0 {
			v := updated.Add(time.Second * time.Duration(cmd.SecondsToLive)).Unix()
			expires = &v
		} else if cmd.SecondsToLive < 0 {
			return ErrInvalidTokenExpiration
		}

		token := apikey.APIKey{
			OrgId:            cmd.OrgId,
			Name:             cmd.Name,
			Role:             models.ROLE_VIEWER,
			Key:              cmd.Key,
			Created:          updated,
			Updated:          updated,
			Expires:          expires,
			LastUsedAt:       nil,
			ServiceAccountId: &serviceAccountId,
		}

		if _, err := sess.Insert(&token); err != nil {
			return err
		}
		cmd.Result = &token
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
