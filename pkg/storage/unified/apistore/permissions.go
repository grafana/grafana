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

// KeepExistingPermissions reports whether a DefaultPermissionSetter runs for a resource that already
// existed, for example one moved to the root folder. Such a resource can already have permissions,
// so the setter must only add missing default grants and must not remove or lower existing ones.
func KeepExistingPermissions(ctx context.Context) bool {
	keep, _ := ctx.Value(keepExistingPermissionsKey{}).(bool)
	return keep
}

func WithKeepExistingPermissions(ctx context.Context) context.Context {
	return context.WithValue(ctx, keepExistingPermissionsKey{}, true)
}

func afterMoveToRootPermissionCreator(ctx context.Context,
	key *resourcepb.ResourceKey,
	grantPermisions string,
	obj runtime.Object,
	setter DefaultPermissionSetter,
) (permissionCreatorFunc, error) {
	creator, err := afterCreatePermissionCreator(ctx, key, grantPermisions, obj, setter)
	if creator == nil || err != nil {
		return creator, err
	}
	return func(ctx context.Context) error {
		return creator(WithKeepExistingPermissions(ctx))
	}, nil
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
