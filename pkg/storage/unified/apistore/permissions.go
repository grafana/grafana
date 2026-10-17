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

type inheritedFromKey struct{}

// WithInheritedFrom records the folder a resource was moved out of when it arrived at the root.
// A DefaultPermissionSetter uses it to carry over the access the resource inherited from that
// folder (and its ancestors) instead of applying the generic defaults, so a move never widens
// or narrows who can reach the resource.
func WithInheritedFrom(ctx context.Context, folderUID string) context.Context {
	return context.WithValue(ctx, inheritedFromKey{}, folderUID)
}

// InheritedFrom returns the folder set by WithInheritedFrom, if any.
func InheritedFrom(ctx context.Context) (string, bool) {
	folderUID, ok := ctx.Value(inheritedFromKey{}).(string)
	return folderUID, ok && folderUID != ""
}

// afterMoveToRootPermissionCreator is afterCreatePermissionCreator for an update that moved the
// resource into the root folder: the setter also learns which folder it came from.
func afterMoveToRootPermissionCreator(ctx context.Context,
	key *resourcepb.ResourceKey,
	grantPermisions string,
	obj runtime.Object,
	setter DefaultPermissionSetter,
	inheritedFrom string,
) (permissionCreatorFunc, error) {
	creator, err := afterCreatePermissionCreator(ctx, key, grantPermisions, obj, setter)
	if creator == nil || err != nil {
		return creator, err
	}
	return func(ctx context.Context) error {
		return creator(WithInheritedFrom(ctx, inheritedFrom))
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
