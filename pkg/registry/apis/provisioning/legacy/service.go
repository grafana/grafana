package legacy

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

/**
SEE:
* https://github.com/grafana/grafana/pull/68940/files
* https://github.com/grafana/grafana/tree/3fb89bd53761b6196b3f97f28ba234b1238ac68b/pkg/services/export
*/

type ExportOptions struct {
	OrgID      int64
	Dashboards bool
}

type LegacyExporter interface {
	Export(ctx context.Context, opts ExportOptions) (string, error)
}

// Export using legacy SQL/non multi-tenant services
func ProvideLegacyProvisioningExporter(sql db.DB,
	cfg *setting.Cfg,
	datasourceService datasources.DataSourceService,
) LegacyExporter {
	return &legacyExporter{
		sql:               sql,
		dataDir:           cfg.DataPath,
		datasourceService: datasourceService,
	}
}

type legacyExporter struct {
	sql               db.DB
	dataDir           string
	datasourceService datasources.DataSourceService
}

// Synchronous
func (job *legacyExporter) Export(ctx context.Context, opts ExportOptions) (string, error) {
	// 1. Get users
	users, err := job.loadUsers(ctx, opts.OrgID)
	if err != nil {
		return "", err
	}

	fmt.Printf("USERS: %+v\n", users)

	rootDir := filepath.Join(job.dataDir, "export", fmt.Sprintf("dump_%d", time.Now().Unix()))
	r, err := git.PlainInit(rootDir, false)
	if err != nil {
		return rootDir, err
	}

	// default to "main" branch
	h := plumbing.NewSymbolicReference(plumbing.HEAD, plumbing.ReferenceName("refs/heads/main"))
	err = r.Storer.SetReference(h)
	if err != nil {
		return rootDir, err
	}

	w, err := r.Worktree()
	if err != nil {
		return rootDir, err
	}

	helper := &commitHelper{
		repo:    r,
		work:    w,
		ctx:     ctx,
		orgID:   opts.OrgID,
		workDir: rootDir,
		orgDir:  rootDir,
		broadcast: func(p string) {
			fmt.Printf("> %s\n", p)
		},
	}

	err = helper.add(commitOptions{
		body: []commitBody{
			{
				fpath: filepath.Join(helper.orgDir, "hello.txt"),
				body:  []byte(`just saying hello`),
			},
		},
		when:    time.Now(),
		comment: "hello!",
	})
	if err != nil {
		return "", err
	}

	// Nested folder
	if false {
		// First find the folder structure
		// NOTE: we will ignore things that are not in a known folder!!!
		helper.folders, err = job.exportFolders(helper)
		if err != nil {
			return "", err
		}
	}

	if false {
		job.exportDataSources(helper)
	}

	if true {
		job.exportDashboards(helper, true)
	}

	return rootDir, nil
}

func (e *legacyExporter) loadUsers(ctx context.Context, orgId int64) (map[int64]*userInfo, error) {
	db := e.sql.GetSqlxSession()
	rsp := make(map[int64]*userInfo, 100)
	// 1. Get users
	rows, err := db.Query(ctx, "SELECT id,login,email,login FROM "+e.sql.Quote("user")+" WHERE org_id=?", orgId)
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
