package apistore

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type permissionCreatorFunc = func(ctx context.Context) error

type keepExistingPermissionsKey struct{}

// KeepExistingPermissions reports whether the [DefaultPermissionSetter] is running for a resource
// that may already have a permission record: one that arrived at the root folder by a move, or a
// folder whose record was pre-seeded when it was created. The setter must then add only the
// default grants whose subject has none yet and leave every existing grant untouched, so the
// write can never remove or lower somebody's access.
func KeepExistingPermissions(ctx context.Context) bool {
	keep, _ := ctx.Value(keepExistingPermissionsKey{}).(bool)
	return keep
}

// WithKeepExistingPermissions marks the context read by [KeepExistingPermissions].
func WithKeepExistingPermissions(ctx context.Context) context.Context {
	return context.WithValue(ctx, keepExistingPermissionsKey{}, true)
}

func afterCreatePermissionCreator(ctx context.Context,
	key *resourcepb.ResourceKey,
	grantPermisions string,
	obj runtime.Object,
	setter DefaultPermissionSetter,
) (permissionCreatorFunc, error) {
	if grantPermisions == "" {
		return nil, nil
	}
	if grantPermisions != utils.AnnoGrantPermissionsDefault {
		return nil, fmt.Errorf("invalid permissions value. only '%s' supported", utils.AnnoGrantPermissionsDefault)
	}
	if setter == nil {
		return nil, fmt.Errorf("missing default permission creator")
	}
	val, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	auth, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return nil, errors.New("missing auth info")
	}

	return func(ctx context.Context) error {
		return setter(ctx, key, auth, val)
	}, nil
}
