package datamigrations

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
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
	ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{})
	start := time.Now()
	last := time.Now()

	opts := legacy.MigrateOptions{
		Namespace:    "default",     // from command line????
		WithHistory:  false,         // configured below
		Resources:    []string{"*"}, // everything
		LargeObjects: nil,           // TODO... from config
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

	migrator := legacy.NewDashboardAccess(
		legacysql.NewDatabaseProvider(sqlStore),
		authlib.OrgNamespaceFormatter,
		nil, provisioning, false,
	)

	line := ""
	fmt.Printf("Count legacy resources for namespace: %s?\n", opts.Namespace)
	fmt.Printf("Y/N? > ")
	fmt.Scanln(&line)
	if strings.ToLower(line) == "y" {
		opts.OnlyCount = true
		rsp, err := migrator.Migrate(ctx, opts)
		if err != nil {
			return err
		}

		fmt.Printf("Counting DONE: %s\n", time.Since(start))
		if rsp != nil {
			jj, _ := json.MarshalIndent(rsp, "", "  ")
			fmt.Printf("%s\n", string(jj))
		}
	}

	fmt.Printf("Include history in exports? (Y/N) >")
	fmt.Scanln(&line)
	opts.WithHistory = strings.ToLower(line) == "y"

	fmt.Printf("Export legacy resources to parquet file? (Y/N) >")
	fmt.Scanln(&line)
	if strings.ToLower(line) == "y" {
		file, err := os.CreateTemp(cfg.DataPath, "grafana-export-*.parquet")
		if err != nil {
			return err
		}
		start = time.Now()
		last = time.Now()
		opts.Store, err = newParquetClient(file)
		rsp, err := migrator.Migrate(ctx, opts)
		if err != nil {
			return err
		}
		fmt.Printf("Parquet export DONE: %s\n", time.Since(start))
		if rsp != nil {
			jj, _ := json.MarshalIndent(rsp, "", "  ")
			fmt.Printf("%s\n", string(jj))
		}
		fmt.Printf("File: %s\n", file.Name())
	}

	fmt.Printf("Export legacy resources to unified storage? (Y/N) >")
	fmt.Scanln(&line)
	if strings.ToLower(line) == "y" {
		start = time.Now()
		last = time.Now()
		opts.Store, err = newUnifiedClient(cfg, sqlStore)
		rsp, err := migrator.Migrate(ctx, opts)
		if err != nil {
			return err
		}
		fmt.Printf("Unified storage export: %s\n", time.Since(start))
		if rsp != nil {
			jj, _ := json.MarshalIndent(rsp, "", "  ")
			fmt.Printf("%s\n", string(jj))
		}
	}
	return nil
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
