package apistore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestAfterCreatePermissionCreator(t *testing.T) {
	mockSetter := func(ctx context.Context, key *resourcepb.ResourceKey, auth authtypes.AuthInfo, val utils.GrafanaMetaAccessor) error {
		return nil
	}

	t.Run("should return nil when grantPermissions is empty", func(t *testing.T) {
		creator, err := afterCreatePermissionCreator(context.Background(), nil, "", nil, mockSetter)
		require.NoError(t, err)
		require.Nil(t, creator)
	})

	t.Run("should error with invalid grantPermissions value", func(t *testing.T) {
		creator, err := afterCreatePermissionCreator(context.Background(), nil, "invalid", nil, mockSetter)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "invalid permissions value")
	})

	t.Run("should error when setter is nil", func(t *testing.T) {
		creator, err := afterCreatePermissionCreator(context.Background(), nil, utils.AnnoGrantPermissionsDefault, nil, nil)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "missing default permission creator")
	})

	t.Run("should error when auth info is missing", func(t *testing.T) {
		obj := &v0alpha1.Dashboard{}
		creator, err := afterCreatePermissionCreator(context.Background(), nil, utils.AnnoGrantPermissionsDefault, obj, mockSetter)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "missing auth info")
	})
}

func TestKeepExistingPermissions(t *testing.T) {
	var keepExisting bool
	setter := func(ctx context.Context, key *resourcepb.ResourceKey, auth authtypes.AuthInfo, val utils.GrafanaMetaAccessor) error {
		keepExisting = KeepExistingPermissions(ctx)
		return nil
	}
	ctx := authtypes.WithAuthInfo(context.Background(), &identity.StaticRequester{UserID: 1, Type: authtypes.TypeUser})

	t.Run("create does not ask to keep existing permissions", func(t *testing.T) {
		creator, err := afterCreatePermissionCreator(ctx, nil, utils.AnnoGrantPermissionsDefault, &v0alpha1.Dashboard{}, setter)
		require.NoError(t, err)
		require.NoError(t, creator(ctx))
		require.False(t, keepExisting)
	})

	t.Run("move to root keeps existing permissions", func(t *testing.T) {
		creator, err := afterMoveToRootPermissionCreator(ctx, nil, utils.AnnoGrantPermissionsDefault, &v0alpha1.Dashboard{}, setter)
		require.NoError(t, err)
		require.NoError(t, creator(ctx))
		require.True(t, keepExisting)
	})

	t.Run("move to root without grant does nothing", func(t *testing.T) {
		creator, err := afterMoveToRootPermissionCreator(ctx, nil, "", &v0alpha1.Dashboard{}, setter)
		require.NoError(t, err)
		require.Nil(t, creator)
	})
}
