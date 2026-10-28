package dashboard

import (
	"context"
	"errors"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

const (
	dashboardPreferencesListPageSize = 500
	// Bounds the folder-tier scan; one page holds every folder that has defaults in all but huge orgs.
	dashboardPreferencesListMaxPages = 20
)

// Embeds grafanarest.Storage, which has no rest.Watcher or rest.CollectionDeleter, so watch and
// deletecollection are not served: unified storage does no per-user filtering for this resource.
type dashboardPreferencesStorage struct {
	grafanarest.Storage
	gvk          schema.GroupVersionKind
	accessClient authlib.AccessClient
}

func newDashboardPreferencesStorage(store grafanarest.Storage, gvk schema.GroupVersionKind, accessClient authlib.AccessClient) *dashboardPreferencesStorage {
	return &dashboardPreferencesStorage{Storage: store, gvk: gvk, accessClient: accessClient}
}

func (s *dashboardPreferencesStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	updated, created, err := s.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err == nil || !isDashboardPreferencesNotFound(err, name) {
		return updated, created, err
	}

	// JSON, merge and strategic-merge PATCH on a missing object get NotFound from the patcher, which
	// needs an old object with a UID; PUT and apply create directly
	placeholder, err := s.newEmptyDashboardPreferences(ctx, name)
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

	createdObj, err := s.Create(ctx, obj, createValidation, dashboardPreferencesCreateOptionsFrom(options))
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
func (s *dashboardPreferencesStorage) newEmptyDashboardPreferences(ctx context.Context, name string) (*dashv2beta1.DashboardPreferences, error) {
	scope, ok := dashboardPreferencesScopeFromName(name)
	if !ok {
		return nil, apierrors.NewBadRequest("invalid dashboard preferences name")
	}

	obj := &dashv2beta1.DashboardPreferences{}
	obj.GetObjectKind().SetGroupVersionKind(s.gvk)
	obj.SetName(name)
	obj.SetNamespace(k8srequest.NamespaceValue(ctx))
	switch scope.Tier {
	case dashboardPreferencesTierFolder:
		accessor, err := utils.MetaAccessor(obj)
		if err != nil {
			return nil, err
		}
		accessor.SetFolder(scope.FolderUID)
	case dashboardPreferencesTierUser:
		obj.Spec.UserUID = new(scope.UserUID)
	case dashboardPreferencesTierOrg:
		// The org tier has neither a folder nor an owner.
	}
	obj.SetUID(gapiutil.CalculateClusterWideUID(obj))
	return obj, nil
}

func dashboardPreferencesCreateOptionsFrom(options *metav1.UpdateOptions) *metav1.CreateOptions {
	opts := &metav1.CreateOptions{}
	if options != nil {
		opts.DryRun = options.DryRun
		opts.FieldManager = options.FieldManager
		opts.FieldValidation = options.FieldValidation
	}
	return opts
}

// True only for this resource and name: other NotFounds (for example a missing folder) must not turn an update into a create.
func isDashboardPreferencesNotFound(err error, name string) bool {
	if !apierrors.IsNotFound(err) {
		return false
	}
	var status apierrors.APIStatus
	if !errors.As(err, &status) {
		return false
	}
	details := status.Status().Details
	gr := dashv2beta1.DashboardPreferencesResourceInfo.GroupResource()
	return details != nil && details.Group == gr.Group && details.Kind == gr.Resource && details.Name == name
}

// List returns only what the caller can read, because the authorizer lets a list through and unified
// storage does no per-user filtering for this resource. Like preferences.grafana.app, it reads the org
// and user tiers by name, and it finds the folder tier by its tier label, so it never receives another
// user's object. It returns a single page with no continue token: a store's token encodes the next
// object's name, which may be another user's, or an offset into the unfiltered list.
func (s *dashboardPreferencesStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting requester: %w", err)
	}
	// The authorizer already limited what a token may do, and folder and user cleanup must find every
	// object.
	if requester.IsIdentityType(authlib.TypeAccessPolicy) {
		return s.Storage.List(ctx, options)
	}

	if options == nil {
		options = &internalversion.ListOptions{}
	}
	if options.Continue != "" {
		return nil, apierrors.NewBadRequest("continue is not supported for dashboard preferences")
	}
	if options.LabelSelector != nil && !options.LabelSelector.Empty() {
		return nil, apierrors.NewBadRequest("labelSelector is not supported for dashboard preferences")
	}

	namespace := k8srequest.NamespaceValue(ctx)
	// Not nil, so an empty list encodes its items as [] like the store's lists.
	list := &dashv2beta1.DashboardPreferencesList{Items: []dashv2beta1.DashboardPreferences{}}

	// A name selector reads a single object, which the tier rules can judge like a get.
	if options.FieldSelector != nil && !options.FieldSelector.Empty() {
		// The field selector parser reads both = and == as Equals.
		requirements := options.FieldSelector.Requirements()
		if len(requirements) != 1 || requirements[0].Field != "metadata.name" || requirements[0].Operator != selection.Equals {
			return nil, apierrors.NewBadRequest("only a single metadata.name=<name> fieldSelector is supported for dashboard preferences")
		}
		items, err := s.visibleByName(ctx, requester, namespace, requirements[0].Value)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, items...)
		return list, nil
	}

	names := []string{dashv2beta1.DashboardPreferencesOrgName}
	if requester.IsIdentityType(authlib.TypeUser) {
		names = append(names, dashv2beta1.DashboardPreferencesUserName(requester.GetIdentifier()))
	}
	for _, name := range names {
		items, err := s.visibleByName(ctx, requester, namespace, name)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, items...)
	}

	// Other identities, such as a render request that got this far, get the org tier only.
	if requester.IsIdentityType(authlib.TypeUser, authlib.TypeServiceAccount) {
		items, err := s.visibleFolderTier(ctx, requester, namespace)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, items...)
	}
	return list, nil
}

