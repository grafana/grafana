package common

import (
	"context"
	"strconv"

	authlib "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
// prvovided with a authlib.AccessClient.
func List[T Resource](
	ctx context.Context,
	resource utils.ResourceInfo,
	ac authlib.AccessClient,
	p Pagination,
	fn ListFunc[T],
) (*ListResponse[T], error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	check := func(_, _ string) bool { return true }
	if ac != nil {
		var err error
		check, err = ac.Compile(ctx, ident, authlib.ListRequest{
			Resource:  resource.GroupResource().Resource,
			Group:     resource.GroupResource().Group,
			Verb:      "list",
			Namespace: ns.Value,
		})

		if err != nil {
			return nil, err
		}
	}

	res := &ListResponse[T]{Items: make([]T, 0, p.Limit)}

	first, err := fn(ctx, ns, p)
	if err != nil {
		return nil, err
	}

	for _, item := range first.Items {
		if !check(item.AuthID(), "") {
			continue
		}
		res.Items = append(res.Items, item)
	}
	res.Continue = first.Continue
	res.RV = first.RV

outer:
	for len(res.Items) < int(p.Limit) && res.Continue != 0 {
		// FIXME: it is not optimal to reduce the amout we look for here but it is the easiest way to
		// correctly handle pagination and continue tokens
		r, err := fn(ctx, ns, Pagination{Limit: p.Limit - int64(len(res.Items)), Continue: res.Continue})
		if err != nil {
			return nil, err
		}

		for _, item := range r.Items {
			if len(res.Items) == int(p.Limit) {
				res.Continue = r.Continue
				break outer
			}

			if !check(item.AuthID(), "") {
				continue
			}

			res.Items = append(res.Items, item)
		}
	}

	return res, nil
}
