package apistore

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type permissionCreator = func(ctx context.Context) error

func getPermissionCreator(ctx context.Context, key *resource.ResourceKey, grantPermisions string, obj runtime.Object, access accesscontrol.PermissionsService) (permissionCreator, error) {
	if grantPermisions == "" {
		return nil, nil
	}
	if grantPermisions != "*" {
		return nil, fmt.Errorf("invalid permissions value. only * supported")
	}
	if access == nil {
		return nil, fmt.Errorf("missing access control setup")
	}
	val, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	if val.GetFolder() != "" {
		return nil, fmt.Errorf("granting create permissions only works for root folder objects")
	}
	auth, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return nil, errors.New("missing auth info")
	}
	if auth.GetIdentityType() != authtypes.TypeUser {
		return nil, fmt.Errorf("only uses may grant themselves permissions using the annotation")
	}

	return func(ctx context.Context) error {

		fmt.Printf("TODO!!! grant permissions!!!!: %s // %s", auth.GetUID(), key.SearchID())

		return nil
	}, nil
}
