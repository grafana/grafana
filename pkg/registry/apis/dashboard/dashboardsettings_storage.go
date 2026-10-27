package dashboard

import (
	"context"
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

// Embeds grafanarest.Storage, which has no rest.Watcher or rest.CollectionDeleter, so watch and
// deletecollection are not served: unified storage does no per-user filtering for this resource.
type dashboardSettingsStorage struct {
	grafanarest.Storage
	gvk          schema.GroupVersionKind
	accessClient authlib.AccessClient
}

func newDashboardSettingsStorage(store grafanarest.Storage, gvk schema.GroupVersionKind, accessClient authlib.AccessClient) *dashboardSettingsStorage {
	return &dashboardSettingsStorage{Storage: store, gvk: gvk, accessClient: accessClient}
}

func (s *dashboardSettingsStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	updated, created, err := s.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err == nil || !isDashboardSettingsNotFound(err, name) {
		return updated, created, err
	}

	// JSON, merge and strategic-merge PATCH on a missing object get NotFound from the patcher, which
	// needs an old object with a UID; PUT and apply create directly
	placeholder, err := s.newEmptyDashboardSettings(ctx, name)
	if err != nil {
		return nil, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, placeholder)
	if err != nil {
		return nil, false, err
	}

	// Both Kubernetes create paths wipe the system metadata a client sent. A patch can set it and
	// Create refills only the UID and creation time, so a patched-in deletion timestamp would be
	// stored, creating an object that is already being deleted.
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, false, err
	}
	rest.WipeObjectMetaSystemFields(accessor)

	createdObj, err := s.Create(ctx, obj, createValidation, dashboardSettingsCreateOptionsFrom(options))
	if err == nil {
		return createdObj, true, nil
	}
	// Another request created it first, so the patch applies to what it stored.
	if !apierrors.IsAlreadyExists(err) {
		return nil, false, err
	}
	return s.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

// The placeholder carries the scope the name gives because a spec-only patch can't supply it, and a
// UID because the patchers refuse an old object without one.
func (s *dashboardSettingsStorage) newEmptyDashboardSettings(ctx context.Context, name string) (*dashv2beta1.DashboardSettings, error) {
	scope, ok := dashboardSettingsScopeFromName(name)
	if !ok {
		return nil, apierrors.NewBadRequest("invalid dashboard settings name")
	}

	obj := &dashv2beta1.DashboardSettings{}
	obj.GetObjectKind().SetGroupVersionKind(s.gvk)
	obj.SetName(name)
	obj.SetNamespace(k8srequest.NamespaceValue(ctx))
	switch scope.Tier {
	case dashboardSettingsTierFolder:
		accessor, err := utils.MetaAccessor(obj)
		if err != nil {
			return nil, err
		}
		accessor.SetFolder(scope.FolderUID)
	case dashboardSettingsTierUser:
		obj.Spec.UserUID = new(scope.UserUID)
	case dashboardSettingsTierOrg:
		// The org tier has neither a folder nor an owner.
	}
	obj.SetUID(gapiutil.CalculateClusterWideUID(obj))
	return obj, nil
}

func dashboardSettingsCreateOptionsFrom(options *metav1.UpdateOptions) *metav1.CreateOptions {
	opts := &metav1.CreateOptions{}
	if options != nil {
		opts.DryRun = options.DryRun
		opts.FieldManager = options.FieldManager
		opts.FieldValidation = options.FieldValidation
	}
	return opts
}

// True only for this resource and name: other NotFounds (for example a missing folder) must not turn an update into a create.
func isDashboardSettingsNotFound(err error, name string) bool {
	if !apierrors.IsNotFound(err) {
		return false
	}
	var status apierrors.APIStatus
	if !errors.As(err, &status) {
		return false
	}
	details := status.Status().Details
	gr := dashv2beta1.DashboardSettingsResourceInfo.GroupResource()
	return details != nil && details.Group == gr.Group && details.Kind == gr.Resource && details.Name == name
}
