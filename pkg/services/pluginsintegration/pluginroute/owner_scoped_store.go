package pluginroute

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	requestK8s "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

// ownerScopedStore serves a user only the objects named for them. The name is the
// access control, and storage would otherwise list every user's objects.
// Identities that are not a user (access policies, the renderer) keep the full
// list unless the kind limits them to the namespace's object, and the
// authorizer decides their access.
type ownerScopedStore struct {
	*kindstore.Store
	owned *ownerFromName
	// access decides an explicit team lookup, as a get of that name would
	access authlib.AccessChecker

	// stored reads one stored object, and newList makes an empty list. They are
	// the Store's own, held apart so the scoping can be tested without one.
	stored   func(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error)
	newList  func() runtime.Object
	create   func(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error)
	resource schema.GroupResource
}

func newOwnerScopedStore(store *kindstore.Store, owned *ownerFromName, access authlib.AccessChecker) *ownerScopedStore {
	return &ownerScopedStore{Store: store, owned: owned, access: access, stored: store.Get, newList: store.NewList, create: store.Create, resource: store.DefaultQualifiedResource}
}

// Create authorizes the name in the object, as the authorizer does for a
// request that names it: a POST carries the name only in the body, so the
// authorizer let it through. An access policy was held to its token's
// permissions there instead.
func (s *ownerScopedStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("valid user is required")
	}
	if !authlib.IsIdentityType(user.GetIdentityType(), authlib.TypeAccessPolicy) {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, apierrors.NewBadRequest(err.Error())
		}
		name := accessor.GetName()
		attrs := authorizer.AttributesRecord{User: user, Verb: "create", Name: name, Namespace: requestK8s.NamespaceValue(ctx), ResourceRequest: true}
		decision, reason, err := s.owned.authorize(ctx, user, attrs, s.access)
		if err != nil {
			return nil, err
		}
		if decision != authorizer.DecisionAllow {
			// A name the caller may not use is an invalid object, as the
			// embedded API servers report it.
			gk := schema.GroupKind{Group: s.resource.Group, Kind: obj.GetObjectKind().GroupVersionKind().Kind}
			return nil, apierrors.NewInvalid(gk, name, field.ErrorList{
				field.Forbidden(field.NewPath("metadata", "name"), reason),
			})
		}
	}
	return s.create(ctx, obj, createValidation, options)
}

func (s *ownerScopedStore) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	items, all, err := s.ownedObjects(ctx)
	if err != nil {
		return nil, err
	}
	if all {
		return s.Store.List(ctx, options)
	}
	if options != nil && options.Continue != "" {
		return nil, apierrors.NewBadRequest("continue token not supported")
	}
	if options != nil && options.LabelSelector != nil && !options.LabelSelector.Empty() {
		return nil, apierrors.NewBadRequest("labelSelector not supported")
	}
	if options != nil && options.FieldSelector != nil && !options.FieldSelector.Empty() {
		if items, err = s.selectedObjects(ctx, options.FieldSelector, items); err != nil {
			return nil, err
		}
	}
	list := s.newList()
	if err := meta.SetList(list, items); err != nil {
		return nil, fmt.Errorf("building owned list: %w", err)
	}
	return list, nil
}

