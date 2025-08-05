package datamigrations

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/urfave/cli/v2"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ToUnifiedStorage converts dashboards+folders into unified storage
func ToUnifiedStorage(c utils.CommandLine, cfg *setting.Cfg, sqlStore db.DB) error {
	// Take namespace from command line
	namespace := c.String("namespace")

	ns, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return err
	}
	ctx := identity.WithServiceIdentityContext(context.Background(), ns.OrgID)
	start := time.Now()
	last := time.Now()

	opts := legacy.MigrateOptions{
		Namespace: namespace,
		Resources: []schema.GroupResource{
			{Group: folders.GROUP, Resource: folders.RESOURCE},
			{Group: dashboard.GROUP, Resource: dashboard.DASHBOARD_RESOURCE},
		},
		LargeObjects: nil, // TODO... from config
		Progress: func(count int, msg string) {
			const minInterval = time.Second
			shouldPrint := count < 1 || time.Since(last) > minInterval
			if shouldPrint {
				logger.Info(fmt.Sprintf("[%4d] %s", count, msg))
				last = time.Now()
			}
		},
	}

	featureManager, err := featuremgmt.ProvideManagerService(cfg)
	if err != nil {
		return err
	}
	featureToggles := featuremgmt.ProvideToggles(featureManager)

	provisioning, err := newStubProvisioning(cfg.ProvisioningPath)
	if err != nil {
		return err
	}

	migrator := legacy.NewDashboardAccess(
		legacysql.NewDatabaseProvider(sqlStore),
		authlib.OrgNamespaceFormatter,
		nil, // no dashboards.Store
		provisioning,
		nil, // no librarypanels.Service
		sort.ProvideService(),
		acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		featureToggles,
	)

	client, err := newUnifiedClient(cfg, sqlStore, featureToggles)
	if err != nil {
		return err
	}

	if c.Bool("non-interactive") {
		opts.Store = client
		opts.BlobStore = client
		opts.WithHistory = true // always include history in non-interactive mode
		rsp, err := migrator.Migrate(ctx, opts)
		if exitErr := handleMigrationError(err, rsp); exitErr != nil {
			return exitErr
		}

		logger.Info("Migrated legacy resources successfully in", time.Since(start))
		if rsp != nil {
			jj, _ := json.MarshalIndent(rsp, "", "  ")
			logger.Info("Migration summary:", string(jj))
		}
		return nil
	}

	yes, err := promptYesNo(fmt.Sprintf("Count legacy resources for namespace: %s?", opts.Namespace))
	if err != nil {
		return err
	}
	if yes {
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

	opts.OnlyCount = false
	opts.WithHistory, err = promptYesNo("Include history in exports?")
	if err != nil {
		return err
	}

	yes, err = promptYesNo("Export legacy resources to parquet file?")
	if err != nil {
		return err
	}
	if yes {
		file, err := os.CreateTemp(cfg.DataPath, "grafana-export-*.parquet")
		if err != nil {
			return err
		}
		start = time.Now()
		last = time.Now()
		opts.Store, err = newParquetClient(file)
		if err != nil {
			return err
		}
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

	yes, err = promptYesNo("Export legacy resources to unified storage?")
	if err != nil {
		return err
	}
	if yes {
		// Check the stats (eventually compare)
		req := &resourcepb.ResourceStatsRequest{
			Namespace: opts.Namespace,
		}
		for _, r := range opts.Resources {
			req.Kinds = append(req.Kinds, fmt.Sprintf("%s/%s", r.Group, r.Resource))
		}

		stats, err := client.GetStats(ctx, req)
		if err != nil {
			return err
		}

		if stats != nil {
			fmt.Printf("Existing resources in unified storage:\n")
			jj, _ := json.MarshalIndent(stats, "", "  ")
			fmt.Printf("%s\n", string(jj))
		}

		yes, err = promptYesNo("Would you like to continue? (existing resources will be replaced)")
		if err != nil {
			return err
		}
		if yes {
			start = time.Now()
			last = time.Now()
			opts.Store = client
			opts.BlobStore = client
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
	}
	return nil
}

func promptYesNo(prompt string) (bool, error) {
	line := ""
	for {
		fmt.Printf("%s (Y/N) >", prompt)
		_, err := fmt.Scanln(&line)
		if err != nil && err.Error() != "unexpected newline" {
			return false, err
		}
		switch strings.ToLower(line) {
		case "y", "yes":
			return true, nil
		case "n", "no":
			return false, nil
		}
	}
}

func newUnifiedClient(cfg *setting.Cfg, sqlStore db.DB, featureToggles featuremgmt.FeatureToggles) (resource.ResourceClient, error) {
	return unified.ProvideUnifiedStorageClient(&unified.Options{
		Cfg:      cfg,
		Features: featureToggles,
		DB:       sqlStore,
		Tracer:   tracing.NewNoopTracerService(),
		Reg:      prometheus.NewPedanticRegistry(),
		Authzc:   authlib.FixedAccessClient(true), // always true!
		Docs:     nil,                             // document supplier
	}, nil, nil)
}

func newParquetClient(file *os.File) (resourcepb.BulkStoreClient, error) {
	writer, err := parquet.NewParquetWriter(file)
	if err != nil {
		return nil, err
	}
	client := parquet.NewBulkResourceWriterClient(writer)
	return client, nil
}

func handleMigrationError(err error, rsp *resourcepb.BulkResponse) error {
	if err != nil {
		return cli.Exit(fmt.Sprintf("Failed to migrate legacy resources: %+v", err), 1)
	}

	if rsp != nil && rsp.Error != nil {
		msg := fmt.Sprintf("Failed to migrate legacy resources: %s", rsp.Error.Message)
		if rsp.Error.Reason != "" {
			msg += fmt.Sprintf(" (%s)", rsp.Error.Reason)
		}
		return cli.Exit(msg, 1)
	}

	return nil
}
