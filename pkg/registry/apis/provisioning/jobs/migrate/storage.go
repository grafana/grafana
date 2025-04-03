package migrate

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func stopReadingUnifiedStorage(ctx context.Context, dual dualwrite.Service) error {
	for _, gr := range resources.SupportedProvisioningResources {
		status, _ := dual.Status(ctx, gr.GroupResource())
		status.ReadUnified = false
		status.Migrated = 0
		status.Migrating = 0
		_, err := dual.Update(ctx, status)
		if err != nil {
			return err
		}
	}

	return nil
}

func wipeUnifiedAndSetMigratedFlag(ctx context.Context, dual dualwrite.Service, namespace string, batch resource.BulkStoreClient) error {
	for _, gr := range resources.SupportedProvisioningResources {
		status, _ := dual.Status(ctx, gr.GroupResource())
		if status.ReadUnified {
			return fmt.Errorf("unexpected state - already using unified storage for: %s", gr)
		}
		if status.Migrating > 0 {
			if time.Since(time.UnixMilli(status.Migrating)) < time.Second*30 {
				return fmt.Errorf("another migration job is running for: %s", gr)
			}
		}
		settings := resource.BulkSettings{
			RebuildCollection: true, // wipes everything in the collection
			Collection: []*resource.ResourceKey{{
				Namespace: namespace,
				Group:     gr.Group,
				Resource:  gr.Resource,
			}},
		}
		ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
		stream, err := batch.BulkProcess(ctx)
		if err != nil {
			return fmt.Errorf("error clearing unified %s / %w", gr, err)
		}
		stats, err := stream.CloseAndRecv()
		if err != nil {
			return fmt.Errorf("error clearing unified %s / %w", gr, err)
		}
		logger := logging.FromContext(ctx)
		logger.Error("cleared unified stoage", "stats", stats)

		status.Migrated = time.Now().UnixMilli() // but not really... since the sync is starting
		status.ReadUnified = true
		status.WriteLegacy = false // keep legacy "clean"
		_, err = dual.Update(ctx, status)
		if err != nil {
			return err
		}
	}

	return nil
}
