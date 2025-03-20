package apistore

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func canGrantPermissionsOnCreate(ctx context.Context, grantPermisions string, obj runtime.Object) error {
	if grantPermisions == "" {
		return nil
	}
	if grantPermisions != "*" {
		return fmt.Errorf("invalid permissions value. only * supported")
	}
	val, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	if val.GetFolder() != "" {
		return fmt.Errorf("granting create permissions only works for root folder objects")
	}
	info, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return errors.New("missing auth info")
	}
	if info.GetIdentityType() != authtypes.TypeUser {
		return fmt.Errorf("only uses may grant themselvs permissions using the annotation")
	}
	return nil
}

func grantPermissionsAfterCreate(ctx context.Context, key *resource.ResourceKey, obj utils.GrafanaMetaAccessor, permissions string) error {
	if permissions != "*" {
		return fmt.Errorf("invalid permissions value. only * supported")
	}
	if obj.GetFolder() != "" {
		return fmt.Errorf("granting create permissions only works for root folder objects")
	}
	auth, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return errors.New("missing auth info")
	}
	if auth.GetIdentityType() != authtypes.TypeUser {
		return fmt.Errorf("only uses may grant themselvs permissions using the annotation")
	}

	fmt.Printf("TODO!!! grant permissions!!!!: %s // %s", auth.GetUID(), key.SearchID())

	return nil
}
