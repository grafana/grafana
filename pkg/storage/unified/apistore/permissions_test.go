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

	t.Run("no setter returns nil regardless of annotation", func(t *testing.T) {
		creator, err := afterCreatePermissionCreator(context.Background(), nil, "", nil, nil)
		require.NoError(t, err)
		require.Nil(t, creator)

		creator, err = afterCreatePermissionCreator(context.Background(), nil, utils.AnnoGrantPermissionsDefault, nil, nil)
		require.NoError(t, err)
		require.Nil(t, creator)
	})

	t.Run("invalid annotation value returns error", func(t *testing.T) {
		creator, err := afterCreatePermissionCreator(context.Background(), nil, "invalid", nil, mockSetter)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "invalid permissions value")
	})

	t.Run("setter configured without annotation still invokes setter", func(t *testing.T) {
		ctx := authtypes.WithAuthInfo(context.Background(), &identity.StaticRequester{})
		obj := &v0alpha1.Dashboard{}
		obj.Name = "test-dashboard"
		creator, err := afterCreatePermissionCreator(ctx, nil, "", obj, mockSetter)
		require.NoError(t, err)
		require.NotNil(t, creator)
	})

	t.Run("missing auth info returns error when setter is configured", func(t *testing.T) {
		obj := &v0alpha1.Dashboard{}
		creator, err := afterCreatePermissionCreator(context.Background(), nil, "", obj, mockSetter)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "missing auth info")
	})

	t.Run("setter configured with annotation invokes setter", func(t *testing.T) {
		ctx := authtypes.WithAuthInfo(context.Background(), &identity.StaticRequester{})
		obj := &v0alpha1.Dashboard{}
		obj.Name = "test-dashboard"
		creator, err := afterCreatePermissionCreator(ctx, nil, utils.AnnoGrantPermissionsDefault, obj, mockSetter)
		require.NoError(t, err)
		require.NotNil(t, creator)
	})
}
