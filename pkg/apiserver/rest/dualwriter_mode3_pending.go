package rest

import (
	"context"
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/storage/legacysql/modecheck"
)

type dualWriterPendingMode3 struct {
	status modecheck.Service
	legacy LegacyStorage
	target *DualWriterMode3
	gr     schema.GroupResource
}

func NewAlmostMode3(
	status modecheck.Service,
	gr schema.GroupResource,

	legacy LegacyStorage,
	storage Storage,
	reg prometheus.Registerer,
	resource string,
) Storage {
	metrics := &dualWriterMetrics{}
	metrics.init(reg)

	return &dualWriterPendingMode3{
		legacy: legacy,
		target: newDualWriterMode3(legacy, storage, metrics, resource),
		status: status,
		gr:     gr,
	}
}

func (d *dualWriterPendingMode3) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if d.status.IsMigrated(ctx, d.gr) {
		return d.target.Get(ctx, name, options)
	}
	return d.legacy.Get(ctx, name, options)
}

func (d *dualWriterPendingMode3) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	if d.status.IsMigrated(ctx, d.gr) {
		return d.target.List(ctx, options)
	}
	return d.legacy.List(ctx, options)
}

func (d *dualWriterPendingMode3) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if d.status.IsMigrated(ctx, d.gr) {
		return d.target.Create(ctx, in, createValidation, options)
	}
	return nil, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Code:    http.StatusServiceUnavailable,
			Message: "the system needs to migrate",
		},
	}
}

func (d *dualWriterPendingMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if d.status.IsMigrated(ctx, d.gr) {
		return d.target.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	}
	return nil, false, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Code:    http.StatusServiceUnavailable,
			Message: "the system needs to migrate",
		},
	}
}

func (d *dualWriterPendingMode3) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if d.status.IsMigrated(ctx, d.gr) {
		return d.target.Delete(ctx, name, deleteValidation, options)
	}
	return nil, false, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Code:    http.StatusServiceUnavailable,
			Message: "the system needs to migrate",
		},
	}
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *dualWriterPendingMode3) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	if d.status.IsMigrated(ctx, d.gr) {
		return d.target.DeleteCollection(ctx, deleteValidation, options, listOptions)
	}
	return nil, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Code:    http.StatusServiceUnavailable,
			Message: "the system needs to migrate",
		},
	}
}

func (d *dualWriterPendingMode3) Destroy() {
	d.target.Destroy()
}

func (d *dualWriterPendingMode3) GetSingularName() string {
	return d.target.GetSingularName()
}

func (d *dualWriterPendingMode3) NamespaceScoped() bool {
	return d.target.NamespaceScoped()
}

func (d *dualWriterPendingMode3) New() runtime.Object {
	return d.target.New()
}

func (d *dualWriterPendingMode3) NewList() runtime.Object {
	return d.target.NewList()
}

func (d *dualWriterPendingMode3) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.target.ConvertToTable(ctx, object, tableOptions)
}
