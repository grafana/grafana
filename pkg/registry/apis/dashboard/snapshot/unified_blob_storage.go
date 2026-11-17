package snapshot

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	registryrest "k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

type unifiedBlobStorage struct {
	grafanarest.Storage
}

// NewUnifiedBlobStorage validates Snapshot input before REST dry-run can bypass
// apistore, and redacts write-only data from the resulting resource.
func NewUnifiedBlobStorage(storage grafanarest.Storage) grafanarest.Storage {
	return &unifiedBlobStorage{Storage: storage}
}

func (s *unifiedBlobStorage) Update(ctx context.Context, name string, objInfo registryrest.UpdatedObjectInfo, createValidation registryrest.ValidateObjectFunc, updateValidation registryrest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("snapshots are immutable and cannot be updated")
}

func (s *unifiedBlobStorage) Create(ctx context.Context, obj runtime.Object, validate registryrest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot object, got %T", obj)
	}
	if _, err := inlineDashboardContent(snap); err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	prepared := snap.DeepCopy()
	if prepared.Spec.External != nil && *prepared.Spec.External {
		redactDashboardInput(prepared)
	}
	result, err := s.Storage.Create(ctx, prepared, validate, options)
	if err != nil {
		return nil, err
	}
	created, ok := result.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot result, got %T", result)
	}
	created = created.DeepCopy()
	redactDashboardInput(created)
	return created, nil
}
