package legacyexport

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/go-git/go-git/v5"

	"github.com/grafana/authlib/claims"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
)

/**
SEE:
* https://github.com/grafana/grafana/pull/68940/files
* https://github.com/grafana/grafana/tree/3fb89bd53761b6196b3f97f28ba234b1238ac68b/pkg/services/export
*/

type LegacyExporter interface {
	// A long running process that will export dashboards and their history to a new
	// git repository
	Export(ctx context.Context, dir string, namespace string, options provisioning.ExportOptions) (*git.Repository, error)
}

// Export using legacy SQL/non multi-tenant services
func ProvideLegacyProvisioningExporter(sql db.DB,
	cfg *setting.Cfg,
) LegacyExporter {
	return &legacyExporter{
		sql:     sql,
		dataDir: cfg.DataPath,
	}
}

type legacyExporter struct {
	sql     db.DB
	dataDir string
}

// Synchronous
func (job *legacyExporter) Export(ctx context.Context, dir string, namespace string, options provisioning.ExportOptions) (*git.Repository, error) {
	info, err := claims.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}

	// Load users (used for each commit message)
	_, err = job.loadUsers(ctx, info.OrgID)
	if err != nil {
		return nil, err
	}

	repo, err := git.PlainOpen(dir)
	if err != nil {
		return nil, err
	}

	w, err := repo.Worktree()
	if err != nil {
		return nil, err
	}

	helper := &commitHelper{
		work:  w,
		ctx:   ctx,
		orgID: info.OrgID,
		dir:   dir,
		broadcast: func(p string) {
			fmt.Printf("> %s\n", p)
		},
	}

	err = job.exportDashboards(helper, true)
	return repo, err
}

func (job *legacyExporter) loadUsers(ctx context.Context, orgId int64) (map[int64]*userInfo, error) {
	db := job.sql.GetSqlxSession()
	rsp := make(map[int64]*userInfo, 100)
	// 1. Get users
	rows, err := db.Query(ctx, "SELECT id,login,email,login FROM "+job.sql.Quote("user")+" WHERE org_id=?", orgId)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		id := int64(0)
		u := &userInfo{}
		err = rows.Scan(&id, &u.login, &u.email, &u.login)
		if err != nil {
			return nil, err
		}
		rsp[id] = u
	}
	return rsp, err
}

func prettyJSON(v interface{}) []byte {
	b, _ := json.MarshalIndent(v, "", "  ")
	return b
}
