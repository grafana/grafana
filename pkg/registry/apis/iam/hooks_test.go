package iam

import (
	"context"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/stretchr/testify/require"
)

type FakeZanzanaClient struct {
	zanzana.Client
	writeCallback func(context.Context, *v1.WriteRequest) error
}

// Write implements zanzana.Client.
func (f *FakeZanzanaClient) Write(ctx context.Context, req *v1.WriteRequest) error {
	return f.writeCallback(ctx, req)
}

func TestAfterResourcePermissionCreate(t *testing.T) {
	t.Skip("Need to fix its flaky behavior in CI")

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should create zanzana entries for folder resource permissions", func(t *testing.T) {
		folderPerm := iamv0.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-2",
			},
			Spec: iamv0.ResourcePermissionSpec{
				Resource: iamv0.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app", Resource: "folders", Name: "fold1",
				},
				Permissions: []iamv0.ResourcePermissionspecPermission{
					{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "u1", Verb: "View"},
					{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "Edit"},
				},
			},
		}

		testFolderEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "org-2", req.Namespace)
			require.Equal(
				t,
				req.Writes.TupleKeys[0],
				&v1.TupleKey{User: "user:u1", Relation: "view", Object: "folder:fold1"},
			)
			require.Equal(
				t,
				req.Writes.TupleKeys[1],
				&v1.TupleKey{User: "role:basic_editor#assignee", Relation: "edit", Object: "folder:fold1"},
			)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testFolderEntries}
		b.AfterResourcePermissionCreate(&folderPerm, nil)
	})

	// Wait for the ticket to be released
	<-b.zTickets

	t.Run("should create zanzana entries for dashboard resource permissions", func(t *testing.T) {
		dashPerm := iamv0.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: iamv0.ResourcePermissionSpec{
				Resource: iamv0.ResourcePermissionspecResource{
					ApiGroup: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
				},
				Permissions: []iamv0.ResourcePermissionspecPermission{
					{Kind: iamv0.ResourcePermissionSpecPermissionKindServiceAccount, Name: "sa1", Verb: "View"},
					{Kind: iamv0.ResourcePermissionSpecPermissionKindTeam, Name: "team1", Verb: "Edit"},
				},
			},
		}

		testDashEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			object := "resource:dashboard.grafana.app/dashboards/dash1"

			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "default", req.Namespace)

			tuple1 := req.Writes.TupleKeys[0]
			require.NotNil(t, tuple1.Condition)
			require.Equal(t, "group_filter", tuple1.Condition.Name)
			tuple1.Condition = nil
			require.Equal(
				t,
				tuple1,
				&v1.TupleKey{User: "service-account:sa1", Relation: "view", Object: object},
			)

			tuple2 := req.Writes.TupleKeys[1]
			require.NotNil(t, tuple2.Condition)
			require.Equal(t, "group_filter", tuple2.Condition.Name)
			tuple2.Condition = nil
			require.Equal(
				t,
				tuple2,
				&v1.TupleKey{User: "team:team1", Relation: "edit", Object: object},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashEntries}
		b.AfterResourcePermissionCreate(&dashPerm, nil)
	})
}

