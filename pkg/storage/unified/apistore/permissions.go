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
