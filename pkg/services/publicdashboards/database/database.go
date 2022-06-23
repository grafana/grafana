package database

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
)

// Define the storage implementation. We're generating the mock implementation
// automatically
type PublicDashboardStoreImpl struct {
	sqlStore *sqlstore.SQLStore
	log      log.Logger
	dialect  migrator.Dialect
}

// Gives us a compile time error if our database does not adhere to contract of
// the interface
var _ publicdashboards.Store = (*PublicDashboardStoreImpl)(nil)

// Factory used by wire to dependency injection
func ProvideStore(sqlStore *sqlstore.SQLStore) *PublicDashboardStoreImpl {
	return &PublicDashboardStoreImpl{
		sqlStore: sqlStore,
		log:      log.New("publicdashboards.store"),
		dialect:  sqlStore.Dialect,
	}
}

// Retrieves public dashboard configuration
func (d *PublicDashboardStoreImpl) GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error) {
	if accessToken == "" {
		return nil, nil, ErrPublicDashboardIdentifierNotSet
	}

	// get public dashboard
	pdRes := &PublicDashboard{AccessToken: accessToken}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(pdRes)
		if err != nil {
			return err
		}
		if !has {
			return ErrPublicDashboardNotFound
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	// find dashboard
	dashRes := &models.Dashboard{OrgId: pdRes.OrgId, Uid: pdRes.DashboardUid}
	err = d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Get(dashRes)
		if err != nil {
			return err
		}
		if !has {
			return ErrPublicDashboardNotFound
		}
		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	return pdRes, dashRes, err
}

// Generates a new unique uid to retrieve a public dashboard
func (d *PublicDashboardStoreImpl) GenerateNewPublicDashboardUid(ctx context.Context) (string, error) {
	var uid string

	err := d.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		for i := 0; i < 3; i++ {
			uid = util.GenerateShortUID()

			exists, err := sess.Get(&PublicDashboard{Uid: uid})
			if err != nil {
				return err
			}

			if !exists {
				return nil
			}
		}

		return ErrPublicDashboardFailedGenerateUniqueUid
	})

	if err != nil {
		return "", err
	}

	return uid, nil
}

// Retrieves public dashboard configuration
func (d *PublicDashboardStoreImpl) GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	if dashboardUid == "" {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	pdRes := &PublicDashboard{OrgId: orgId, DashboardUid: dashboardUid}
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// publicDashboard
		_, err := sess.Get(pdRes)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return pdRes, err
}

// Persists public dashboard configuration
func (d *PublicDashboardStoreImpl) SavePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) (*PublicDashboard, error) {
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.UseBool("is_enabled").Insert(&cmd.PublicDashboard)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &cmd.PublicDashboard, nil
}

// Updates existing public dashboard configuration
func (d *PublicDashboardStoreImpl) UpdatePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) error {
	err := d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.UseBool("is_enabled").Update(&cmd.PublicDashboard)
		if err != nil {
			return err
		}

		return nil
	})

	return err
}
