package iam

import (
	"context"
	"sync"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/stretchr/testify/require"
)

func TestAfterCoreRoleCreate(t *testing.T) {
	var wg sync.WaitGroup

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should create zanzana entries for core role with folder permissions", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "org-1", req.Namespace)

			expectedTuples := []*v1.TupleKey{
				{User: "role:test-role-uid#assignee", Relation: "get", Object: "folder:folder1"},
				{User: "role:test-role-uid#assignee", Relation: "update", Object: "folder:folder1"},
			}

			requireTuplesMatch(t, req.Writes.TupleKeys, expectedTuples)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testCoreRoleEntries}
		b.AfterRoleCreate(&coreRole, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entries for core role with dashboard permissions", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
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
		b.AfterRoleCreate(&coreRole, nil)
		wg.Wait()
	})

	t.Run("should handle wildcard scopes", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
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
		b.AfterRoleCreate(&coreRole, nil)
		wg.Wait()
	})

	t.Run("should skip untranslatable permissions", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
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
		b.AfterRoleCreate(&coreRole, nil)
		wg.Wait()
	})
}

func TestAfterRoleCreate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should create zanzana entries for role with folder permissions", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "org-3", req.Namespace)

			expectedTuples := []*v1.TupleKey{
				{User: "role:custom-role-uid#assignee", Relation: "get", Object: "folder:folder2"},
				{User: "role:custom-role-uid#assignee", Relation: "delete", Object: "folder:folder2"},
			}

			requireTuplesMatch(t, req.Writes.TupleKeys, expectedTuples)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testRoleEntries}
		b.AfterRoleCreate(&role, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entries for role with dashboard permissions", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
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
		wg.Wait()
	})

	t.Run("should merge folder resource tuples with same object and user", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
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
		wg.Wait()
	})
}

func TestBeginCoreRoleUpdate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should update zanzana entries when permissions change", func(t *testing.T) {
		wg.Add(1)
		oldRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.CoreRoleSpec{
				Title: "Test Role",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
					{Action: "folders:write", Scope: "folders:uid:folder1"},
				},
			},
		}

		newRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.CoreRoleSpec{
				Title: "Test Role Updated",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder2"},
					{Action: "folders:delete", Scope: "folders:uid:folder2"},
				},
			},
		}

		testUpdate := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			// Verify deletes (old permissions)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)

			expectedDeletes := []*v1.TupleKeyWithoutCondition{
				{User: "role:test-role-uid#assignee", Relation: "get", Object: "folder:folder1"},
				{User: "role:test-role-uid#assignee", Relation: "update", Object: "folder:folder1"},
			}
			requireDeleteTuplesMatch(t, req.Deletes.TupleKeys, expectedDeletes)

			// Verify writes (new permissions)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)

			expectedWrites := []*v1.TupleKey{
				{User: "role:test-role-uid#assignee", Relation: "get", Object: "folder:folder2"},
				{User: "role:test-role-uid#assignee", Relation: "delete", Object: "folder:folder2"},
			}
			requireTuplesMatch(t, req.Writes.TupleKeys, expectedWrites)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testUpdate}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginRoleUpdate(context.Background(), &newRole, &oldRole, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should handle adding new permissions", func(t *testing.T) {
		wg.Add(1)
		oldRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "expand-role-uid",
				Namespace: "org-2",
			},
			Spec: iamv0.CoreRoleSpec{
				Title: "Expand Role",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
				},
			},
		}

		newRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "expand-role-uid",
				Namespace: "org-2",
			},
			Spec: iamv0.CoreRoleSpec{
				Title: "Expand Role",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
					{Action: "folders:write", Scope: "folders:uid:folder1"},
					{Action: "folders:delete", Scope: "folders:uid:folder1"},
				},
			},
		}

		testExpand := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should delete old permission
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)

			// Should write all new permissions
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 3)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testExpand}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginRoleUpdate(context.Background(), &newRole, &oldRole, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should handle removing all permissions", func(t *testing.T) {
		wg.Add(1)
		oldRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "clear-role-uid",
				Namespace: "org-3",
			},
			Spec: iamv0.CoreRoleSpec{
				Title: "Clear Role",
				Permissions: []iamv0.CoreRolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
					{Action: "folders:write", Scope: "folders:uid:folder1"},
				},
			},
		}

		newRole := iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "clear-role-uid",
				Namespace: "org-3",
			},
			Spec: iamv0.CoreRoleSpec{
				Title:       "Clear Role",
				Permissions: []iamv0.CoreRolespecPermission{},
			},
		}

		testClear := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)

			// Should delete old permissions
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)

			// Should have no writes
			require.Nil(t, req.Writes)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testClear}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginRoleUpdate(context.Background(), &newRole, &oldRole, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
		wg.Wait()
	})
}

