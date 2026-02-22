package storewrapper

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srest "k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
)

var (
	ErrUnauthenticated = errors.NewUnauthorized("unauthenticated")
	ErrUnauthorized    = errors.NewUnauthorized("unauthorized")
	ErrUnexpectedType  = errors.NewBadRequest("unexpected object type")
)

// ResourceStorageAuthorizer defines authorization hooks for resource storage operations.
type ResourceStorageAuthorizer interface {
	BeforeCreate(ctx context.Context, obj runtime.Object) error
	BeforeUpdate(ctx context.Context, obj runtime.Object) error
	BeforeDelete(ctx context.Context, obj runtime.Object) error
	AfterGet(ctx context.Context, obj runtime.Object) error
	FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error)
}

// Wrapper is a k8sStorage (e.g. registry.Store) wrapper that enforces authorization based on ResourceStorageAuthorizer.
// It overrides the identity in the context to use service identity for the underlying store operations.
// That way, the underlying store authorization is always successful, and the authorization is enforced by the wrapper.
type Wrapper struct {
	inner      K8sStorage
	authorizer ResourceStorageAuthorizer
}

type K8sStorage interface {
	k8srest.Storage
	k8srest.Scoper
	k8srest.SingularNameProvider
	k8srest.Lister
	k8srest.Getter
	k8srest.CreaterUpdater
	k8srest.GracefulDeleter
}

var _ rest.Storage = (*Wrapper)(nil)

func New(store K8sStorage, authz ResourceStorageAuthorizer) *Wrapper {
	return &Wrapper{inner: store, authorizer: authz}
}

func (w *Wrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metaV1.Table, error) {
	return w.inner.ConvertToTable(ctx, object, tableOptions)
}

func (w *Wrapper) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *metaV1.CreateOptions) (runtime.Object, error) {
	// Enforce authorization based on the user permissions before creating the object
	err := w.authorizer.BeforeCreate(ctx, obj)
	if err != nil {
		return nil, err
	}
	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	return w.inner.Create(srvCtx, obj, createValidation, options)
}

func (w *Wrapper) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions) (runtime.Object, bool, error) {
	// Fetch the object first to authorize
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)
	getOpts := &metaV1.GetOptions{TypeMeta: options.TypeMeta}
	if options.Preconditions != nil {
		getOpts.ResourceVersion = *options.Preconditions.ResourceVersion
	}
	obj, err := w.inner.Get(srvCtx, name, getOpts)
	if err != nil {
		return nil, false, err
	}

	// Enforce authorization based on the user permissions
	if err := w.authorizer.BeforeDelete(ctx, obj); err != nil {
		return nil, false, err
	}

	return w.inner.Delete(srvCtx, name, deleteValidation, options)
}

func (w *Wrapper) DeleteCollection(ctx context.Context, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	// DeleteCollection is complex to authorize properly
	// For now, deny it entirely for safety
	return nil, fmt.Errorf("bulk delete operations are not supported through this API")
}

func (w *Wrapper) Destroy() {
	w.inner.Destroy()
}

