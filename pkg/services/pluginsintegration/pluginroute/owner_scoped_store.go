package pluginroute

import (
	"context"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
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

	// virtual answers a Get for one of owned.names; nil when the kind has none.
	virtual VirtualGetter

	// stored reads one stored object, and newList makes an empty list. They are
	// the Store's own, held apart so the scoping can be tested without one.
	stored   func(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error)
	newList  func() runtime.Object
	resource schema.GroupResource
}

func newOwnerScopedStore(store *kindstore.Store, owned *ownerFromName, virtual VirtualGetter) *ownerScopedStore {
	return &ownerScopedStore{Store: store, owned: owned, virtual: virtual, stored: store.Get, newList: store.NewList, resource: store.DefaultQualifiedResource}
}

// VirtualGetter answers a Get for a name that no object is stored under, from
// the objects the caller owns, most specific first.
type VirtualGetter func(ctx context.Context, name string, owned []runtime.Object) (runtime.Object, error)

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
	list := s.newList()
	if err := meta.SetList(list, items); err != nil {
		return nil, fmt.Errorf("building owned list: %w", err)
	}
	return list, nil
}

// Get answers the kind's virtual names, which no object is stored under, from
// the objects the caller owns. Any other name is a stored object.
func (s *ownerScopedStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if s.virtual == nil || !slices.Contains(s.owned.names, name) {
		return s.stored(ctx, name, options)
	}
	items, _, err := s.ownedObjects(ctx)
	if err != nil {
		return nil, err
	}
	return s.virtual(ctx, name, items)
}

// ownedObjects are the stored objects the caller owns, most specific first. all
// is set when the caller may list every object instead.
func (s *ownerScopedStore) ownedObjects(ctx context.Context) (items []runtime.Object, all bool, err error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
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
	unconditional := withStoredResourceVersion{objInfo}
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
type withStoredResourceVersion struct {
	rest.UpdatedObjectInfo
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
	if rv := target.GetResourceVersion(); rv != "" && rv != "0" {
		return updated, nil
	}
	stored, err := meta.Accessor(current)
	if err != nil {
		return nil, err
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
	if user.GetIdentityType() == authlib.TypeUser || user.GetIdentityType() == authlib.TypeAnonymous {
		return nil, apierrors.NewForbidden(s.resource, "", fmt.Errorf("watch is not supported for this resource"))
	}
	return s.Store.Watch(ctx, options)
}
