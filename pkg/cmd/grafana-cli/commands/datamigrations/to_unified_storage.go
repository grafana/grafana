package datamigrations

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ToUnifiedStorage converts dashboards+folders into unified storage
func ToUnifiedStorage(c utils.CommandLine, cfg *setting.Cfg, sqlStore db.DB) error {
	ctx := context.Background()
	return sqlStore.WithDbSession(ctx, func(session *db.Session) error {
		// TODO, get orgId/namespace from command line?
		namespace := "default"
		ns, err := authlib.ParseNamespace(namespace)
		if err != nil {
			return err
		}

		provisioning, err := newStubProvisioning(cfg.ProvisioningPath)
		if err != nil {
			return err
		}

		access := legacy.NewDashboardAccess(
			legacysql.NewDatabaseProvider(sqlStore),
			authlib.OrgNamespaceFormatter,
			nil, provisioning, false,
		)

		stats, err := getStats(ns.OrgID, session)
		if err != nil {
			return err
		}
		fmt.Printf("Legacy database: %+v\n", stats)

		start := time.Now()
		last := time.Now()

		export := ""
		var unified resource.ResourceClient

		if true {
			unified, err = newUnifiedClient(cfg, sqlStore)
		} else {
			file, err := os.CreateTemp(cfg.DataPath, "grafana-export-*.parquet")
			if err != nil {
				return err
			}
			export = file.Name()
			unified, err = newParquetClient(file)
		}
		if err != nil {
			return err
		}

		ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{})
		rsp, err := access.Migrate(ctx, legacy.MigrateOptions{
			Namespace:    "default", // get from namespace
			WithHistory:  false,     // query.Get("history") == "true",
			Resources:    []string{"dashboards"},
			LargeObjects: nil, // ???
			Store:        unified,
			Progress: func(count int, msg string) {
				if count < 1 || time.Since(last) > time.Second {
					fmt.Printf("[%4d] %s\n", count, msg)
					last = time.Now()
				}
			},
		})
		if err != nil {
			return err
		}

		fmt.Printf("\n\n------------------\n")
		fmt.Printf("MIGRATE DONE: %s\n", time.Since(start))
		if rsp != nil {
			jj, _ := json.MarshalIndent(rsp, "", "  ")
			fmt.Printf("%s\n", string(jj))
		}
		fmt.Printf("Parquet: %s\n", export)
		fmt.Printf("------------------\n\n")
		return nil
	})
}

func newUnifiedClient(cfg *setting.Cfg, sqlStore db.DB) (resource.ResourceClient, error) {
	return unified.ProvideUnifiedStorageClient(cfg,
		featuremgmt.WithFeatures(), // none??
		sqlStore,
		tracing.NewNoopTracerService(),
		prometheus.NewPedanticRegistry(),
		authlib.FixedAccessClient(true), // always true!
		nil,                             // document supplier
	)
}

func newParquetClient(file *os.File) (resource.ResourceClient, error) {
	backend, err := parquet.NewParquetBatchProcessingBackend(file)
	if err != nil {
		return nil, err
	}

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
	})
	if err != nil {
		return nil, err
	}

	return resource.NewLocalResourceClient(server), nil
}

type tableStats struct {
	folders          int
	dashboards       int
	dashboardHistory int
	libaryPanels     int
	playlists        int
}

func getStats(orgId int64, session *db.Session) (stats tableStats, err error) {
	stats = tableStats{}

	_, err = session.SQL("SELECT COUNT(*) FROM dashboard WHERE is_folder=FALSE AND org_id=?", orgId).Get(&stats.dashboards)
	if err != nil {
		return
	}

	_, err = session.SQL("SELECT COUNT(*) FROM dashboard WHERE is_folder=TRUE AND org_id=?", orgId).Get(&stats.folders)
	if err != nil {
		return
	}

	_, err = session.SQL("SELECT COUNT(*) FROM playlist WHERE org_id=?", orgId).Get(&stats.playlists)
	if err != nil {
		return
	}

	_, err = session.SQL(`SELECT COUNT(*) 
		FROM dashboard_version JOIN dashboard ON dashboard.id = dashboard_version.dashboard_id
		WHERE org_id=?`, orgId).Get(&stats.dashboardHistory)
	if err != nil {
		return
	}

	return
}
