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

func TestAfterUserCreate(t *testing.T) {
	var wg sync.WaitGroup

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should create zanzana entry for user with Admin role", func(t *testing.T) {
		wg.Add(1)
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "df2p421det1q8c",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		testAdminRole := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(t, "org-1", req.Namespace)

			tuple := req.Writes.TupleKeys[0]
			require.Equal(t, "user:df2p421det1q8c", tuple.User)
			require.Equal(t, "assignee", tuple.Relation)
			require.Equal(t, "role:basic_admin", tuple.Object)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testAdminRole}
		b.AfterUserCreate(&user, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entry for user with Editor role", func(t *testing.T) {
		wg.Add(1)
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "user123",
				Namespace: "org-2",
			},
			Spec: iamv0.UserSpec{
				Role: "Editor",
			},
		}

		testEditorRole := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(t, "org-2", req.Namespace)

			tuple := req.Writes.TupleKeys[0]
			require.Equal(t, "user:user123", tuple.User)
			require.Equal(t, "assignee", tuple.Relation)
			require.Equal(t, "role:basic_editor", tuple.Object)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testEditorRole}
		b.AfterUserCreate(&user, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entry for user with Viewer role", func(t *testing.T) {
		wg.Add(1)
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "viewer456",
				Namespace: "org-3",
			},
			Spec: iamv0.UserSpec{
				Role: "Viewer",
			},
		}

		testViewerRole := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(t, "org-3", req.Namespace)

			tuple := req.Writes.TupleKeys[0]
			require.Equal(t, "user:viewer456", tuple.User)
			require.Equal(t, "assignee", tuple.Relation)
			require.Equal(t, "role:basic_viewer", tuple.Object)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testViewerRole}
		b.AfterUserCreate(&user, nil)
		wg.Wait()
	})

	t.Run("should skip when user has no role", func(t *testing.T) {
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "norole789",
				Namespace: "org-4",
			},
			Spec: iamv0.UserSpec{
				Role: "",
			},
		}

		// Should not call zanzana client
		b.zClient = nil
		b.AfterUserCreate(&user, nil)
		// If we get here without panic, the test passes
	})

	t.Run("should skip when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		// Should return early without calling zanzana
		builder.AfterUserCreate(&user, nil)
		// If we get here without panic, the test passes
	})
}

func TestBeginUserUpdate(t *testing.T) {
	var wg sync.WaitGroup

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should update zanzana entry when role changes from Viewer to Admin", func(t *testing.T) {
		wg.Add(1)
		oldUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Viewer",
			},
		}

		newUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		testRoleChange := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			// Should delete old role
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			deleteTuple := req.Deletes.TupleKeys[0]
			require.Equal(t, "user:testuser", deleteTuple.User)
			require.Equal(t, "assignee", deleteTuple.Relation)
			require.Equal(t, "role:basic_viewer", deleteTuple.Object)

			// Should write new role
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			writeTuple := req.Writes.TupleKeys[0]
			require.Equal(t, "user:testuser", writeTuple.User)
			require.Equal(t, "assignee", writeTuple.Relation)
			require.Equal(t, "role:basic_admin", writeTuple.Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testRoleChange}

		finishFunc, err := b.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should delete old role when new role is empty", func(t *testing.T) {
		wg.Add(1)
		oldUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser2",
				Namespace: "org-2",
			},
			Spec: iamv0.UserSpec{
				Role: "Editor",
			},
		}

		newUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser2",
				Namespace: "org-2",
			},
			Spec: iamv0.UserSpec{
				Role: "",
			},
		}

		testRemoveRole := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should delete old role
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			deleteTuple := req.Deletes.TupleKeys[0]
			require.Equal(t, "user:testuser2", deleteTuple.User)
			require.Equal(t, "assignee", deleteTuple.Relation)
			require.Equal(t, "role:basic_editor", deleteTuple.Object)

			// Should not write new role
			require.Nil(t, req.Writes)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testRemoveRole}

		finishFunc, err := b.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should only write new role when old role was empty", func(t *testing.T) {
		wg.Add(1)
		oldUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser3",
				Namespace: "org-3",
			},
			Spec: iamv0.UserSpec{
				Role: "",
			},
		}

		newUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser3",
				Namespace: "org-3",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		testAddRole := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)

			// Should not delete old role (was empty)
			require.Nil(t, req.Deletes)

			// Should write new role
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			writeTuple := req.Writes.TupleKeys[0]
			require.Equal(t, "user:testuser3", writeTuple.User)
			require.Equal(t, "assignee", writeTuple.Relation)
			require.Equal(t, "role:basic_admin", writeTuple.Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testAddRole}

		finishFunc, err := b.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should skip update when role hasn't changed", func(t *testing.T) {
		oldUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser4",
				Namespace: "org-4",
			},
			Spec: iamv0.UserSpec{
				Role: "Editor",
			},
		}

		newUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser4",
				Namespace: "org-4",
			},
			Spec: iamv0.UserSpec{
				Role: "Editor",
			},
		}

		finishFunc, err := b.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when no update needed
	})

	t.Run("should not call zanzana when update fails", func(t *testing.T) {
		oldUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser5",
				Namespace: "org-5",
			},
			Spec: iamv0.UserSpec{
				Role: "Viewer",
			},
		}

		newUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser5",
				Namespace: "org-5",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		callCount := 0
		testNoCall := func(ctx context.Context, req *v1.WriteRequest) error {
			callCount++
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testNoCall}

		finishFunc, err := b.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call with success=false - should not trigger zanzana write
		finishFunc(context.Background(), false)
		require.Equal(t, 0, callCount, "zanzana should not be called when update fails")
	})

	t.Run("should skip when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		oldUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Viewer",
			},
		}

		newUser := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		finishFunc, err := builder.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when zClient is nil
	})
}

