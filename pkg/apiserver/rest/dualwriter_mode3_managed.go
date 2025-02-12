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

// Hardcoded list of resources that should be controlled by the database (eventually everything?)
func ShouldManageDualWriter(gr schema.GroupResource) bool {
	switch gr.String() {
	case "folders.folder.grafana.app":
		return true
	case "dashboards.dashboard.grafana.app":
		return true
	}
	return false
}

func NewManagedDualWriter(service modecheck.Service,
	gr schema.GroupResource,
	legacy LegacyStorage,
	storage Storage,
	reg prometheus.Registerer,
) (Storage, error) {
	metrics := &dualWriterMetrics{}
	metrics.init(reg)

	status, _ := service.Status(context.Background(), gr)

	// Support startup modes without special
	if !status.Runtime {
		if status.ReadUnified {
			if status.WriteLegacy {
				// Write both, read unified
				return newDualWriterMode3(legacy, storage, metrics, gr.String()), nil
			}
			return storage, nil
		}
		if status.WriteUnified {
			// Write both, read legacy
			return newDualWriterMode2(legacy, storage, metrics, gr.String()), nil
		}
		return legacy, nil
	}

	return &dualWriterMode3Managed{
		status:  service,
		legacy:  legacy,
		unified: storage,
		target:  newDualWriterMode3(legacy, storage, metrics, gr.String()),
		gr:      gr,
	}, nil
}

type dualWriterMode3Managed struct {
	status  modecheck.Service
	legacy  LegacyStorage
	unified Storage
	target  *DualWriterMode3
	gr      schema.GroupResource
}

func (d *dualWriterMode3Managed) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if d.status.ReadUnified(ctx, d.gr) {
		return d.unified.Get(ctx, name, options)
	}
	return d.legacy.Get(ctx, name, options)
}

func (d *dualWriterMode3Managed) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	if d.status.ReadUnified(ctx, d.gr) {
		return d.unified.List(ctx, options)
	}
	return d.legacy.List(ctx, options)
}

func (d *dualWriterMode3Managed) isMigrating(ctx context.Context) error {
	status, ok := d.status.Status(ctx, d.gr)
	if ok && status.Migrating > 0 {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Code:    http.StatusServiceUnavailable,
				Message: "the system is migrating",
			},
		}
	}
	return nil
}

func (d *dualWriterMode3Managed) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if err := d.isMigrating(ctx); err != nil {
		return nil, err
	}
	return d.target.Create(ctx, in, createValidation, options)
}

func (d *dualWriterMode3Managed) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if err := d.isMigrating(ctx); err != nil {
		return nil, false, err
	}
	return d.target.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func (d *dualWriterMode3Managed) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if err := d.isMigrating(ctx); err != nil {
		return nil, false, err
	}
	return d.target.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *dualWriterMode3Managed) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	if err := d.isMigrating(ctx); err != nil {
		return nil, err
	}
	return d.target.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

func (d *dualWriterMode3Managed) Destroy() {
	d.target.Destroy()
}

func (d *dualWriterMode3Managed) GetSingularName() string {
	return d.target.GetSingularName()
}

func (d *dualWriterMode3Managed) NamespaceScoped() bool {
	return d.target.NamespaceScoped()
}

func (d *dualWriterMode3Managed) New() runtime.Object {
	return d.target.New()
}

func (d *dualWriterMode3Managed) NewList() runtime.Object {
	return d.target.NewList()
}

func (d *dualWriterMode3Managed) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.target.ConvertToTable(ctx, object, tableOptions)
}
