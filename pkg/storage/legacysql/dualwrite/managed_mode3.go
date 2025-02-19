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

func (m *service) NewStorage(gr schema.GroupResource,
	legacy grafanarest.LegacyStorage,
	storage grafanarest.Storage,
) (grafanarest.Storage, error) {
	status, err := m.Status(context.Background(), gr)
	if err != nil {
		return nil, err
	}

	if m.enabled && status.Runtime {
		// Dynamic storage behavior
		return &mangedMode3{
			service:   m,
			legacy:    legacy,
			unified:   storage,
			dualwrite: grafanarest.NewDualWriter(grafanarest.Mode3, legacy, storage, m.reg, gr.String()),
			gr:        gr,
		}, nil
	}

	if status.ReadUnified {
		if status.WriteLegacy {
			// Write both, read unified
			return grafanarest.NewDualWriter(grafanarest.Mode3, legacy, storage, m.reg, gr.String()), nil
		}
		return storage, nil
	}
	if status.WriteUnified {
		// Write both, read legacy
		return grafanarest.NewDualWriter(grafanarest.Mode2, legacy, storage, m.reg, gr.String()), nil
	}
	return legacy, nil
}

type mangedMode3 struct {
	service   Service
	legacy    grafanarest.LegacyStorage
	unified   grafanarest.Storage
	dualwrite grafanarest.Storage
	gr        schema.GroupResource
}

func (d *mangedMode3) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	unified, err := d.service.ReadFromUnified(ctx, d.gr)
	if err != nil {
		return nil, err
	}
	if unified {
		return d.unified.Get(ctx, name, options)
	}
	return d.legacy.Get(ctx, name, options)
}

func (d *mangedMode3) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	unified, err := d.service.ReadFromUnified(ctx, d.gr)
	if err != nil {
		return nil, err
	}
	if unified {
		return d.unified.List(ctx, options)
	}
	return d.legacy.List(ctx, options)
}

func (d *mangedMode3) getWriter(ctx context.Context) (grafanarest.Storage, error) {
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

func (d *mangedMode3) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, err
	}
	return store.Create(ctx, in, createValidation, options)
}

func (d *mangedMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, false, err
	}
	return store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func (d *mangedMode3) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, false, err
	}
	return store.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *mangedMode3) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	store, err := d.getWriter(ctx)
	if err != nil {
		return nil, err
	}
	return store.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

func (d *mangedMode3) Destroy() {
	d.dualwrite.Destroy()
}

func (d *mangedMode3) GetSingularName() string {
	return d.unified.GetSingularName()
}

func (d *mangedMode3) NamespaceScoped() bool {
	return d.unified.NamespaceScoped()
}

func (d *mangedMode3) New() runtime.Object {
	return d.unified.New()
}

func (d *mangedMode3) NewList() runtime.Object {
	return d.unified.NewList()
}

func (d *mangedMode3) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.unified.ConvertToTable(ctx, object, tableOptions)
}
