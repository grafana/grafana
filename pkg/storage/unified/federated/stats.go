package federated

import (
	"context"
	"fmt"
	"slices"
	"strings"

	claims "github.com/grafana/authlib/types"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// folderBatchSize caps how many folder UIDs are bound into a single IN (...)
// clause. SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 999, so 500 leaves
// headroom for the orgID placeholder and stays well under MySQL/Postgres limits.
const folderBatchSize = 500

// Config section keys for the resources that own the legacy tables counted below.
const (
	alertRuleResource    = "alertrules.rules.alerting.grafana.app"
	libraryPanelResource = "librarypanels.dashboard.grafana.app"
)

// LegacyCountedResources is guarded by a test: once one of these gets a migration
// registered, legacyTableIsStale has to read the migration status instead of config.
var LegacyCountedResources = []string{alertRuleResource, libraryPanelResource}

// Read stats from legacy SQL
type LegacyStatsGetter struct {
	SQL legacysql.LegacyDatabaseProvider
	Cfg *setting.Cfg
}

// From mode 4 on nothing writes the legacy table, so its rows are leftovers and
// counting them would warn about resources that no longer exist. Config is enough
// because these two resources have no migration registered; if that changes, read
// the migration status like dualwrite.Service.ReadFromUnified does.
func (s *LegacyStatsGetter) legacyTableIsStale(resource string) bool {
	if s.Cfg == nil {
		return false
	}
	return s.Cfg.UnifiedStorage[resource].DualWriterMode >= grafanarest.Mode4
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

	folders := folderSet(in)

	rsp := &resourcepb.ResourceStatsResponse{}
	err = helper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		fn := func(table, folderCol, g, r string, existCheck bool) error {
			// if existCheck is true, do not error out if the table does not exist
			if existCheck {
				exists, err := sess.IsTableExist(helper.Table(table))
				if !exists {
					return nil
				} else if err != nil {
					return err
				}
			}

			tableName := helper.Table(table)
			countChunk := func(chunk []string) (int64, error) {
				where, args := buildFolderWhere(folderCol, info.OrgID, chunk)
				return sess.Table(tableName).Where(where, args...).Count()
			}

			var total int64
			if len(folders) == 0 {
				c, err := countChunk(nil)
				if err != nil {
					return err
				}
				total = c
			} else {
				for chunk := range slices.Chunk(folders, folderBatchSize) {
					c, err := countChunk(chunk)
					if err != nil {
						return err
					}
					total += c
				}
			}

			rsp.Stats = append(rsp.Stats, &resourcepb.ResourceStatsResponse_Stats{
				Group:    g, // all legacy for now
				Resource: r,
				Count:    total,
			})
			return nil
		}
		// Indicate that this came from the SQL tables
		group := "sql-fallback"

		// Legacy alert rule table
		if !s.legacyTableIsStale(alertRuleResource) {
			err = fn("alert_rule", "namespace_uid", group, "alertrules", false)
			if err != nil {
				return err
			}
		}

		// Legacy library_elements table
		if !s.legacyTableIsStale(libraryPanelResource) {
			err = fn("library_element", "folder_uid", group, "library_elements", false)
			if err != nil {
				return err
			}
		}
		return nil
	})

	return rsp, err
}

// folderSet returns in.Folder deduped, with empty entries dropped. Returns
// nil when no folder filter is set.
func folderSet(in *resourcepb.ResourceStatsRequest) []string {
	if len(in.Folder) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(in.Folder))
	out := make([]string, 0, len(in.Folder))
	for _, f := range in.Folder {
		if f == "" {
			continue
		}
		if _, ok := seen[f]; ok {
			continue
		}
		seen[f] = struct{}{}
		out = append(out, f)
	}
	return out
}

// buildFolderWhere returns the WHERE fragment + bound args for an org+folder
// filter over a single folder UID column. Uses IN (...) when more than one
// folder is supplied so the legacy fallback matches the recursive semantics
// of the unified-storage path.
func buildFolderWhere(folderCol string, orgID int64, folders []string) (string, []any) {
	switch len(folders) {
	case 0:
		return "org_id=?", []any{orgID}
	case 1:
		return "org_id=? AND " + folderCol + "=?", []any{orgID, folders[0]}
	}
	placeholders := strings.Repeat("?,", len(folders))
	placeholders = placeholders[:len(placeholders)-1]
	args := make([]any, 0, len(folders)+1)
	args = append(args, orgID)
	for _, f := range folders {
		args = append(args, f)
	}
	return "org_id=? AND " + folderCol + " IN (" + placeholders + ")", args
}