func (w *Wrapper) Get(ctx context.Context, name string, options *metaV1.GetOptions) (runtime.Object, error) {
	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	item, err := w.inner.Get(srvCtx, name, options)
	if err != nil {
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the object
	err = w.authorizer.AfterGet(ctx, item)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (w *Wrapper) GetSingularName() string {
	return w.inner.GetSingularName()
}

func (w *Wrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	// If no limit is specified, fetch all and filter
	if options.Limit == 0 {
		list, err := w.inner.List(srvCtx, options)
		if err != nil {
			return nil, err
		}
		return w.authorizer.FilterList(ctx, list)
	}

	// For paginated requests, fetch and filter based on limit
	return w.fetchAndFilterUntilFull(ctx, srvCtx, options)
}

func (w *Wrapper) fetchAndFilterUntilFull(ctx context.Context, srvCtx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	const (
		maxIterations       = 10
		overFetchMultiplier = 3
	)

	var (
		accumulatedList runtime.Object
		totalCollected  int64
		continueToken   = options.Continue
	)

	for iteration := 0; iteration < maxIterations && totalCollected < options.Limit; iteration++ {
		fetchOptions := options.DeepCopy()
		fetchOptions.Continue = continueToken
		fetchOptions.Limit = (options.Limit - totalCollected) * overFetchMultiplier

		list, err := w.inner.List(srvCtx, fetchOptions)
		if err != nil {
			return nil, err
		}

		unfilteredContinue, _, err := getListMetadata(list)
		if err != nil {
			return nil, err
		}

		filteredList, err := w.authorizer.FilterList(ctx, list)
		if err != nil {
			return nil, err
		}

		_, itemCount, err := getListMetadata(filteredList)
		if err != nil {
			return nil, err
		}

		if itemCount > 0 {
			if accumulatedList == nil {
				accumulatedList = filteredList
			} else {
				if err := appendToList(accumulatedList, filteredList); err != nil {
					return nil, err
				}
			}
			totalCollected += int64(itemCount)
		}

		continueToken = unfilteredContinue

		if continueToken == "" {
			break
		}
	}

	if accumulatedList == nil {
		accumulatedList = w.inner.NewList()
	}

	finalContinue := ""
	if totalCollected >= options.Limit && continueToken != "" {
		finalContinue = continueToken
	}

	return truncateList(accumulatedList, options.Limit, finalContinue)
}

func getListMetadata(list runtime.Object) (continueToken string, itemCount int, err error) {
	listMeta, err := meta.ListAccessor(list)
	if err != nil {
		return "", 0, fmt.Errorf("unable to access list metadata: %w", err)
	}

	count := 0
	if err := meta.EachListItem(list, func(obj runtime.Object) error {
		count++
		return nil
	}); err != nil {
		return "", 0, fmt.Errorf("unable to count list items: %w", err)
	}

	return listMeta.GetContinue(), count, nil
}

func appendToList(dest, source runtime.Object) error {
	sourceItems := []runtime.Object{}
	if err := meta.EachListItem(source, func(obj runtime.Object) error {
		sourceItems = append(sourceItems, obj)
		return nil
	}); err != nil {
		return fmt.Errorf("unable to iterate source list: %w", err)
	}

	destItems := []runtime.Object{}
	if err := meta.EachListItem(dest, func(obj runtime.Object) error {
		destItems = append(destItems, obj)
		return nil
	}); err != nil {
		return fmt.Errorf("unable to iterate dest list: %w", err)
	}

	allItems := append(destItems, sourceItems...)
	if err := meta.SetList(dest, allItems); err != nil {
		return fmt.Errorf("unable to set combined list: %w", err)
	}

	return nil
}

func truncateList(list runtime.Object, limit int64, continueToken string) (runtime.Object, error) {
	items := []runtime.Object{}
	if err := meta.EachListItem(list, func(obj runtime.Object) error {
		if int64(len(items)) < limit {
			items = append(items, obj)
		}
		return nil
	}); err != nil {
		return nil, fmt.Errorf("unable to iterate list items: %w", err)
	}

	if err := meta.SetList(list, items); err != nil {
		return nil, fmt.Errorf("unable to set list items: %w", err)
	}

	listMeta, err := meta.ListAccessor(list)
	if err != nil {
		return nil, fmt.Errorf("unable to access list metadata: %w", err)
	}
	listMeta.SetContinue(continueToken)

	return list, nil
}

func (w *Wrapper) NamespaceScoped() bool {
	return w.inner.NamespaceScoped()
}

func (w *Wrapper) New() runtime.Object {
	return w.inner.New()
}

func (w *Wrapper) NewList() runtime.Object {
	return w.inner.NewList()
}

func (w *Wrapper) Update(
	ctx context.Context,
	name string,
	objInfo k8srest.UpdatedObjectInfo,
	createValidation k8srest.ValidateObjectFunc,
	updateValidation k8srest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metaV1.UpdateOptions,
) (runtime.Object, bool, error) {
	// Create a wrapper around UpdatedObjectInfo to inject authorization
	wrappedObjInfo := &authorizedUpdateInfo{
		inner:      objInfo,
		authorizer: w.authorizer,
		userCtx:    ctx, // Keep original context for authorization
	}

	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	return w.inner.Update(srvCtx, name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
}

type authorizedUpdateInfo struct {
	inner      k8srest.UpdatedObjectInfo
	authorizer ResourceStorageAuthorizer
	userCtx    context.Context
}

func (a *authorizedUpdateInfo) Preconditions() *metaV1.Preconditions {
	return a.inner.Preconditions()
}

func (a *authorizedUpdateInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	// Get the updated object
	updatedObj, err := a.inner.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}

	// Enforce authorization using the original user context
	if err := a.authorizer.BeforeUpdate(a.userCtx, updatedObj); err != nil {
		return nil, err
	}

	return updatedObj, nil
}

// NoopAuthorizer is a no-op implementation of ResourceStorageAuthorizer.
// Use this when authorization is handled at the API level and no additional
// storage-level authorization is needed.
// This will be used if a service wants to tackle Cluster-scoped resources.
type NoopAuthorizer struct{}

func (b *NoopAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	return list, nil
}

// DenyAuthorizer denies all storage operations.
// Use this as a safe default when no explicit authorizer is provided
// for cluster-scoped resources. This ensures fail-closed behavior.
type DenyAuthorizer struct{}

func (d *DenyAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	return nil, ErrUnauthorized
}
