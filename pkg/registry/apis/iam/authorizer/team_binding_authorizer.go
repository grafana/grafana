package authorizer

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

type TeamBindingAuthorizer struct {
	accessClient types.AccessClient
}

var _ storewrapper.ResourceStorageAuthorizer = (*TeamBindingAuthorizer)(nil)

func NewTeamBindingAuthorizer(
	accessClient types.AccessClient,
) *TeamBindingAuthorizer {
	return &TeamBindingAuthorizer{
		accessClient: accessClient,
	}
}

// AfterGet implements ResourceStorageAuthorizer.
func (r *TeamBindingAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}

	concreteObj, ok := obj.(*iamv0.TeamBinding)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected TeamBinding, got %T: %w", obj, storewrapper.ErrUnexpectedType))
	}

	// Accesscontrol should check on the TeamResourceInfo group resource if the user can use VerbGetPermissions
	// on the team (TeamRef.Name) (handled below) OR if the subject's name (TeamBindingSpec.Subject.Name) is equal to the current Identity's UID/Identifier.
	if concreteObj.Spec.Subject.Name == authInfo.GetIdentifier() {
		return nil
	}

	teamName := concreteObj.Spec.TeamRef.Name
	checkReq := types.CheckRequest{
		Namespace: authInfo.GetNamespace(),
		Group:     iamv0.TeamResourceInfo.GroupResource().Group,
		Resource:  iamv0.TeamResourceInfo.GroupResource().Resource,
		Verb:      utils.VerbGetPermissions,
		Name:      teamName,
	}
	res, err := r.accessClient.Check(ctx, authInfo, checkReq, "")
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	if !res.Allowed {
		return apierrors.NewForbidden(
			iamv0.TeamBindingResourceInfo.GroupResource(),
			concreteObj.Name,
			fmt.Errorf("user cannot access team %s", teamName),
		)
	}
	return nil
}

// BeforeCreate implements ResourceStorageAuthorizer.
func (r *TeamBindingAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

// BeforeDelete implements ResourceStorageAuthorizer.
func (r *TeamBindingAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

// BeforeUpdate implements ResourceStorageAuthorizer.
func (r *TeamBindingAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

func (r *TeamBindingAuthorizer) beforeWrite(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}

	concreteObj, ok := obj.(*iamv0.TeamBinding)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected TeamBinding, got %T: %w", obj, storewrapper.ErrUnexpectedType))
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
			iamv0.TeamBindingResourceInfo.GroupResource(),
			concreteObj.Name,
			fmt.Errorf("user cannot write team %s", teamName),
		)
	}
	return nil
}

// FilterList implements ResourceStorageAuthorizer.
func (r *TeamBindingAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil, storewrapper.ErrUnauthenticated
	}

	l, ok := list.(*iamv0.TeamBindingList)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected TeamBindingList, got %T: %w", list, storewrapper.ErrUnexpectedType))
	}

	var filteredItems []iamv0.TeamBinding

	listReq := types.ListRequest{
		Namespace: authInfo.GetNamespace(),
		Group:     iamv0.TeamResourceInfo.GroupResource().Group,
		Resource:  iamv0.TeamResourceInfo.GroupResource().Resource,
		Verb:      utils.VerbGetPermissions,
	}
	canView, _, err := r.accessClient.Compile(ctx, authInfo, listReq)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	for _, item := range l.Items {
		// Accesscontrol should check on the TeamResourceInfo group resource if the user can use VerbGetPermissions
		// on the team (TeamRef.Name) OR if the subject's name (TeamBindingSpec.Subject.Name) is equal to the current Identity's UID/Identifier.
		if item.Spec.Subject.Name == authInfo.GetIdentifier() || canView(item.Spec.TeamRef.Name, "") {
			filteredItems = append(filteredItems, item)
		}
	}

	l.Items = filteredItems
	return l, nil
}
