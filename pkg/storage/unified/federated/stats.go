package federated

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Read stats from legacy SQL
type LegacyStatsGetter struct {
	SQL legacysql.LegacyDatabaseProvider
}

func (s *LegacyStatsGetter) GetStats(ctx context.Context, in *resource.ResourceStatsRequest) (*resource.ResourceStatsResponse, error) {
	info, err := claims.ParseNamespace(in.Namespace)
	if err != nil {
		return nil, fmt.Errorf("unable to read namespace")
	}
	if info.OrgID == 0 {
		return nil, fmt.Errorf("invalid OrgID found in namespace")
	}

	helper, err := s.SQL(ctx)
	if err != nil {
		return nil, err
	}

	rsp := &resource.ResourceStatsResponse{}
	err = helper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		fn := func(table, where, g, r string, existCheck bool) error {
			// if existCheck is true, do not error out if the table does not exist
			if existCheck {
				exists, err := sess.IsTableExist(helper.Table(table))
				if !exists {
					return nil
				} else if err != nil {
					return err
				}
			}

			count, err := sess.Table(helper.Table(table)).Where(where, info.OrgID, in.Folder).Count()
			if err != nil {
				return err
			}
			rsp.Stats = append(rsp.Stats, &resource.ResourceStatsResponse_Stats{
				Group:    g, // all legacy for now
				Resource: r,
				Count:    count,
			})
			return nil
		}
		// Indicate that this came from the SQL tables
		group := "sql-fallback"

		// Legacy alert rule table
		err = fn("alert_rule", "org_id=? AND dashboard_uid=?", group, "alertrules", false)
		if err != nil {
			return err
		}

		// Legacy dashboard table
		err = fn("dashboard", "org_id=? AND folder_uid=?", group, "dashboards", true)
		if err != nil {
			return err
		}

		// Legacy folder table
		err = fn("folder", "org_id=? AND parent_uid=?", group, "folders", true)
		if err != nil {
			return err
		}

		// Legacy library_elements table
		err = fn("library_element", "org_id=? AND folder_uid=?", group, "library_elements", false)
		if err != nil {
			return err
		}
		return nil
	})

	return rsp, err
}