func TestBeginRoleUpdate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should update zanzana entries when permissions change", func(t *testing.T) {
		wg.Add(1)
		oldRole := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "custom-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleSpec{
				Title: "Custom Role",
				Permissions: []iamv0.RolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
					{Action: "folders:write", Scope: "folders:uid:folder1"},
				},
			},
		}

		newRole := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "custom-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleSpec{
				Title: "Custom Role Updated",
				Permissions: []iamv0.RolespecPermission{
					{Action: "dashboards:read", Scope: "dashboards:uid:dash1"},
					{Action: "dashboards:write", Scope: "dashboards:uid:dash1"},
				},
			},
		}

		testUpdate := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			// Verify deletes (old permissions)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)

			expectedDeletes := []*v1.TupleKeyWithoutCondition{
				{User: "role:custom-role-uid#assignee", Relation: "get", Object: "folder:folder1"},
				{User: "role:custom-role-uid#assignee", Relation: "update", Object: "folder:folder1"},
			}
			requireDeleteTuplesMatch(t, req.Deletes.TupleKeys, expectedDeletes)

			// Verify writes (new permissions) - dashboards use resource type
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)

			// All writes should be for dashboards
			for _, tuple := range req.Writes.TupleKeys {
				require.Equal(t, "role:custom-role-uid#assignee", tuple.User)
				require.Contains(t, tuple.Object, "resource:")
				require.Contains(t, tuple.Object, "dashboard")
			}

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testUpdate}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginRoleUpdate(context.Background(), &newRole, &oldRole, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should handle completely new permission set", func(t *testing.T) {
		wg.Add(1)
		oldRole := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "swap-role-uid",
				Namespace: "default",
			},
			Spec: iamv0.RoleSpec{
				Title: "Swap Role",
				Permissions: []iamv0.RolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
				},
			},
		}

		newRole := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "swap-role-uid",
				Namespace: "default",
			},
			Spec: iamv0.RoleSpec{
				Title: "Swap Role",
				Permissions: []iamv0.RolespecPermission{
					{Action: "folders:write", Scope: "folders:uid:folder2"},
					{Action: "folders:delete", Scope: "folders:uid:folder2"},
				},
			},
		}

		testSwap := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "default", req.Namespace)

			// Should delete old permission
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Equal(t, "role:swap-role-uid#assignee", req.Deletes.TupleKeys[0].User)
			require.Equal(t, "folder:folder1", req.Deletes.TupleKeys[0].Object)

			// Should write new permissions
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			for _, tuple := range req.Writes.TupleKeys {
				require.Equal(t, "role:swap-role-uid#assignee", tuple.User)
				require.Equal(t, "folder:folder2", tuple.Object)
			}

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testSwap}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginRoleUpdate(context.Background(), &newRole, &oldRole, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should handle adding permissions to empty role", func(t *testing.T) {
		wg.Add(1)
		oldRole := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "empty-role-uid",
				Namespace: "org-2",
			},
			Spec: iamv0.RoleSpec{
				Title:       "Empty Role",
				Permissions: []iamv0.RolespecPermission{},
			},
		}

		newRole := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "empty-role-uid",
				Namespace: "org-2",
			},
			Spec: iamv0.RoleSpec{
				Title: "Empty Role",
				Permissions: []iamv0.RolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
				},
			},
		}

		testAddToEmpty := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should have no deletes
			require.Nil(t, req.Deletes)

			// Should write new permission
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(t, "role:empty-role-uid#assignee", req.Writes.TupleKeys[0].User)
			require.Equal(t, "folder:folder1", req.Writes.TupleKeys[0].Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testAddToEmpty}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginRoleUpdate(context.Background(), &newRole, &oldRole, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
		wg.Wait()
	})
}

