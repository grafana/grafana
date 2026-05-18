package federated

import (
	"context"
	"fmt"
	"strings"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Read stats from legacy SQL
type LegacyStatsGetter struct {
	SQL legacysql.LegacyDatabaseProvider
	Cfg *setting.Cfg
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

			where, args := buildFolderWhere(folderCol, info.OrgID, folders)
			count, err := sess.Table(helper.Table(table)).Where(where, args...).Count()
			if err != nil {
				return err
			}
			rsp.Stats = append(rsp.Stats, &resourcepb.ResourceStatsResponse_Stats{
				Group:    g, // all legacy for now
				Resource: r,
				Count:    count,
			})
			return nil
		}
		// Indicate that this came from the SQL tables
		group := "sql-fallback"

		// Legacy alert rule table
		err = fn("alert_rule", "namespace_uid", group, "alertrules", false)
		if err != nil {
			return err
		}

		// Legacy library_elements table
		err = fn("library_element", "folder_uid", group, "library_elements", false)
		if err != nil {
			return err
		}
		return nil
	})

	return rsp, err
}

// folderSet returns the deduped union of in.Folder and in.Folders.
// Empty entries are dropped. Returns nil when no folder filter is set.
func folderSet(in *resourcepb.ResourceStatsRequest) []string {
	if in.Folder == "" && len(in.Folders) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(in.Folders)+1)
	out := make([]string, 0, len(in.Folders)+1)
	add := func(f string) {
		if f == "" {
			return
		}
		if _, ok := seen[f]; ok {
			return
		}
		seen[f] = struct{}{}
		out = append(out, f)
	}
	add(in.Folder)
	for _, f := range in.Folders {
		add(f)
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