// visibleByName returns the named object if it exists and the caller may read it under the tier rules
// of a named get, which the authorizer skipped for the list.
func (s *dashboardPreferencesStorage) visibleByName(ctx context.Context, requester identity.Requester, namespace, name string) ([]dashv2beta1.DashboardPreferences, error) {
	scope, ok := dashboardPreferencesScopeFromName(name)
	if !ok {
		return nil, nil
	}

	if scope.Tier == dashboardPreferencesTierFolder {
		if !s.canCheckFolderAccess(requester, namespace) {
			return nil, nil
		}
		items, err := s.getStored(ctx, name)
		if err != nil {
			return nil, err
		}
		// Judged once read, by the same rule as the folder tier of a list.
		return s.readableFolderTier(ctx, namespace, items)
	}

	decision, _, err := authorizeDashboardPreferencesName(ctx, s.accessClient, requester, namespace, name, utils.VerbGet)
	if err != nil || decision != authorizer.DecisionAllow {
		return nil, err
	}
	return s.getStored(ctx, name)
}

// getStored returns the named object, or nothing when it isn't stored.
func (s *dashboardPreferencesStorage) getStored(ctx context.Context, name string) ([]dashv2beta1.DashboardPreferences, error) {
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	item, ok := obj.(*dashv2beta1.DashboardPreferences)
	if !ok {
		return nil, fmt.Errorf("expected dashboard preferences, got %T", obj)
	}
	return []dashv2beta1.DashboardPreferences{*item}, nil
}

// visibleFolderTier returns, in storage order, the folder-tier objects whose folder the caller can read.
// It finds them by the tier label, so it never receives user-tier objects. A store that answers the
// label by scanning still counts every tier toward its page limit, so the page cap can be reached
// with no folder left out.
func (s *dashboardPreferencesStorage) visibleFolderTier(ctx context.Context, requester identity.Requester, namespace string) ([]dashv2beta1.DashboardPreferences, error) {
	if !s.canCheckFolderAccess(requester, namespace) {
		return nil, nil
	}

	selector := labels.SelectorFromSet(labels.Set{dashboardPreferencesTierLabelKey: string(dashboardPreferencesTierFolder)})
	var items []dashv2beta1.DashboardPreferences
	continueToken := ""
	for range dashboardPreferencesListMaxPages {
		obj, err := s.Storage.List(ctx, &internalversion.ListOptions{
			LabelSelector: selector,
			Limit:         dashboardPreferencesListPageSize,
			Continue:      continueToken,
		})
		if err != nil {
			return nil, err
		}
		page, ok := obj.(*dashv2beta1.DashboardPreferencesList)
		if !ok {
			return nil, fmt.Errorf("expected dashboard preferences list, got %T", obj)
		}
		items = append(items, page.Items...)
		continueToken = page.Continue
		if continueToken == "" {
			break
		}
	}
	if continueToken != "" {
		logging.FromContext(ctx).Warn("dashboard preferences list reached the folder tier page cap and may have left out folders",
			"namespace", namespace, "pages", dashboardPreferencesListMaxPages)
	}
	return s.readableFolderTier(ctx, namespace, items)
}