func TestAfterCoreRoleCreate(t *testing.T) {
	b := &IdentityAccessManagementAPIBuilder{
		logger: log.NewNopLogger(),
	}

	t.Run("should create zanzana entries for core role with folder permissions", func(t *testing.T) {
		coreRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.CoreRoleSpec{
				Title:       "Test Role",
				Description: "Test role for folders",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
					{Action: "folders:write", Scope: "folders:uid:folder1"},
				},
			},
		}

		testCoreRoleEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "org-1", req.Namespace)

			// Check subject is role with assignee relation
			for _, tuple := range req.Writes.TupleKeys {
				require.Equal(t, "role:test-role-uid#assignee", tuple.User)
				require.Equal(t, "folder:folder1", tuple.Object)
			}

			// Check relations
			relations := []string{req.Writes.TupleKeys[0].Relation, req.Writes.TupleKeys[1].Relation}
			require.Contains(t, relations, "get")
			require.Contains(t, relations, "update")

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testCoreRoleEntries}
		b.AfterCoreRoleCreate(&coreRole, nil)
	})

	t.Run("should create zanzana entries for core role with dashboard permissions", func(t *testing.T) {
		coreRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "dashboard-role-uid",
				Namespace: "default",
			},
			Spec: iamv0.CoreRoleSpec{
				Title:       "Dashboard Role",
				Description: "Test role for dashboards",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "dashboards:read", Scope: "dashboards:uid:dash1"},
					{Action: "dashboards:write", Scope: "dashboards:uid:dash1"},
				},
			},
		}

		testDashboardRoleEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "default", req.Namespace)

			// Check subject is role with assignee relation
			for _, tuple := range req.Writes.TupleKeys {
				require.Equal(t, "role:dashboard-role-uid#assignee", tuple.User)
				require.Contains(t, tuple.Object, "resource:")
				require.Contains(t, tuple.Object, "dashboard")
			}

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashboardRoleEntries}
		b.AfterCoreRoleCreate(&coreRole, nil)
	})

	t.Run("should handle wildcard scopes", func(t *testing.T) {
		coreRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "wildcard-role-uid",
				Namespace: "org-2",
			},
			Spec: iamv0.CoreRoleSpec{
				Title: "Wildcard Role",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:*"},
				},
			},
		}

		testWildcardEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)

			tuple := req.Writes.TupleKeys[0]
			require.Equal(t, "role:wildcard-role-uid#assignee", tuple.User)
			// Wildcard should create a group_resource tuple
			require.Contains(t, tuple.Object, "group_resource:")

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testWildcardEntries}
		b.AfterCoreRoleCreate(&coreRole, nil)
	})

	t.Run("should skip untranslatable permissions", func(t *testing.T) {
		coreRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "mixed-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.CoreRoleSpec{
				Title: "Mixed Role",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
					{Action: "unknown:action", Scope: "unknown:scope"}, // This should be skipped
				},
			},
		}

		testMixedEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			// Should only have 1 tuple (the untranslatable one should be skipped)
			require.Len(t, req.Writes.TupleKeys, 1)

			tuple := req.Writes.TupleKeys[0]
			require.Equal(t, "role:mixed-role-uid#assignee", tuple.User)
			require.Equal(t, "folder:folder1", tuple.Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testMixedEntries}
		b.AfterCoreRoleCreate(&coreRole, nil)
	})
}

func TestAfterRoleCreate(t *testing.T) {
	b := &IdentityAccessManagementAPIBuilder{
		logger: log.NewNopLogger(),
	}

	t.Run("should create zanzana entries for role with folder permissions", func(t *testing.T) {
		role := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "custom-role-uid",
				Namespace: "org-3",
			},
			Spec: iamv0.RoleSpec{
				Title:       "Custom Role",
				Description: "Custom role for folders",
				Permissions: []iamv0.RolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder2"},
					{Action: "folders:delete", Scope: "folders:uid:folder2"},
				},
			},
		}

		testRoleEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "org-3", req.Namespace)

			// Check subject is role with assignee relation
			for _, tuple := range req.Writes.TupleKeys {
				require.Equal(t, "role:custom-role-uid#assignee", tuple.User)
				require.Equal(t, "folder:folder2", tuple.Object)
			}

			// Check relations
			relations := []string{req.Writes.TupleKeys[0].Relation, req.Writes.TupleKeys[1].Relation}
			require.Contains(t, relations, "get")
			require.Contains(t, relations, "delete")

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testRoleEntries}
		b.AfterRoleCreate(&role, nil)
	})

	t.Run("should create zanzana entries for role with dashboard permissions", func(t *testing.T) {
		role := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "dash-role-uid",
				Namespace: "default",
			},
			Spec: iamv0.RoleSpec{
				Title:       "Dashboard Custom Role",
				Description: "Custom role for dashboards",
				Permissions: []iamv0.RolespecPermission{
					{Action: "dashboards:read", Scope: "dashboards:uid:mydash"},
					{Action: "dashboards:delete", Scope: "dashboards:uid:mydash"},
				},
			},
		}

		testDashRoleEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "default", req.Namespace)

			// Check subject is role with assignee relation
			for _, tuple := range req.Writes.TupleKeys {
				require.Equal(t, "role:dash-role-uid#assignee", tuple.User)
				require.Contains(t, tuple.Object, "resource:")
			}

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashRoleEntries}
		b.AfterRoleCreate(&role, nil)
	})

	t.Run("should merge folder resource tuples with same object and user", func(t *testing.T) {
		role := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "merge-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleSpec{
				Title: "Merge Test Role",
				Permissions: []iamv0.RolespecPermission{
					// These should create folder resource tuples that get merged
					{Action: "dashboards:read", Scope: "folders:uid:parent-folder"},
					{Action: "dashboards:write", Scope: "folders:uid:parent-folder"},
				},
			},
		}

		testMergedEntries := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			// After merging, we should have tuples for the folder resource actions
			require.Greater(t, len(req.Writes.TupleKeys), 0)

			for _, tuple := range req.Writes.TupleKeys {
				require.Equal(t, "role:merge-role-uid#assignee", tuple.User)
			}

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testMergedEntries}
		b.AfterRoleCreate(&role, nil)
	})
}
