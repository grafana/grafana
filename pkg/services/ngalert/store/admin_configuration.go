package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	// ErrNoAdminConfiguration is an error for when no admin configuration is found.
	ErrNoAdminConfiguration = fmt.Errorf("no admin configuration available")
)

type UpdateAdminConfigurationCmd struct {
	AdminConfiguration *ngmodels.AdminConfiguration
}

//go:generate mockery --name AdminConfigurationStore --structname AdminConfigurationStoreMock --inpackage --filename admin_configuration_store_mock.go --with-expecter
type AdminConfigurationStore interface {
	GetAdminConfiguration(orgID int64) (*ngmodels.AdminConfiguration, error)
	GetAdminConfigurations() ([]*ngmodels.AdminConfiguration, error)
	DeleteAdminConfiguration(orgID int64) error
	UpdateAdminConfiguration(UpdateAdminConfigurationCmd) error
}

func (st *DBstore) GetAdminConfiguration(orgID int64) (*ngmodels.AdminConfiguration, error) {
	cfg := &ngmodels.AdminConfiguration{}
	err := st.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		ok, err := sess.Table("ngalert_configuration").Where("org_id = ?", orgID).Get(cfg)
		if err != nil {
			return err
		}

		if !ok {
			return ErrNoAdminConfiguration
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return cfg, nil
}

func (st DBstore) GetAdminConfigurations() ([]*ngmodels.AdminConfiguration, error) {
	var cfg []*ngmodels.AdminConfiguration
	err := st.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		if err := sess.Table("ngalert_configuration").Find(&cfg); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return cfg, nil
}

func (st DBstore) DeleteAdminConfiguration(orgID int64) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM ngalert_configuration WHERE org_id = ?", orgID)
		if err != nil {
			return err
		}

		return nil
	})
}

func (st DBstore) UpdateAdminConfiguration(cmd UpdateAdminConfigurationCmd) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
		has, err := sess.Table("ngalert_configuration").Where("org_id = ?", cmd.AdminConfiguration.OrgID).Exist()
		if err != nil {
			return err
		}

		if !has {
			_, err := sess.Table("ngalert_configuration").Insert(cmd.AdminConfiguration)
			return err
		}

		_, err = sess.Table("ngalert_configuration").AllCols().Update(cmd.AdminConfiguration)
		return err
	})
}
