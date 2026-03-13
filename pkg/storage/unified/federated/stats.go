package federated

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Read stats from legacy SQL
type LegacyStatsGetter struct {
	SQL legacysql.LegacyDatabaseProvider
	Cfg *setting.Cfg
}

func (s *LegacyStatsGetter) isDashboardsFallbackDisabled() bool {
	if s.Cfg == nil {
		return false
	}
	return s.Cfg.UnifiedStorage["dashboards.dashboard.grafana.app"].DualWriterMode == grafanarest.Mode5
}

func (s *LegacyStatsGetter) isFoldersFallbackDisabled() bool {
	if s.Cfg == nil {
		return false
	}
	return s.Cfg.UnifiedStorage["folders.folder.grafana.app"].DualWriterMode == grafanarest.Mode5
}

func (s *LegacyStatsGetter) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
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

	rsp := &resourcepb.ResourceStatsResponse{}
	fn := func(table, where, g, r string, existCheck bool) error {
		if existCheck {
			exists, err := helper.TableExists(ctx, table)
			if err != nil {
				return err
			}
			if !exists {
				return nil
			}
		}

		quotedTable, err := helper.QuoteIdentifier(helper.Table(table))
		if err != nil {
			return err
		}

		var count int64
		err = helper.Session().Get(ctx, &count, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", quotedTable, where), info.OrgID, in.Folder)
		if err != nil {
			return err
		}
		rsp.Stats = append(rsp.Stats, &resourcepb.ResourceStatsResponse_Stats{
			Group:    g,
			Resource: r,
			Count:    count,
		})
		return nil
	}

	group := "sql-fallback"
	if err := fn("alert_rule", "org_id=? AND namespace_uid=?", group, "alertrules", false); err != nil {
		return nil, err
	}
	if !s.isDashboardsFallbackDisabled() {
		if err := fn("dashboard", "org_id=? AND folder_uid=? AND is_folder=false", group, "dashboards", true); err != nil {
			return nil, err
		}
	}
	if !s.isFoldersFallbackDisabled() {
		if err := fn("folder", "org_id=? AND parent_uid=?", group, "folders", true); err != nil {
			return nil, err
		}
	}
	if err := fn("library_element", "org_id=? AND folder_uid=?", group, "library_elements", false); err != nil {
		return nil, err
	}

	return rsp, nil
}
