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

// PreferencesREST implements the subresource for Dashboard preferences.
// It uses the parent Dashboard store to find and update the object.
type PreferencesREST struct {
	parentStore rest.Storage
}

func NewPreferencesREST(parent rest.Storage) *PreferencesREST {
	return &PreferencesREST{
		parentStore: parent,
	}
}

var _ rest.Getter = &PreferencesREST{}
var _ rest.Updater = &PreferencesREST{}
var _ rest.StorageMetadata = &PreferencesREST{}
var _ rest.ResetFieldsStrategy = &PreferencesREST{}

func (r *PreferencesREST) New() runtime.Object {
	return &dashv2.Dashboard{}
}

func (r *PreferencesREST) Destroy() {}

func (r *PreferencesREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *PreferencesREST) ProducesObject(verb string) interface{} {
	return &dashv2.Dashboard{}
}

func (r *PreferencesREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
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

	// For a subresource GET, we should return the root object but the APIServer
	// expects it to be the object that matches the subresource's New() type.
	// Since our New() returns a Dashboard, this is correct.
	return dash, nil
}

func (r *PreferencesREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	updater, ok := r.parentStore.(rest.Updater)
	if !ok {
		return nil, false, fmt.Errorf("parent store does not implement rest.Updater")
	}

	// We wrap the objInfo to intercept the update and apply our preferences-only transformation
	wrappedObjInfo := &preferencesUpdatedObjectInfo{
		objInfo: objInfo,
	}

	// Call the parent update with our wrapped objInfo
	return updater.Update(ctx, name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
}

type preferencesUpdatedObjectInfo struct {
	objInfo rest.UpdatedObjectInfo
}

func (i *preferencesUpdatedObjectInfo) Preconditions() *metav1.Preconditions {
	return i.objInfo.Preconditions()
}

func (i *preferencesUpdatedObjectInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
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

	// Create a copy of the old dashboard and only apply the preferences from the new dashboard
	updatedDash := oldDash.DeepCopy()
	updatedDash.Preferences = newDash.Preferences

	return updatedDash, nil
}

func (r *PreferencesREST) GroupVersionKind(metav1.GroupVersion) schema.GroupVersionKind {
	return dashv2.DashboardResourceInfo.GroupVersionKind()
}

func (r *PreferencesREST) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return nil
}
