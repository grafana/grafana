package apistore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestAfterCreatePermissionCreator(t *testing.T) {
	mockSetter := func(ctx context.Context, key *resource.ResourceKey, auth authtypes.AuthInfo, val utils.GrafanaMetaAccessor) error {
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

	t.Run("should error for managed resources", func(t *testing.T) {
		obj := &v0alpha1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{
					utils.AnnoKeyManagerKind: "test",
				},
			},
		}
		creator, err := afterCreatePermissionCreator(context.Background(), nil, utils.AnnoGrantPermissionsDefault, obj, mockSetter)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "managed resource may not grant permissions")
	})

	t.Run("should error when auth info is missing", func(t *testing.T) {
		obj := &v0alpha1.Dashboard{}
		creator, err := afterCreatePermissionCreator(context.Background(), nil, utils.AnnoGrantPermissionsDefault, obj, mockSetter)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "missing auth info")
	})

	t.Run("should succeed for user identity", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:    authtypes.TypeUser,
			OrgID:   1,
			OrgRole: "Admin",
			UserID:  1,
		})
		obj := &v0alpha1.Dashboard{}
		key := &resource.ResourceKey{
			Group:     "test",
			Resource:  "test",
			Namespace: "test",
			Name:      "test",
		}

		creator, err := afterCreatePermissionCreator(ctx, key, utils.AnnoGrantPermissionsDefault, obj, mockSetter)
		require.NoError(t, err)
		require.NotNil(t, creator)

		err = creator(ctx)
		require.NoError(t, err)
	})

	t.Run("should succeed for service account identity", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:    authtypes.TypeServiceAccount,
			OrgID:   1,
			OrgRole: "Admin",
			UserID:  1,
		})
		obj := &v0alpha1.Dashboard{}
		key := &resource.ResourceKey{
			Group:     "test",
			Resource:  "test",
			Namespace: "test",
			Name:      "test",
		}

		creator, err := afterCreatePermissionCreator(ctx, key, utils.AnnoGrantPermissionsDefault, obj, mockSetter)
		require.NoError(t, err)
		require.NotNil(t, creator)

		err = creator(ctx)
		require.NoError(t, err)
	})

	t.Run("should error for non-user/non-service-account identity", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: authtypes.TypeAnonymous,
		})
		obj := &v0alpha1.Dashboard{}

		creator, err := afterCreatePermissionCreator(ctx, nil, utils.AnnoGrantPermissionsDefault, obj, mockSetter)
		require.Error(t, err)
		require.Nil(t, creator)
		require.Contains(t, err.Error(), "only users or service accounts may grant themselves permissions")
	})
}
