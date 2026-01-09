package common

import (
	"context"
	"strconv"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
)

// OptonalFormatInt formats num as a string. If num is less or equal than 0
// an empty string is returned.
func OptionalFormatInt(num int64) string {
	if num > 0 {
		return strconv.FormatInt(num, 10)
	}
	return ""
}

func MapTeamPermission(p team.PermissionType) iamv0alpha1.TeamBindingTeamPermission {
	if p == team.PermissionTypeAdmin {
		return iamv0alpha1.TeamBindingTeamPermissionAdmin
	} else {
		return iamv0alpha1.TeamBindingTeamPermissionMember
	}
}

func MapUserTeamPermission(p team.PermissionType) legacyiamv0.TeamPermission {
	if p == team.PermissionTypeAdmin {
		return legacyiamv0.TeamPermissionAdmin
	} else {
		return legacyiamv0.TeamPermissionMember
	}
}

// Resource is required to be implemented for list return types so we can
// perform authorization.
type Resource interface {
	AuthID() string
}

type ListResponse[T Resource] struct {
	Items    []T
	RV       int64
	Continue int64
}

type ListFunc[T Resource] func(ctx context.Context, ns authlib.NamespaceInfo, p Pagination) (*ListResponse[T], error)

// List is a helper function that will perform access check on resources if
// provided with a authlib.AccessClient.
func List[T Resource](
	ctx context.Context,
	resourceInfo utils.ResourceInfo,
	ac authlib.AccessClient,
	p Pagination,
	fn ListFunc[T],
) (*ListResponse[T], error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res := &ListResponse[T]{Items: make([]T, 0, p.Limit)}

	first, err := fn(ctx, ns, p)
	if err != nil {
		return nil, err
	}
	res.Continue = first.Continue
	res.RV = first.RV

	// If no access client, skip authorization
	if ac == nil {
		res.Items = append(res.Items, first.Items...)

		for len(res.Items) < int(p.Limit) && res.Continue != 0 {
			r, err := fn(ctx, ns, Pagination{Limit: p.Limit - int64(len(res.Items)), Continue: res.Continue})
			if err != nil {
				return nil, err
			}
			res.Items = append(res.Items, r.Items...)
			res.Continue = r.Continue
		}
		return res, nil
	}

	// Use FilterAuthorized to batch authorize items
	extractFn := func(item T) authz.BatchCheckItem {
		return authz.BatchCheckItem{
			Name:      item.AuthID(),
			Folder:    "",
			Verb:      "list",
			Group:     resourceInfo.GroupResource().Group,
			Resource:  resourceInfo.GroupResource().Resource,
			Namespace: ns.Value,
		}
	}

	// Convert first batch to iter.Seq and filter
	firstCandidates := func(yield func(T) bool) {
		for _, item := range first.Items {
			if !yield(item) {
				return
			}
		}
	}

	for item, err := range authz.FilterAuthorized(ctx, ac, firstCandidates, extractFn).Items {
		if err != nil {
			return nil, err
		}
		res.Items = append(res.Items, item)
	}

outer:
	for len(res.Items) < int(p.Limit) && res.Continue != 0 {
		// FIXME: it is not optimal to reduce the amount we look for here but it is the easiest way to
		// correctly handle pagination and continue tokens
		r, err := fn(ctx, ns, Pagination{Limit: p.Limit - int64(len(res.Items)), Continue: res.Continue})
		if err != nil {
			return nil, err
		}

		candidates := func(yield func(T) bool) {
			for _, item := range r.Items {
				if !yield(item) {
					return
				}
			}
		}

		for item, authErr := range authz.FilterAuthorized(ctx, ac, candidates, extractFn).Items {
			if authErr != nil {
				return nil, authErr
			}
			if len(res.Items) >= int(p.Limit) {
				res.Continue = r.Continue
				break outer
			}
			res.Items = append(res.Items, item)
		}
		res.Continue = r.Continue
	}

	return res, nil
}
