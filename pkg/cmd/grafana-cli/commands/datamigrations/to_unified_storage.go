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
		start := time.Now()
		last := time.Now()

		parquetFile := ""
		opts := legacy.MigrateOptions{
			Namespace:    "default", // get from namespace
			WithHistory:  true,      // query.Get("history") == "true",
			OnlyCount:    true,
			Resources:    []string{"*"}, // everything
			LargeObjects: nil,           // ???
			Progress: func(count int, msg string) {
				if count < 1 || time.Since(last) > time.Second {
					fmt.Printf("[%4d] %s\n", count, msg)
					last = time.Now()
				}
			},
		}

		provisioning, err := newStubProvisioning(cfg.ProvisioningPath)
		if err != nil {
			return err
		}

		var migrator legacy.LegacyMigrator
		migrator = legacy.NewDashboardAccess(
			legacysql.NewDatabaseProvider(sqlStore),
			authlib.OrgNamespaceFormatter,
			nil, provisioning, false,
		)

		if true {
			opts.Store, err = newUnifiedClient(cfg, sqlStore)
		} else {
			file, err := os.CreateTemp(cfg.DataPath, "grafana-export-*.parquet")
			if err != nil {
				return err
			}
			parquetFile = file.Name()
			opts.Store, err = newParquetClient(file)
		}
		if err != nil {
			return err
		}

		ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{})
		rsp, err := migrator.Migrate(ctx, opts)
		if err != nil {
			return err
		}

		fmt.Printf("\n\n------------------\n")
		fmt.Printf("MIGRATE DONE: %s\n", time.Since(start))
		if rsp != nil {
			jj, _ := json.MarshalIndent(rsp, "", "  ")
			fmt.Printf("%s\n", string(jj))
		}
		if parquetFile != "" {
			fmt.Printf("Parquet: %s\n", parquetFile)
		}
		fmt.Printf("------------------\n")
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