func TestAfterUserDelete(t *testing.T) {
	var wg sync.WaitGroup

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should delete zanzana entry for user with Admin role", func(t *testing.T) {
		wg.Add(1)
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "df2p421det1q8c",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		testDeleteAdmin := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Nil(t, req.Writes)

			deleteTuple := req.Deletes.TupleKeys[0]
			require.Equal(t, "user:df2p421det1q8c", deleteTuple.User)
			require.Equal(t, "assignee", deleteTuple.Relation)
			require.Equal(t, "role:basic_admin", deleteTuple.Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDeleteAdmin}
		b.AfterUserDelete(&user, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entry for user with Editor role", func(t *testing.T) {
		wg.Add(1)
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "editor123",
				Namespace: "org-2",
			},
			Spec: iamv0.UserSpec{
				Role: "Editor",
			},
		}

		testDeleteEditor := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			deleteTuple := req.Deletes.TupleKeys[0]
			require.Equal(t, "user:editor123", deleteTuple.User)
			require.Equal(t, "assignee", deleteTuple.Relation)
			require.Equal(t, "role:basic_editor", deleteTuple.Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDeleteEditor}
		b.AfterUserDelete(&user, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entry for user with Viewer role", func(t *testing.T) {
		wg.Add(1)
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "viewer456",
				Namespace: "org-3",
			},
			Spec: iamv0.UserSpec{
				Role: "Viewer",
			},
		}

		testDeleteViewer := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)

			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			deleteTuple := req.Deletes.TupleKeys[0]
			require.Equal(t, "user:viewer456", deleteTuple.User)
			require.Equal(t, "assignee", deleteTuple.Relation)
			require.Equal(t, "role:basic_viewer", deleteTuple.Object)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDeleteViewer}
		b.AfterUserDelete(&user, nil)
		wg.Wait()
	})

	t.Run("should skip when user has no role", func(t *testing.T) {
		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "norole789",
				Namespace: "org-4",
			},
			Spec: iamv0.UserSpec{
				Role: "",
			},
		}

		// Should not call zanzana client
		b.zClient = nil
		b.AfterUserDelete(&user, nil)
		// If we get here without panic, the test passes
	})

	t.Run("should skip when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		user := iamv0.User{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "testuser",
				Namespace: "org-1",
			},
			Spec: iamv0.UserSpec{
				Role: "Admin",
			},
		}

		// Should return early without calling zanzana
		builder.AfterUserDelete(&user, nil)
		// If we get here without panic, the test passes
	})
}

func TestCreateUserBasicRoleTuple(t *testing.T) {
	t.Run("should create tuple for Admin role", func(t *testing.T) {
		tuple := createUserBasicRoleTuple("user123", "Admin")
		require.NotNil(t, tuple)
		require.Equal(t, "user:user123", tuple.User)
		require.Equal(t, "assignee", tuple.Relation)
		require.Equal(t, "role:basic_admin", tuple.Object)
	})

	t.Run("should create tuple for Editor role", func(t *testing.T) {
		tuple := createUserBasicRoleTuple("user456", "Editor")
		require.NotNil(t, tuple)
		require.Equal(t, "user:user456", tuple.User)
		require.Equal(t, "assignee", tuple.Relation)
		require.Equal(t, "role:basic_editor", tuple.Object)
	})

	t.Run("should create tuple for Viewer role", func(t *testing.T) {
		tuple := createUserBasicRoleTuple("user789", "Viewer")
		require.NotNil(t, tuple)
		require.Equal(t, "user:user789", tuple.User)
		require.Equal(t, "assignee", tuple.Relation)
		require.Equal(t, "role:basic_viewer", tuple.Object)
	})

	t.Run("should create tuple for None role", func(t *testing.T) {
		tuple := createUserBasicRoleTuple("user000", "None")
		require.NotNil(t, tuple)
		require.Equal(t, "user:user000", tuple.User)
		require.Equal(t, "assignee", tuple.Relation)
		require.Equal(t, "role:basic_none", tuple.Object)
	})

	t.Run("should return nil for empty role", func(t *testing.T) {
		tuple := createUserBasicRoleTuple("user123", "")
		require.Nil(t, tuple)
	})

	t.Run("should return nil for invalid role", func(t *testing.T) {
		tuple := createUserBasicRoleTuple("user123", "InvalidRole")
		require.Nil(t, tuple)
	})
}
