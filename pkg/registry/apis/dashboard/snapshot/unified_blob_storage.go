package snapshot

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// unifiedBlobStorage keeps the legacy writer's dashboard inline while storing a
// blob reference on the copy sent to unified storage.
type unifiedBlobStorage struct {
	grafanarest.Storage
	blobs resourcepb.BlobStoreClient
}

func NewUnifiedBlobStorage(storage grafanarest.Storage, blobs resourcepb.BlobStoreClient) grafanarest.Storage {
	return &unifiedBlobStorage{Storage: storage, blobs: blobs}
}

func (s *unifiedBlobStorage) Create(ctx context.Context, obj runtime.Object, validate rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot object, got %T", obj)
	}
	copy := snap.DeepCopy()
	if s.blobs != nil && copy.Spec.Dashboard != nil && (copy.Spec.External == nil || !*copy.Spec.External) && !dryrun.IsDryRun(options.DryRun) {
		if err := moveDashboardToBlob(ctx, s.blobs, copy); err != nil {
			return nil, err
		}
	}
	return s.Storage.Create(ctx, copy, validate, options)
}
