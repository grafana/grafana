package rmsmetadataimpl

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/rmsmetadata"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	GetView(context.Context, int64) ([]*rmsmetadata.View, error)
	GetViewById(context.Context, int64, int64) (*rmsmetadata.View, error)
	GetViewsEnabledForInsightFinder(context.Context, int64) (*rmsmetadata.ViewsEnabledForInsightFinder, error)
	SetViewsEnabledForInsightFinder(context.Context, int64, *rmsmetadata.ViewsEnabledForInsightFinder) error
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
	log     log.Logger
	cfg     *setting.Cfg
}

func (ss *sqlStore) GetView(ctx context.Context, orgID int64) ([]*rmsmetadata.View, error) {
	var results []*rmsmetadata.View
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Table("rms_metadata_view_list")
		err := sess.Where("tenant_id in (?,1)", orgID).OrderBy("tenant_id").OrderBy("name").Find(&results)
		if err != nil {
			return err
		}
		if len(results) == 0 {
			return rmsmetadata.ErrViewNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

func (ss *sqlStore) GetViewById(ctx context.Context, orgID int64, viewID int64) (*rmsmetadata.View, error) {
	var result rmsmetadata.View
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Table("rms_metadata_view_list")
		_, err := sess.Where("tenant_id in (?,1)", orgID).Where("id = ?", viewID).Get(&result)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (ss *sqlStore) GetViewsEnabledForInsightFinder(ctx context.Context, orgID int64) (*rmsmetadata.ViewsEnabledForInsightFinder, error) {
	var result rmsmetadata.ViewsEnabledForInsightFinder
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Table("rms_insight_finder")
		_, err := sess.Where("tenant_id = ?", orgID).Get(&result)
		return err
	})

	return &result, err
}

func (ss *sqlStore) SetViewsEnabledForInsightFinder(ctx context.Context, orgID int64, viewsEnabled *rmsmetadata.ViewsEnabledForInsightFinder) error {
	return ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Table("rms_insight_finder")

		// XORM has a behaviour where if it receives empty values like "", it does not update in DB unless explicitly mentioned.
		// We need to use .Cols("selected_views"), to allow customer to submit an empty selection, which is equivalent to defaulting to all enriched OOTB views.
		affected, err := sess.Where("tenant_id = ?", orgID).Cols("selected_views").Update(viewsEnabled)
		if affected == 0 {
			// No rows updated, so inserting
			ss.log.Info("No existing views enabled found for Insight Finder, inserting new record",
				"org_id", orgID)
			// For some reason, when we insert after running update, sess resets to nil and table name is lost, it tries to insert into views_enabled_for_insight_finder. So closing the session and creating a new one.
			sess.Close()
			sess = dbSess.Table("rms_insight_finder")
			affected, err = sess.Insert(viewsEnabled)
		}
		if err != nil {
			ss.log.Error(fmt.Sprintf(
				"Failed to update views enabled for Insight Finder. Error: %v", err),
				"org_id", orgID)
		} else {
			ss.log.Info("Updated views enabled for Insight Finder",
				"rows_affected", affected,
				"org_id", orgID)
		}
		return err
	})

}
