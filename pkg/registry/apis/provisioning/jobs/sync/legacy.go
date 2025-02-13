package sync

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (r *SyncWorker) wipeUnifiedAndSetMigratedFlag(ctx context.Context, ns string) error {
	kinds := []schema.GroupResource{{
		Group:    folders.GROUP,
		Resource: folders.RESOURCE,
	}, {
		Group:    dashboard.GROUP,
		Resource: dashboard.DASHBOARD_RESOURCE,
	}}

	for _, gr := range kinds {
		status, _ := r.storageStatus.Status(ctx, gr)
		if status.ReadUnified {
			return fmt.Errorf("unexpected state - already using unified storage for: %s", gr)
		}
		if status.Migrating > 0 {
			if time.Since(time.UnixMilli(status.Migrating)) < time.Second*30 {
				return fmt.Errorf("another migration job is running for: %s", gr)
			}
		}
		settings := resource.BatchSettings{
			RebuildCollection: true, // wipes everything in the collection
			Collection: []*resource.ResourceKey{{
				Namespace: ns,
				Group:     gr.Group,
				Resource:  gr.Resource,
			}},
		}
		ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
		stream, err := r.batch.BatchProcess(ctx)
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
		_, err = r.storageStatus.Update(ctx, status)
		if err != nil {
			return err
		}
	}

	return nil
}
