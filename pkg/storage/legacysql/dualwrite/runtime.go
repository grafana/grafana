package dualwrite

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func (m *service) NewStorage(gr schema.GroupResource, legacy grafanarest.Storage, unified grafanarest.Storage) (grafanarest.Storage, error) {
	status, err := m.Status(context.Background(), gr)
	if err != nil {
		return nil, err
	}

	if m.enabled && status.Runtime {
		// Dynamic storage behavior
		return &runtimeDualWriter{
			service:   m,
			legacy:    legacy,
			unified:   unified,
			dualwrite: &dualWriter{legacy: legacy, unified: unified}, // not used for read
			gr:        gr,
		}, nil
	}

	if status.ReadUnified {
		if status.WriteLegacy {
			// Write both, read unified
			return &dualWriter{legacy: legacy, unified: unified, readUnified: true}, nil
		}
		return unified, nil
	}
	if status.WriteUnified {
		// Write both, read legacy
		return &dualWriter{legacy: legacy, unified: unified}, nil
	}
	return legacy, nil
}

// The runtime dual writer implements the various modes we have described as: mode:1/2/3/4/5
// However the behavior can be configured at runtime rather than just at startup.
// When a resource is marked as "migrating", all write requests will be 503 unavailable
type runtimeDualWriter struct {
	service   Service
	legacy    grafanarest.Storage
	unified   grafanarest.Storage
	dualwrite *dualWriter
	gr        schema.GroupResource
}

func (d *runtimeDualWriter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	unified, err := d.service.ReadFromUnified(ctx, d.gr)
	if err != nil {
		return nil, err
	}
	if unified {
		return d.unified.Get(ctx, name, options)
	}
	return d.legacy.Get(ctx, name, options)
}

func (d *runtimeDualWriter) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	unified, err := d.service.ReadFromUnified(ctx, d.gr)
	if err != nil {
		return nil, err
	}
	if unified {
		return d.unified.List(ctx, options)
	}
	return d.legacy.List(ctx, options)
}

func (d *runtimeDualWriter) getWriter(ctx context.Context) (grafanarest.Storage, error) {
	status, err := d.service.Status(ctx, d.gr)
	if err != nil {
		return nil, err
	}

	if status.Migrating > 0 {
		return nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Code:    http.StatusServiceUnavailable,
				Message: "the system is migrating",
			},
		}
	}
	if status.WriteLegacy {
		if status.WriteUnified {
			return d.dualwrite, nil
		}
		return d.legacy, nil // only write legacy (mode0)
	}
	return d.unified, nil // only write unified (mode4)
}

func (d *runtimeDualWriter) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, err
	}
	return store.Create(ctx, in, createValidation, options)
}

func (d *runtimeDualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, false, err
	}
	return store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func (d *runtimeDualWriter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, false, err
	}
	return store.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *runtimeDualWriter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, err
	}
	return store.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

func (d *runtimeDualWriter) Destroy() {
	d.dualwrite.Destroy()
}

func (d *runtimeDualWriter) GetSingularName() string {
	return d.unified.GetSingularName()
}

func (d *runtimeDualWriter) NamespaceScoped() bool {
	return d.unified.NamespaceScoped()
}

func (d *runtimeDualWriter) New() runtime.Object {
	return d.unified.New()
}

func (d *runtimeDualWriter) NewList() runtime.Object {
	return d.unified.NewList()
}

func (d *runtimeDualWriter) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.unified.ConvertToTable(ctx, object, tableOptions)
}
