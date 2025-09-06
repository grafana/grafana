package folders

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        folder.LegacyService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	// // translate grafana.app/* label selectors into field requirements
	// requirements, newSelector, err := entity.ReadLabelSelectors(options.LabelSelector)
	// if err != nil {
	// 	return nil, err
	// }
	// if requirements.Folder != nil {
	// 	parentUID = *requirements.Folder
	// }
	// // Update the selector to remove the unneeded requirements
	// options.LabelSelector = newSelector

	paging, err := readContinueToken(options)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	query := folder.GetFoldersQuery{
		SignedInUser: user,
		OrgID:        orgId,
	}

	// paging is always retrieved from the continue token
	query.Limit = paging.limit
	query.Page = paging.page

	if options.LabelSelector != nil && options.LabelSelector.Matches(labels.Set{utils.LabelGetFullpath: "true"}) {
		query.WithFullpath = true
		query.WithFullpathUIDs = true
	}

	hits, err := s.service.GetFoldersLegacy(ctx, query)
	if err != nil {
		return nil, err
	}

	list := &folders.FolderList{}
	for _, v := range hits {
		r, err := convertToK8sResource(v, s.namespacer)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, *r)
	}
	if int64(len(list.Items)) >= paging.limit {
		list.Continue = paging.GetNextPageToken()
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	dto, err := s.service.GetLegacy(ctx, &folder.GetFolderQuery{
		SignedInUser: user,
		UID:          &name,
		OrgID:        info.OrgID,
	})
	if err != nil {
		statusErr := apierrors.ToFolderStatusError(err)
		return nil, &statusErr
	}
	if dto == nil {
		statusErr := apierrors.ToFolderStatusError(dashboards.ErrFolderNotFound)
		return nil, &statusErr
	}

	r, err := convertToK8sResource(dto, s.namespacer)
	if err != nil {
		return nil, err
	}

	return r, nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*folders.Folder)
	if !ok {
		return nil, fmt.Errorf("expected folder?")
	}

	accessor, err := utils.MetaAccessor(p)
	if err != nil {
		return nil, err
	}

	parent := accessor.GetFolder()
	descr := ""
	if p.Spec.Description != nil {
		descr = *p.Spec.Description
	}

	out, err := s.service.CreateLegacy(ctx, &folder.CreateFolderCommand{
		SignedInUser: user,
		UID:          p.Name,
		Title:        p.Spec.Title,
		Description:  descr,
		OrgID:        info.OrgID,
		ParentUID:    parent,
	})
	if err != nil {
		statusErr := apierrors.ToFolderStatusError(err)
		return nil, &statusErr
	}

	// #TODO can we directly convert instead of doing a Get? the result of the Create
	// has more data than the one of Get so there is more we can include in the k8s resource
	// this way

	r, err := convertToK8sResource(out, s.namespacer)
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	created := false
	oldObj, err := s.Get(ctx, name, nil)
	if err != nil {
		return oldObj, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return oldObj, created, err
	}
	f, ok := obj.(*folders.Folder)
	if !ok {
		return nil, created, fmt.Errorf("expected folder after update")
	}
	old, ok := oldObj.(*folders.Folder)
	if !ok {
		return nil, created, fmt.Errorf("expected old object to be a folder also")
	}

	mOld, _ := utils.MetaAccessor(old)
	mNew, _ := utils.MetaAccessor(f)
	oldParent := mOld.GetFolder()
	newParent := mNew.GetFolder()
	if oldParent != newParent {
		_, err = s.service.MoveLegacy(ctx, &folder.MoveFolderCommand{
			SignedInUser: user,
			UID:          name,
			OrgID:        info.OrgID,
			NewParentUID: newParent,
		})
		if err != nil {
			return nil, created, err
		}
	}

	changed := false
	cmd := &folder.UpdateFolderCommand{
		SignedInUser: user,
		UID:          name,
		OrgID:        info.OrgID,
		Overwrite:    true,
	}
	if f.Spec.Title != old.Spec.Title {
		cmd.NewTitle = &f.Spec.Title
		changed = true
	}
	if f.Spec.Description != old.Spec.Description {
		cmd.NewDescription = f.Spec.Description
		changed = true
	}
	if changed {
		_, err = s.service.UpdateLegacy(ctx, cmd)
		if err != nil {
			return nil, false, err
		}
	}

	r, err := s.Get(ctx, name, nil)
	return r, created, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	p, ok := v.(*folders.Folder)
	if !ok {
		return v, false, fmt.Errorf("expected a folder response from Get")
	}

	err = s.service.DeleteLegacy(ctx, &folder.DeleteFolderCommand{
		UID:          name,
		OrgID:        info.OrgID,
		SignedInUser: user,

		// This would cascade delete into alert rules
		ForceDeleteRules:  false,
		RemovePermissions: utils.GetFolderRemovePermissions(ctx, true),
	})
	return p, true, err // true is instant delete
}

// GracefulDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for folders not implemented")
}
