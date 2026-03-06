package dashboard

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// ContextREST implements the subresource for Dashboard context handling Unified and DualWriter storage.
type ContextREST struct {
	parentStore rest.Storage
}

type SubresourceBuilder = func(parent rest.Storage) rest.Storage

func NewContextREST(parent rest.Storage) rest.Storage {
	return &ContextREST{
		parentStore: parent,
	}
}

var _ rest.Getter = &ContextREST{}
var _ rest.Updater = &ContextREST{}
var _ rest.StorageMetadata = &ContextREST{}
var _ rest.ResetFieldsStrategy = &ContextREST{}

func (r *ContextREST) New() runtime.Object {
	return &dashv2.Dashboard{}
}

func (r *ContextREST) Destroy() {}

func (r *ContextREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *ContextREST) ProducesObject(verb string) interface{} {
	return &dashv2.Dashboard{}
}

func (r *ContextREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	getter, ok := r.parentStore.(rest.Getter)
	if !ok {
		return nil, fmt.Errorf("parent store does not implement rest.Getter")
	}

	obj, err := getter.Get(ctx, name, options)
	if err != nil {
		return nil, err
	}

	dash, ok := obj.(*dashv2.Dashboard)
	if !ok {
		return nil, fmt.Errorf("object is not a dashboard: %T", obj)
	}

	return dash, nil
}

func (r *ContextREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	updater, ok := r.parentStore.(rest.Updater)
	if !ok {
		return nil, false, fmt.Errorf("parent store does not implement rest.Updater")
	}

	// We wrap the objInfo to intercept the update and apply our context-only transformation
	wrappedObjInfo := &contextUpdatedObjectInfo{
		objInfo: objInfo,
	}

	// Call the parent update with our wrapped objInfo
	return updater.Update(ctx, name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
}

type contextUpdatedObjectInfo struct {
	objInfo rest.UpdatedObjectInfo
}

func (i *contextUpdatedObjectInfo) Preconditions() *metav1.Preconditions {
	return i.objInfo.Preconditions()
}

func (i *contextUpdatedObjectInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	// Call the original UpdatedObject to get the new object as the client intended (merging patch, etc)
	newObj, err := i.objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}

	if newObj == nil {
		return nil, fmt.Errorf("new object is nil")
	}

	newDash, ok := newObj.(*dashv2.Dashboard)
	if !ok {
		return nil, fmt.Errorf("new object is not a dashboard: %T", newObj)
	}

	oldDash, ok := oldObj.(*dashv2.Dashboard)
	if !ok {
		return nil, fmt.Errorf("old object is not a dashboard: %T", oldObj)
	}

	// Create a copy of the old dashboard and only apply the context from the new dashboard
	updatedDash := oldDash.DeepCopy()
	updatedDash.Context = newDash.Context

	return updatedDash, nil
}

func (r *ContextREST) GroupVersionKind(metav1.GroupVersion) schema.GroupVersionKind {
	return dashv2.DashboardResourceInfo.GroupVersionKind()
}

func (r *ContextREST) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return nil
}
