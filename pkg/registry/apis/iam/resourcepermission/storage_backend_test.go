package resourcepermission

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
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
		backend.identityStore = &fakeIdentityStore{
			t:               t,
			users:           map[string]int64{"captain": 101},
			serviceAccounts: map[string]int64{"robot": 201},
			teams:           map[string]int64{"devs": 301},
			expectedNs:      types.NamespaceInfo{Value: "default"},
		}

		role, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
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
			Object: role,
		})

		require.NoError(t, err)
		require.Equal(t, timeNow().UnixMilli(), rv)
	})
}

type fakeIdentityStore struct {
	t *testing.T

	users           map[string]int64
	serviceAccounts map[string]int64
	teams           map[string]int64
	expectedNs      types.NamespaceInfo
}

// GetServiceAccountInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetServiceAccountInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetServiceAccountInternalIDQuery) (*legacy.GetServiceAccountInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.serviceAccounts[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetServiceAccountInternalIDResult{ID: id}, nil
}

// GetTeamInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetTeamInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetTeamInternalIDQuery) (*legacy.GetTeamInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.teams[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetTeamInternalIDResult{ID: id}, nil
}

// GetUserInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetUserInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetUserInternalIDQuery) (*legacy.GetUserInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.users[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetUserInternalIDResult{ID: id}, nil
}
