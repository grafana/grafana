package store

import (
	"context"
	"fmt"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

var (
	// ErrNoAlertmanagerConfiguration is an error for when no alertmanager configuration is found.
	ErrNoAdminConfiguration = fmt.Errorf("no admin configuration available")
)

type UpdateAdminConfigurationCmd struct {
	AdminConfiguration *ngmodels.AdminConfiguration
}

type AdminConfigurationStore interface {
	GetAdminConfiguration(orgID int64) (*ngmodels.AdminConfiguration, error)
	GetAdminConfigurations(query *ngmodels.GetOrgAdminConfiguration) error
	DeleteAdminConfiguration(orgID int64) error
	UpdateAdminConfiguration(UpdateAdminConfigurationCmd) error
}

func (st *DBstore) GetAdminConfiguration(orgID int64) (*ngmodels.AdminConfiguration, error) {
	cfg := &ngmodels.AdminConfiguration{}
	err := st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		ok, err := sess.Table("alert_admin_configuration").Where("org_id = ?", orgID).Limit(1).Get(cfg)
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

func (st DBstore) GetAdminConfigurations(q *ngmodels.GetOrgAdminConfiguration) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		cfg := []*ngmodels.AdminConfiguration{}
		if err := sess.Table("alert_admin_configuration").Find(&cfg); err != nil {
			return nil
		}

		q.Result = cfg
		return nil
	})
}

func (st DBstore) DeleteAdminConfiguration(orgID int64) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM alert_admin_configuration WHERE org_id = ?", orgID)
		if err != nil {
			return err
		}

		return nil
	})
}

func (st DBstore) UpdateAdminConfiguration(cmd UpdateAdminConfigurationCmd) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		has, err := sess.Table("alert_admin_configuration").Where("org_id = ?", cmd.AdminConfiguration.OrgID).Limit(1, 0).Exist()
		if err != nil {
			return err
		}

		if !has {
			_, err := sess.Table("alert_admin_configuration").Insert(cmd.AdminConfiguration)
			return err
		}

		_, err = sess.Table("alert_admin_configuration").AllCols().Update(cmd.AdminConfiguration)
		return err
	})
}
