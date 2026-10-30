package snapshot

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	registryrest "k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type unifiedBlobStorage struct {
	grafanarest.Storage
	blobs resourcepb.BlobStoreClient
}

// NewUnifiedBlobStorage stores snapshot dashboards as blobs on the unified side
// without changing the legacy result or the object returned by the dual writer.
func NewUnifiedBlobStorage(storage grafanarest.Storage, blobs resourcepb.BlobStoreClient) grafanarest.Storage {
	return &unifiedBlobStorage{Storage: storage, blobs: blobs}
}

func (s *unifiedBlobStorage) Create(ctx context.Context, obj runtime.Object, validate registryrest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot object, got %T", obj)
	}
	prepared := snap.DeepCopy()
	// A blob must be tied to the final resource key. An unnamed Kubernetes create
	// can still generate its name in the underlying storage.
	if s.blobs != nil && prepared.Name != "" && prepared.Spec.Dashboard != nil &&
		prepared.Blobs.Dashboard == nil && (prepared.Spec.External == nil || !*prepared.Spec.External) &&
		(options == nil || !dryrun.IsDryRun(options.DryRun)) {
		if err := moveDashboardToBlob(ctx, s.blobs, prepared); err != nil {
			return nil, err
		}
	}
	return s.Storage.Create(ctx, prepared, validate, options)
}
