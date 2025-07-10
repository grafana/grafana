package migrate

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

//go:generate mockery --name BulkStoreClient --structname MockBulkStoreClient --inpackage --filename mock_bulk_store_client.go --with-expecter
//go:generate mockery --name=BulkStore_BulkProcessClient --srcpkg=github.com/grafana/grafana/pkg/storage/unified/resource --output=. --outpkg=migrate --filename=mock_bulk_process_client.go --with-expecter
type BulkStoreClient interface {
	BulkProcess(ctx context.Context, opts ...grpc.CallOption) (resourcepb.BulkStore_BulkProcessClient, error)
}

//go:generate mockery --name StorageSwapper --structname MockStorageSwapper --inpackage --filename mock_storage_swapper.go --with-expecter
type StorageSwapper interface {
	StopReadingUnifiedStorage(ctx context.Context) error
	WipeUnifiedAndSetMigratedFlag(ctx context.Context, namespace string) error
}

type storageSwapper struct {
	// Direct access to unified storage... use carefully!
	bulk BulkStoreClient
	dual dualwrite.Service
}

func NewStorageSwapper(bulk BulkStoreClient, dual dualwrite.Service) StorageSwapper {
	return &storageSwapper{
		bulk: bulk,
		dual: dual,
	}
}

func (s *storageSwapper) StopReadingUnifiedStorage(ctx context.Context) error {
	// FIXME: dual writer is not namespaced which means that we would consider all namespaces migrated
	// after one migrates
	for _, gr := range resources.SupportedProvisioningResources {
		status, _ := s.dual.Status(ctx, gr.GroupResource())
		status.ReadUnified = false
		status.Migrated = 0
		status.Migrating = 0
		_, err := s.dual.Update(ctx, status)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *storageSwapper) WipeUnifiedAndSetMigratedFlag(ctx context.Context, namespace string) error {
	for _, gr := range resources.SupportedProvisioningResources {
		status, _ := s.dual.Status(ctx, gr.GroupResource())
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
			Collection: []*resourcepb.ResourceKey{{
				Namespace: namespace,
				Group:     gr.Group,
				Resource:  gr.Resource,
			}},
		}
		ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
		stream, err := s.bulk.BulkProcess(ctx)
		if err != nil {
			return fmt.Errorf("error clearing unified %s / %w", gr, err)
		}
		stats, err := stream.CloseAndRecv()
		if err != nil {
			return fmt.Errorf("error clearing unified %s / %w", gr, err)
		}
		logger := logging.FromContext(ctx)
		logger.Error("cleared unified storage", "stats", stats)

		status.Migrated = time.Now().UnixMilli() // but not really... since the sync is starting
		status.ReadUnified = true
		status.WriteLegacy = false // keep legacy "clean"
		_, err = s.dual.Update(ctx, status)
		if err != nil {
			return err
		}
	}

	return nil
}
