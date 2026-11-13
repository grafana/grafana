package folders

import (
	"context"
	"fmt"
	"time"

	authlib "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/registry/rest"
)

type pendingDeleteStorage struct {
	grafanarest.Storage
	enabled   func(context.Context) bool
	record    func(context.Context, *foldersv1.Folder) error
	authorize func(context.Context, *foldersv1.Folder) error
}

func newPendingDeleteStorage(store grafanarest.Storage, pending grafanarest.Storage, enabled func(context.Context) bool, access authlib.AccessClient) grafanarest.Storage {
	s := &pendingDeleteStorage{Storage: store, enabled: enabled, record: pendingRecorder(pending), authorize: func(ctx context.Context, f *foldersv1.Folder) error {
		if access == nil {
			return apierrors.NewServiceUnavailable("folder delete authorization unavailable")
		}
		user, err := identity.GetRequester(ctx)
		if err != nil {
			return err
		}
		resource := foldersv1.FolderResourceInfo.GroupResource()
		result, err := access.Check(ctx, user, authlib.CheckRequest{Namespace: f.Namespace, Group: resource.Group, Resource: resource.Resource, Name: f.Name, Verb: utils.VerbDelete}, f.Annotations[utils.AnnoKeyFolder])
		if err != nil {
			return err
		}
		if !result.Allowed {
			return apierrors.NewForbidden(resource, f.Name, fmt.Errorf("folder delete permission required"))
		}
		return nil
	}}
	watcher, watch := store.(rest.Watcher)
	collection, collections := store.(rest.CollectionDeleter)
	if watch && collections {
		return &struct {
			*pendingDeleteStorage
			rest.Watcher
			rest.CollectionDeleter
		}{s, watcher, pendingCollectionDeleter{s, collection}}
	}
	if watch {
		return &struct {
			*pendingDeleteStorage
			rest.Watcher
		}{s, watcher}
	}
	if collections {
		return &struct {
			*pendingDeleteStorage
			rest.CollectionDeleter
		}{s, pendingCollectionDeleter{s, collection}}
	}
	return s
}

func pendingRecorder(store grafanarest.Storage) func(context.Context, *foldersv1.Folder) error {
	return func(ctx context.Context, f *foldersv1.Folder) error {
		if f.UID == "" {
			return fmt.Errorf("cannot record deletion of folder without UID")
		}
		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			return err
		}
		ctx = identity.WithServiceIdentityContext(ctx, ns.OrgID)
		entry := &foldersv1.PendingFolderDeletion{
			ObjectMeta: metav1.ObjectMeta{Name: foldersv1.PendingFolderDeletionName(string(f.UID)), Namespace: ns.Value},
			Spec:       foldersv1.PendingFolderDeletionSpec{FolderName: f.Name, FolderUID: string(f.UID)},
		}
		err = wait.ExponentialBackoffWithContext(ctx, wait.Backoff{Duration: 10 * time.Millisecond, Factor: 2, Jitter: 0.5, Steps: 7}, func(ctx context.Context) (bool, error) {
			_, err := store.Create(ctx, entry.DeepCopy(), nil, &metav1.CreateOptions{})
			if !apierrors.IsAlreadyExists(err) {
				return err == nil, err
			}
			existing, err := store.Get(ctx, entry.Name, &metav1.GetOptions{})
			// Duplicate creates in one SQL batch can roll the entire batch back while
			// returning AlreadyExists to both writers. Confirm existence before proceeding.
			if apierrors.IsNotFound(err) {
				return false, nil
			}
			if err != nil {
				return false, err
			}
			p, ok := existing.(*foldersv1.PendingFolderDeletion)
			if !ok || p.Spec.FolderName != f.Name || p.Spec.FolderUID != string(f.UID) {
				return false, fmt.Errorf("pending deletion identity mismatch")
			}
			return true, nil
		})
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if wait.Interrupted(err) {
			return apierrors.NewServiceUnavailable("could not establish pending folder deletion; retry the delete")
		}
		return err
	}
}

func (s *pendingDeleteStorage) Delete(ctx context.Context, name string, validation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if !s.enabled(ctx) || (options != nil && len(options.DryRun) > 0) {
		return s.Storage.Delete(ctx, name, validation, options)
	}
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	f, ok := obj.(*foldersv1.Folder)
	if !ok {
		return nil, false, fmt.Errorf("expected Folder")
	}
	if s.authorize == nil {
		return nil, false, apierrors.NewServiceUnavailable("folder delete authorization unavailable")
	}
	if err := s.authorize(ctx, f); err != nil {
		return nil, false, err
	}
	if validation != nil {
		if err := validation(ctx, obj); err != nil {
			return nil, false, err
		}
	}
	if err := checkDeletePreconditions(obj, options); err != nil {
		return nil, false, err
	}
	if err := s.record(ctx, f); err != nil {
		return nil, false, err
	}

	copyOptions := &metav1.DeleteOptions{}
	if options != nil {
		copyOptions = options.DeepCopy()
	}
	if copyOptions.Preconditions == nil {
		copyOptions.Preconditions = &metav1.Preconditions{}
	}
	// Pin the identity whose intent was recorded, even for an unconditional user delete.
	uid := f.UID
	copyOptions.Preconditions.UID = &uid
	return s.Storage.Delete(ctx, name, validation, copyOptions)
}

type pendingCollectionDeleter struct {
	storage *pendingDeleteStorage
	inner   rest.CollectionDeleter
}

func (s pendingCollectionDeleter) DeleteCollection(ctx context.Context, validation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	if !s.storage.enabled(ctx) || (options != nil && len(options.DryRun) > 0) {
		return s.inner.DeleteCollection(ctx, validation, options, listOptions)
	}
	listOpts := &metainternalversion.ListOptions{}
	if listOptions != nil {
		listOpts = listOptions.DeepCopy()
	}
	result := &foldersv1.FolderList{}
	for {
		page, err := s.storage.List(ctx, listOpts)
		if err != nil {
			return nil, err
		}
		items, err := meta.ExtractList(page)
		if err != nil {
			return nil, err
		}
		for _, item := range items {
			f, ok := item.(*foldersv1.Folder)
			if !ok {
				return nil, fmt.Errorf("expected Folder in collection")
			}
			if err := checkDeletePreconditions(f, options); err != nil {
				return nil, err
			}
			deleteOptions := &metav1.DeleteOptions{}
			if options != nil {
				deleteOptions = options.DeepCopy()
			}
			uid, rv := f.UID, f.ResourceVersion
			deleteOptions.Preconditions = &metav1.Preconditions{UID: &uid, ResourceVersion: &rv}
			_, _, err := s.storage.Delete(ctx, f.Name, validation, deleteOptions)
			if err != nil && !apierrors.IsNotFound(err) {
				return nil, err
			}
			result.Items = append(result.Items, *f)
		}
		accessor, err := meta.ListAccessor(page)
		if err != nil {
			return nil, err
		}
		listOpts.Continue = accessor.GetContinue()
		if listOpts.Continue == "" {
			return result, nil
		}
	}
}
