package migrate

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// called when an error exists
func stopReadingUnifiedStorage(ctx context.Context, dual dualwrite.Service) error {
	kinds := []schema.GroupResource{{
		Group:    folders.GROUP,
		Resource: folders.RESOURCE,
	}, {
		Group:    dashboard.GROUP,
		Resource: dashboard.DASHBOARD_RESOURCE,
	}}

	for _, gr := range kinds {
		status, _ := dual.Status(ctx, gr)
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

func (j *migrationJob) wipeUnifiedAndSetMigratedFlag(ctx context.Context, dual dualwrite.Service) error {
	kinds := []schema.GroupResource{{
		Group:    folders.GROUP,
		Resource: folders.RESOURCE,
	}, {
		Group:    dashboard.GROUP,
		Resource: dashboard.DASHBOARD_RESOURCE,
	}}

	for _, gr := range kinds {
		status, _ := dual.Status(ctx, gr)
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
				Namespace: j.namespace,
				Group:     gr.Group,
				Resource:  gr.Resource,
			}},
		}
		ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
		stream, err := j.batch.BulkProcess(ctx)
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
