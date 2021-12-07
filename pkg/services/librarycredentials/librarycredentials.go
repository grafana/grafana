package librarycredentials

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func ProvideService(sqlStore *sqlstore.SQLStore, secretsService secrets.Service) *LibraryCredentialsService {
	return &LibraryCredentialsService{
		SQLStore:       sqlStore,
		SecretsService: secretsService,
	}
}

type Service interface {
	GetLibraryCredentials(ctx context.Context, query *models.GetLibraryCredentialsQuery) error
	AddLibraryCredential(ctx context.Context, cmd *models.AddLibraryCredentialCommand) error
	UpdateLibraryCredential(ctx context.Context, cmd *models.UpdateLibraryCredentialCommand) error
	DeleteLibraryCredential(ctx context.Context, cmd *models.DeleteLibraryCredentialCommand) error
}

type LibraryCredentialsService struct {
	SQLStore       *sqlstore.SQLStore
	SecretsService secrets.Service
}

func (s LibraryCredentialsService) GetLibraryCredentials(ctx context.Context, query *models.GetLibraryCredentialsQuery) error {
	return s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		query.Result = make([]*models.LibraryCredential, 0)
		return dbSession.Where("org_id=?", query.OrgId).Asc("name").Find(&query.Result)
	})
}

func (s LibraryCredentialsService) AddLibraryCredential(ctx context.Context, cmd *models.AddLibraryCredentialCommand) error {
	var err error
	cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		existing := models.LibraryCredential{OrgId: cmd.OrgId, Name: cmd.Name}
		has, _ := dbSession.Get(&existing)

		if has {
			return models.ErrLibraryCredentialNameExists
		}

		if cmd.JsonData == nil {
			cmd.JsonData = simplejson.New()
		}

		if cmd.Uid == "" {
			uid, err := generateNewDatasourceUid(dbSession, cmd.OrgId)
			if err != nil {
				return errutil.Wrapf(err, "Failed to generate UID for library credential %q", cmd.Name)
			}
			cmd.Uid = uid
		}

		cred := &models.LibraryCredential{
			OrgId:          cmd.OrgId,
			Name:           cmd.Name,
			Type:           cmd.Type,
			JsonData:       cmd.JsonData,
			SecureJsonData: cmd.EncryptedSecureJsonData,
			Created:        time.Now(),
			Updated:        time.Now(),
			ReadOnly:       cmd.ReadOnly,
			Uid:            cmd.Uid,
		}

		if _, err := dbSession.Insert(cred); err != nil {
			return err
		}

		cmd.Result = cred
		return nil
	})
}

func (s LibraryCredentialsService) UpdateLibraryCredential(ctx context.Context, cmd *models.UpdateLibraryCredentialCommand) error {
	var err error
	cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if cmd.JsonData == nil {
			cmd.JsonData = simplejson.New()
		}

		cred := &models.LibraryCredential{
			Id:             cmd.Id,
			OrgId:          cmd.OrgId,
			Name:           cmd.Name,
			Type:           cmd.Type,
			JsonData:       cmd.JsonData,
			SecureJsonData: cmd.EncryptedSecureJsonData,
			Created:        time.Now(),
			Updated:        time.Now(),
			ReadOnly:       cmd.ReadOnly,
			Uid:            cmd.Uid,
		}

		sess.UseBool("read_only")

		updateSession := sess.Where("id=? and org_id=?", cred.Id, cred.OrgId)

		affected, err := updateSession.Update(cred)
		if err != nil {
			return err
		}

		if affected == 0 {
			return models.ErrDataSourceUpdatingOldVersion
		}

		datasources := make([]*models.DataSource, 0)
		if err := sess.Table("data_source").Where("library_credential_id=? and org_id=?", cred.Id, cred.OrgId).Find(&datasources); err != nil {
			return err
		}

		for _, ds := range datasources {
			for key, value := range cred.JsonData.MustMap() {
				if _, ok := ds.JsonData.CheckGet(key); ok {
					ds.JsonData.Set(key, value)
				}
			}

			for key, value := range cred.SecureJsonData {
				if _, ok := ds.SecureJsonData[key]; !ok {
					ds.SecureJsonData[key] = value
				}
			}

			if _, err := sess.Table("data_source").Where("id=? and org_id=?", ds.Id, ds.OrgId).Update(ds); err != nil {
				return err
			}
		}

		cmd.Result = cred
		return err
	})
}

func (s LibraryCredentialsService) DeleteLibraryCredential(ctx context.Context, cmd *models.DeleteLibraryCredentialCommand) error {
	return s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		var rawSql = "DELETE FROM library_credential WHERE id=? and org_id=?"

		if result, err := session.Exec(rawSql, cmd.Id, cmd.OrgId); err != nil {
			return err
		} else if cmd.NumDeleted, err = result.RowsAffected(); err != nil {
			return err
		}
		return nil
	})
}

var generateNewUid func() string = util.GenerateShortUID

func generateNewDatasourceUid(sess *sqlstore.DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()

		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&models.DataSource{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrDataSourceFailedGenerateUniqueUid
}