func TestAfterCoreRoleDelete(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should delete zanzana entries for core role with folder permissions", func(t *testing.T) {
		wg.Add(1)
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

		testCoreRoleDeletes := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)
			require.Equal(t, "org-1", req.Namespace)

			expectedDeletes := []*v1.TupleKeyWithoutCondition{
				{User: "role:test-role-uid#assignee", Relation: "get", Object: "folder:folder1"},
				{User: "role:test-role-uid#assignee", Relation: "update", Object: "folder:folder1"},
			}

			requireDeleteTuplesMatch(t, req.Deletes.TupleKeys, expectedDeletes)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testCoreRoleDeletes}
		b.AfterRoleDelete(&coreRole, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entries for core role with dashboard permissions", func(t *testing.T) {
		wg.Add(1)
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

		testDashboardRoleDeletes := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)
			require.Equal(t, "default", req.Namespace)

			// Check all deletes have the correct subject
			for _, tuple := range req.Deletes.TupleKeys {
				require.Equal(t, "role:dashboard-role-uid#assignee", tuple.User)
				require.Contains(t, tuple.Object, "resource:")
			}

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashboardRoleDeletes}
		b.AfterRoleDelete(&coreRole, nil)
		wg.Wait()
	})

	t.Run("should handle wildcard scopes on delete", func(t *testing.T) {
		wg.Add(1)
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

		testWildcardDeletes := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)

			tuple := req.Deletes.TupleKeys[0]
			require.Equal(t, "role:wildcard-role-uid#assignee", tuple.User)
			require.Contains(t, tuple.Object, "group_resource:")

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testWildcardDeletes}
		b.AfterRoleDelete(&coreRole, nil)
		wg.Wait()
	})

	t.Run("should skip untranslatable permissions on delete", func(t *testing.T) {
		wg.Add(1)
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

		testMixedDeletes := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Deletes)
			// Should only delete 1 tuple (the untranslatable one should be skipped)
			require.Len(t, req.Deletes.TupleKeys, 1)

			tuple := req.Deletes.TupleKeys[0]
			require.Equal(t, "role:mixed-role-uid#assignee", tuple.User)
			require.Equal(t, "folder:folder1", tuple.Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testMixedDeletes}
		b.AfterRoleDelete(&coreRole, nil)
		wg.Wait()
	})
}

func TestAfterRoleDelete(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should delete zanzana entries for role with folder permissions", func(t *testing.T) {
		wg.Add(1)
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

		testRoleDeletes := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)
			require.Equal(t, "org-3", req.Namespace)

			expectedDeletes := []*v1.TupleKeyWithoutCondition{
				{User: "role:custom-role-uid#assignee", Relation: "get", Object: "folder:folder2"},
				{User: "role:custom-role-uid#assignee", Relation: "delete", Object: "folder:folder2"},
			}

			requireDeleteTuplesMatch(t, req.Deletes.TupleKeys, expectedDeletes)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testRoleDeletes}
		b.AfterRoleDelete(&role, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entries for role with dashboard permissions", func(t *testing.T) {
		wg.Add(1)
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

		testDashRoleDeletes := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)
			require.Equal(t, "default", req.Namespace)

			// Check all deletes have the correct subject
			for _, tuple := range req.Deletes.TupleKeys {
				require.Equal(t, "role:dash-role-uid#assignee", tuple.User)
				require.Contains(t, tuple.Object, "resource:")
			}

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashRoleDeletes}
		b.AfterRoleDelete(&role, nil)
		wg.Wait()
	})

	t.Run("should handle multiple permissions on delete", func(t *testing.T) {
		wg.Add(1)
		role := iamv0.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "multi-role-uid",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleSpec{
				Title: "Multi Permission Role",
				Permissions: []iamv0.RolespecPermission{
					{Action: "folders:read", Scope: "folders:uid:folder1"},
					{Action: "folders:write", Scope: "folders:uid:folder1"},
					{Action: "folders:delete", Scope: "folders:uid:folder1"},
				},
			},
		}

		testMultiDeletes := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 3)

			// All should be for the same role and folder
			for _, tuple := range req.Deletes.TupleKeys {
				require.Equal(t, "role:multi-role-uid#assignee", tuple.User)
				require.Equal(t, "folder:folder1", tuple.Object)
			}

			// Check all expected relations are present
			relations := make(map[string]bool)
			for _, tuple := range req.Deletes.TupleKeys {
				relations[tuple.Relation] = true
			}
			require.True(t, relations["get"], "Expected 'get' relation")
			require.True(t, relations["update"], "Expected 'update' relation")
			require.True(t, relations["delete"], "Expected 'delete' relation")

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testMultiDeletes}
		b.AfterRoleDelete(&role, nil)
		wg.Wait()
	})
}
