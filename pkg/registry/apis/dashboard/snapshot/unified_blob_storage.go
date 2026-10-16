package snapshot

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/util/dryrun"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// NewUnifiedBlobStorage keeps the legacy writer's dashboard inline while storing a
// blob reference on the copy sent to unified storage.
func NewUnifiedBlobStorage(storage grafanarest.Storage, blobs resourcepb.BlobStoreClient) grafanarest.Storage {
	return grafanarest.WithPrepareCreate(storage, func(ctx context.Context, obj runtime.Object, options *metav1.CreateOptions) error {
		snap, ok := obj.(*dashv0.Snapshot)
		if !ok {
			return fmt.Errorf("expected Snapshot object, got %T", obj)
		}
		if blobs != nil && snap.Spec.Dashboard != nil && (snap.Spec.External == nil || !*snap.Spec.External) && !dryrun.IsDryRun(options.DryRun) {
			return moveDashboardToBlob(ctx, blobs, snap)
		}
		return nil
	})
}
