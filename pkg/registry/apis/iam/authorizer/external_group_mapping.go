package authorizer

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

type ExternalGroupMappingAuthorizer struct {
	accessClient types.AccessClient
}

var _ storewrapper.ResourceStorageAuthorizer = (*ExternalGroupMappingAuthorizer)(nil)

func NewExternalGroupMappingAuthorizer(
	accessClient types.AccessClient,
) *ExternalGroupMappingAuthorizer {
	return &ExternalGroupMappingAuthorizer{
		accessClient: accessClient,
	}
}

// AfterGet implements ResourceStorageAuthorizer.
func (r *ExternalGroupMappingAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}

	concreteObj, ok := obj.(*iamv0.ExternalGroupMapping)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected ExternalGroupMapping, got %T: %w", obj, storewrapper.ErrUnexpectedType))
	}

	teamName := concreteObj.Spec.TeamRef.Name
	checkReq := types.CheckRequest{
		Namespace: authInfo.GetNamespace(),
		Group:     iamv0.GROUP,
		Resource:  iamv0.TeamResourceInfo.GetName(),
		Verb:      utils.VerbGetPermissions,
		Name:      teamName,
	}
	res, err := r.accessClient.Check(ctx, authInfo, checkReq, "")
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	if !res.Allowed {
		return apierrors.NewForbidden(
			iamv0.ExternalGroupMappingResourceInfo.GroupResource(),
			concreteObj.Name,
			fmt.Errorf("user cannot access team %s", teamName),
		)
	}
	return nil
}

// BeforeCreate implements ResourceStorageAuthorizer.
func (r *ExternalGroupMappingAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

// BeforeDelete implements ResourceStorageAuthorizer.
func (r *ExternalGroupMappingAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

// BeforeUpdate implements ResourceStorageAuthorizer.
func (r *ExternalGroupMappingAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

func (r *ExternalGroupMappingAuthorizer) beforeWrite(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}

	concreteObj, ok := obj.(*iamv0.ExternalGroupMapping)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected ExternalGroupMapping, got %T: %w", concreteObj, storewrapper.ErrUnexpectedType))
	}

	teamName := concreteObj.Spec.TeamRef.Name
	checkReq := types.CheckRequest{
		Namespace: authInfo.GetNamespace(),
		Group:     iamv0.GROUP,
		Resource:  iamv0.TeamResourceInfo.GetName(),
		Verb:      utils.VerbSetPermissions,
		Name:      teamName,
	}

	res, err := r.accessClient.Check(ctx, authInfo, checkReq, "")
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	if !res.Allowed {
		return apierrors.NewForbidden(
			iamv0.ExternalGroupMappingResourceInfo.GroupResource(),
			concreteObj.Name,
			fmt.Errorf("user cannot write team %s", teamName),
		)
	}
	return nil
}

// FilterList implements ResourceStorageAuthorizer.
func (r *ExternalGroupMappingAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil, storewrapper.ErrUnauthenticated
	}

	l, ok := list.(*iamv0.ExternalGroupMappingList)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected ExternalGroupMappingList, got %T: %w", list, storewrapper.ErrUnexpectedType))
	}

	var filteredItems []iamv0.ExternalGroupMapping

	listReq := types.ListRequest{
		Namespace: authInfo.GetNamespace(),
		Group:     iamv0.GROUP,
		Resource:  iamv0.TeamResourceInfo.GetName(),
		Verb:      utils.VerbGetPermissions,
	}
	canView, _, err := r.accessClient.Compile(ctx, authInfo, listReq)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	for _, item := range l.Items {
		if canView(item.Spec.TeamRef.Name, "") {
			filteredItems = append(filteredItems, item)
		}
	}

	l.Items = filteredItems
	return l, nil
}
