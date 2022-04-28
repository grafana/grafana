package database

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (s *ServiceAccountsStoreImpl) AddServiceAccountToken(ctx context.Context, saID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		key := models.ApiKey{OrgId: cmd.OrgId, Name: cmd.Name}
		exists, _ := sess.Get(&key)
		if exists {
			return &ErrDuplicateSAToken{cmd.Name}
		}

		updated := time.Now()
		var expires *int64 = nil
		if cmd.SecondsToLive > 0 {
			v := updated.Add(time.Second * time.Duration(cmd.SecondsToLive)).Unix()
			expires = &v
		} else if cmd.SecondsToLive < 0 {
			return &ErrInvalidExpirationSAToken{}
		}

		t := models.ApiKey{
			OrgId:            cmd.OrgId,
			Name:             cmd.Name,
			Role:             models.ROLE_VIEWER,
			Key:              cmd.Key,
			Created:          updated,
			Updated:          updated,
			Expires:          expires,
			ServiceAccountId: &saID,
		}

		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		cmd.Result = &t
		return nil
	})
}

func (s *ServiceAccountsStoreImpl) DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error {
	rawSQL := "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id=?"

	return s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		result, err := sess.Exec(rawSQL, tokenID, orgID, serviceAccountID)
		if err != nil {
			return err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return err
		} else if n == 0 {
			return &ErrMissingSAToken{}
		}
		return nil
	})
}

// assignApiKeyToServiceAccount sets the API key service account ID
func (s *ServiceAccountsStoreImpl) assignApiKeyToServiceAccount(ctx context.Context, apikeyId int64, saccountId int64) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		key := models.ApiKey{Id: apikeyId}
		exists, err := sess.Get(&key)
		if err != nil {
			s.log.Warn("API key not loaded", "err", err)
			return err
		}
		if !exists {
			s.log.Warn("API key not found", "err", err)
			return models.ErrApiKeyNotFound
		}
		key.ServiceAccountId = &saccountId

		if _, err := sess.ID(key.Id).Update(&key); err != nil {
			s.log.Warn("Could not update api key", "err", err)
			return err
		}

		return nil
	})
}
