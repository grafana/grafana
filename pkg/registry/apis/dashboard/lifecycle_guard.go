package dashboard

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// lifecycleGuard hides dashboard drafts and forks from everyone except their owner
// and org admins. Folder permissions can't be narrowed per dashboard, so the rule is
// enforced on top of the regular storage: a hidden dashboard reads as not found.
type lifecycleGuard struct {
	grafanarest.Storage
	resource schema.GroupResource
}

func newLifecycleGuard(store grafanarest.Storage, resource schema.GroupResource) grafanarest.Storage {
	return &lifecycleGuard{Storage: store, resource: resource}
}

func (g *lifecycleGuard) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj, err := g.Storage.Get(ctx, name, options)
	if err != nil {
		return nil, err
	}
	if !canAccessPrivateLifecycleObject(ctx, obj) {
		return nil, apierrors.NewNotFound(g.resource, name)
	}
	return obj, nil
}

func (g *lifecycleGuard) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	list, err := g.Storage.List(ctx, options)
	if err != nil {
		return nil, err
	}
	items, err := meta.ExtractList(list)
	if err != nil {
		return list, nil
	}
	visible := make([]runtime.Object, 0, len(items))
	for _, item := range items {
		if canAccessPrivateLifecycleObject(ctx, item) {
			visible = append(visible, item)
		}
	}
	if len(visible) == len(items) {
		return list, nil
	}
	if err := meta.SetList(list, visible); err != nil {
		return nil, err
	}
	return list, nil
}

func (g *lifecycleGuard) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if err := g.checkExisting(ctx, name); err != nil {
		return nil, false, err
	}
	return g.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func (g *lifecycleGuard) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if err := g.checkExisting(ctx, name); err != nil {
		return nil, false, err
	}
	return g.Storage.Delete(ctx, name, deleteValidation, options)
}

// checkExisting refuses writes to a hidden dashboard. A missing dashboard is left
// to the underlying storage so creates and not-found errors behave as before.
func (g *lifecycleGuard) checkExisting(ctx context.Context, name string) error {
	obj, err := g.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil
	}
	if !canAccessPrivateLifecycleObject(ctx, obj) {
		return apierrors.NewNotFound(g.resource, name)
	}
	return nil
}
