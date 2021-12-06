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
	"xorm.io/xorm"
)

func ProvideService(sqlStore *sqlstore.SQLStore) *LibraryCredentialsService {
	return &LibraryCredentialsService{
		SQLStore: sqlStore,
	}
}

type Service interface {
	GetLibraryCredentials(ctx context.Context, query models.GetLibraryCredentialsQuery) error
	AddLibraryCredentials(ctx context.Context, cmd *models.AddLibraryCredentialCommand) error
	UpdateLibraryCredentials(ctx context.Context, cmd *models.AddLibraryCredentialCommand) error
	//need to add delete
}

type LibraryCredentialsService struct {
	SQLStore       *sqlstore.SQLStore
	SecretsService secrets.Service
}

func (s LibraryCredentialsService) GetLibraryCredentials(ctx context.Context, query models.GetLibraryCredentialsQuery) error {
	return s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		query.Result = make([]*models.DataSource, 0)
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
				return errutil.Wrapf(err, "Failed to generate UID for libary credential %q", cmd.Name)
			}
			cmd.Uid = uid
		}

		ds := &models.LibraryCredential{
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

		if _, err := dbSession.Insert(ds); err != nil {
			return err
		}

		cmd.Result = ds
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

		ds := &models.LibraryCredential{
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

		var updateSession *xorm.Session

		affected, err := updateSession.Update(ds)
		if err != nil {
			return err
		}

		if affected == 0 {
			return models.ErrDataSourceUpdatingOldVersion
		}

		cmd.Result = ds
		return err
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
