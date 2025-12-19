package authorizer

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

type ExternalGroupMappingAuthorizer struct {
	accessClient types.AccessClient
	logger       log.Logger
}

var _ storewrapper.ResourceStorageAuthorizer = (*ExternalGroupMappingAuthorizer)(nil)

func NewExternalGroupMappingAuthorizer(
	accessClient types.AccessClient,
) *ExternalGroupMappingAuthorizer {
	return &ExternalGroupMappingAuthorizer{
		accessClient: accessClient,
		logger:       log.New("iam.authorizer.external-group-mapping"),
	}
}

// AfterGet implements ResourceStorageAuthorizer.
func (r *ExternalGroupMappingAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}
	switch o := obj.(type) {
	case *iamv0.ExternalGroupMapping:
		teamName := o.Spec.TeamRef.Name
		checkReq := types.CheckRequest{
			Namespace: o.Namespace,
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
				o.Name,
				fmt.Errorf("user cannot access team %s", teamName),
			)
		}
		return nil
	default:
		return apierrors.NewInternalError(fmt.Errorf("expected ExternalGroupMapping, got %T: %w", o, storewrapper.ErrUnexpectedType))
	}
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
	switch o := obj.(type) {
	case *iamv0.ExternalGroupMapping:
		teamName := o.Spec.TeamRef.Name
		checkReq := types.CheckRequest{
			Namespace: o.Namespace,
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
				o.Name,
				fmt.Errorf("user cannot write team %s", teamName),
			)
		}
		return nil
	default:
		return apierrors.NewInternalError(fmt.Errorf("expected ExternalGroupMapping, got %T: %w", o, storewrapper.ErrUnexpectedType))
	}
}

// FilterList implements ResourceStorageAuthorizer.
func (r *ExternalGroupMappingAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil, storewrapper.ErrUnauthenticated
	}

	switch l := list.(type) {
	case *iamv0.ExternalGroupMappingList:
		var (
			filteredItems []iamv0.ExternalGroupMapping
			err           error
		)

		canViewFuncs := map[string]types.ItemChecker{} // Key: Namespace

		for _, item := range l.Items {
			canView, found := canViewFuncs[item.Namespace]
			if !found {
				listReq := types.ListRequest{
					Namespace: item.Namespace,
					Group:     iamv0.GROUP,
					Resource:  iamv0.TeamResourceInfo.GetName(),
					Verb:      utils.VerbGetPermissions,
				}
				canView, _, err = r.accessClient.Compile(ctx, authInfo, listReq)
				if err != nil {
					return nil, apierrors.NewInternalError(err)
				}
				canViewFuncs[item.Namespace] = canView
			}

			if canView(item.Spec.TeamRef.Name, "") {
				filteredItems = append(filteredItems, item)
			}
		}
		l.Items = filteredItems
		return l, nil
	default:
		return nil, apierrors.NewInternalError(fmt.Errorf("expected ExternalGroupMappingList, got %T: %w", l, storewrapper.ErrUnexpectedType))
	}
}