// selectedObjects answers a metadata.name selector: the named object when the
// caller may get it, as for an explicit organization or team lookup, else none.
// owned are the objects the caller already owns.
func (s *ownerScopedStore) selectedObjects(ctx context.Context, selector fields.Selector, owned []runtime.Object) ([]runtime.Object, error) {
	reqs := selector.Requirements()
	if len(reqs) != 1 || reqs[0].Field != "metadata.name" || (reqs[0].Operator != selection.Equals && reqs[0].Operator != selection.DoubleEquals) {
		return nil, apierrors.NewBadRequest("only a metadata.name= fieldSelector is supported")
	}
	name := reqs[0].Value

	for _, obj := range owned {
		if m, err := meta.Accessor(obj); err == nil && m.GetName() == name {
			return []runtime.Object{obj}, nil
		}
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if user.GetIdentityType() != authlib.TypeUser {
		return nil, nil // the names they may list are all in owned
	}
	attrs := authorizer.AttributesRecord{User: user, Verb: "get", Name: name, Namespace: user.GetNamespace(), ResourceRequest: true}
	decision, _, err := s.owned.authorize(ctx, user, attrs, s.access)
	if err != nil {
		return nil, err
	}
	if decision != authorizer.DecisionAllow {
		return nil, nil
	}
	obj, err := s.stored(ctx, name, &metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return []runtime.Object{obj}, nil
}

// ownedObjects are the stored objects the caller owns, most specific first. all
// is set when the caller may list every object instead.
func (s *ownerScopedStore) ownedObjects(ctx context.Context) (items []runtime.Object, all bool, err error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}
	if s.owned.readScope == readAll || (s.owned.allowGrafanaAdmin && user.GetIsGrafanaAdmin()) {
		return nil, true, nil
	}
	var names []string
	switch user.GetIdentityType() {
	case authlib.TypeUser:
		names = s.owned.ownedNames(user)
	case authlib.TypeAnonymous:
		// Anonymous owns nothing, but sees what every identity that is not a
		// user sees, when the kind has any.
		names, _ = s.owned.nonUserNames()
	default:
		var scoped bool
		if names, scoped = s.owned.nonUserNames(); !scoped {
			return nil, true, nil
		}
	}
	for _, name := range names {
		obj, err := s.stored(ctx, name, &metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			continue
		}
		if err != nil {
			return nil, false, err
		}
		items = append(items, obj)
	}
	return items, false, nil
}

// Update replaces the object without the caller reading it first: an update that
// leaves out the resource version is made against the one stored. It creates
// the object when it does not exist, for a patch as well as a put, so the
// owner of the name writes it without having to create it first. The update is
// attempted first, and only a not-found takes the create path.
func (s *ownerScopedStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	unconditional := withStoredResourceVersion{UpdatedObjectInfo: objInfo, resource: s.resource}
	updated, created, err := s.Store.Update(ctx, name, unconditional, createValidation, updateValidation, forceAllowCreate, options)
	if err == nil || !apierrors.IsNotFound(err) {
		return updated, created, err
	}

	// Nothing stored yet: apply the update to an empty placeholder and create it.
	// The placeholder carries a UID, which the patch handler needs to merge into it.
	placeholder := s.New()
	accessor, err := meta.Accessor(placeholder)
	if err != nil {
		return nil, false, err
	}
	accessor.SetName(name)
	accessor.SetNamespace(requestK8s.NamespaceValue(ctx))
	accessor.SetUID(gapiutil.CalculateClusterWideUID(placeholder))
	obj, err := objInfo.UpdatedObject(ctx, placeholder)
	if err != nil {
		return nil, false, err
	}
	// "0" asks for a create only, and a create takes no version.
	objMeta, err := meta.Accessor(obj)
	if err != nil {
		return nil, false, err
	}
	if objMeta.GetResourceVersion() == "0" {
		objMeta.SetResourceVersion("")
	}
	createOptions := &metav1.CreateOptions{}
	if options != nil {
		createOptions.DryRun, createOptions.FieldManager, createOptions.FieldValidation = options.DryRun, options.FieldManager, options.FieldValidation
	}
	createdObj, err := s.Create(ctx, obj, createValidation, createOptions)
	if err == nil {
		return createdObj, true, nil
	}
	if !apierrors.IsAlreadyExists(err) {
		return nil, false, err
	}
	// Lost a race with a concurrent create: apply as a regular update.
	return s.Store.Update(ctx, name, unconditional, createValidation, updateValidation, forceAllowCreate, options)
}

// withStoredResourceVersion gives an updated object that names no resource
// version the one of the object it replaces. The storage layer then finds it
// current, as it would for a store that allows unconditional updates.
//
// The version "0" is different: it asks for the object to be created, so it
// conflicts with one that exists. A writer that found nothing stored cannot
// then overwrite what a concurrent writer created in the meantime.
type withStoredResourceVersion struct {
	rest.UpdatedObjectInfo
	resource schema.GroupResource
}

func (i withStoredResourceVersion) UpdatedObject(ctx context.Context, current runtime.Object) (runtime.Object, error) {
	updated, err := i.UpdatedObjectInfo.UpdatedObject(ctx, current)
	if err != nil {
		return nil, err
	}
	target, err := meta.Accessor(updated)
	if err != nil {
		return nil, err
	}
	rv := target.GetResourceVersion()
	if rv != "" && rv != "0" {
		return updated, nil
	}
	stored, err := meta.Accessor(current)
	if err != nil {
		return nil, err
	}
	if rv == "0" && stored.GetResourceVersion() != "" {
		return nil, apierrors.NewConflict(i.resource, stored.GetName(), fmt.Errorf("the object already exists"))
	}
	target.SetResourceVersion(stored.GetResourceVersion())
	return updated, nil
}

// Watch is not scoped to the owned names, so a user may not watch.
func (s *ownerScopedStore) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if s.owned.allowGrafanaAdmin && user.GetIsGrafanaAdmin() {
		return s.Store.Watch(ctx, options)
	}
	if user.GetIdentityType() == authlib.TypeUser || user.GetIdentityType() == authlib.TypeAnonymous {
		return nil, apierrors.NewForbidden(s.resource, "", fmt.Errorf("watch is not supported for this resource"))
	}
	return s.Store.Watch(ctx, options)
}