// readableFolderTier keeps, in order, the folder-tier objects whose folder the caller can read. The
// tier label only indexes the tier, so an object belongs to it only if its annotation is the folder its
// name gives. A folder whose check failed fails the call instead of being left out as if it were denied.
func (s *dashboardPreferencesStorage) readableFolderTier(ctx context.Context, namespace string, items []dashv2beta1.DashboardPreferences) ([]dashv2beta1.DashboardPreferences, error) {
	candidates := make([]dashv2beta1.DashboardPreferences, 0, len(items))
	for _, item := range items {
		scope, ok := dashboardPreferencesScopeFromName(item.Name)
		if ok && scope.Tier == dashboardPreferencesTierFolder && item.Annotations[utils.AnnoKeyFolder] == scope.FolderUID {
			candidates = append(candidates, item)
		}
	}

	readable := authz.FilterAuthorized(ctx, batchItemErrorClient{s.accessClient}, slices.Values(candidates), func(item dashv2beta1.DashboardPreferences) authz.BatchCheckItem {
		folderUID := item.Annotations[utils.AnnoKeyFolder]
		// The folder is its own parent, as in checkDashboardPreferencesFolderAccess.
		return authz.BatchCheckItem{
			Group:     folders.GROUP,
			Resource:  folders.RESOURCE,
			Verb:      utils.VerbGet,
			Namespace: namespace,
			Name:      folderUID,
			Folder:    folderUID,
		}
	})
	visible := make([]dashv2beta1.DashboardPreferences, 0, len(candidates))
	for item, err := range readable {
		if err != nil {
			return nil, err
		}
		visible = append(visible, item)
	}
	return visible, nil
}

// Without an access client no folder is readable, and the access client fails a check for another
// namespace, where the caller can read no folder anyway; see checkDashboardPreferencesFolderAccess.
func (s *dashboardPreferencesStorage) canCheckFolderAccess(requester identity.Requester, namespace string) bool {
	return s.accessClient != nil && authlib.NamespaceMatches(requester.GetNamespace(), namespace)
}

// batchItemErrorClient fails a batch check when any of its items failed. FilterAuthorized reads only
// Allowed, so it would leave out a folder whose check failed as if it were denied, while a named get
// of the same object fails.
type batchItemErrorClient struct {
	authlib.AccessClient
}

func (c batchItemErrorClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	resp, err := c.AccessClient.BatchCheck(ctx, info, req)
	if err != nil {
		return resp, err
	}
	// In request order, because the results are a map and the first failure should not vary.
	for _, check := range req.Checks {
		if result := resp.Results[check.CorrelationID]; result.Error != nil {
			logging.FromContext(ctx).Error("dashboard preferences list failed to check folder access",
				"namespace", req.Namespace, "folder", check.Name, "err", result.Error)
			return authlib.BatchCheckResponse{}, &folderAccessCheckError{cause: result.Error}
		}
	}
	return resp, nil
}

// folderAccessCheckError keeps its cause out of its text because the apiserver sends the text of a list
// error to the client, and a per-item cause can be the access backend's raw message, which can carry
// datastore details. BatchCheck logs the cause instead.
type folderAccessCheckError struct {
	cause error
}

func (e *folderAccessCheckError) Error() string {
	return "folder access could not be checked"
}

func (e *folderAccessCheckError) Unwrap() error {
	return e.cause
}
