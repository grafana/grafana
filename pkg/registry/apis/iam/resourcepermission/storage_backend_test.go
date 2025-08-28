package resourcepermission

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestWriteEvent_Add(t *testing.T) {
	store := db.InitTestDB(t)

	timeNow = func() time.Time {
		return time.Date(2025, 8, 28, 17, 13, 0, 0, time.UTC)
	}

	sqlHelper := &legacysql.LegacyDatabaseHelper{
		DB:    store,
		Table: func(name string) string { return name },
	}

	dbProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return sqlHelper, nil
	}

	t.Run("should error with invalid namespace", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key:  &resourcepb.ResourceKey{Name: "folders.grafana.app-folders-fold1", Namespace: "invalid"},
		})

		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "requires a valid namespace")
	})

	t.Run("should work with valid resource permission", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)
		backend.identityStore = NewFakeIdentityStore(t)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folders.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folders.grafana.app",
					Resource: "folders",
					Name:     "fold1",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindUser,
						Name: "captain",
						Verb: "Edit",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount,
						Name: "robot",
						Verb: "View",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindTeam,
						Name: "devs",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folders.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})

		require.NoError(t, err)
		require.Equal(t, timeNow().UnixMilli(), rv)
	})
}
