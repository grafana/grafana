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

		testAdminRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateUserOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "df2p421det1q8c", updateOp.User)
			require.Equal(t, "Admin", updateOp.Role)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testAdminRole}
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

		testEditorRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateUserOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "user123", updateOp.User)
			require.Equal(t, "Editor", updateOp.Role)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testEditorRole}
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

		testViewerRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateUserOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "viewer456", updateOp.User)
			require.Equal(t, "Viewer", updateOp.Role)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testViewerRole}
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

		testRoleChange := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateUserOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "testuser", updateOp.User)
			require.Equal(t, "Admin", updateOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testRoleChange}

		finishFunc, err := b.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should update role when new role is empty", func(t *testing.T) {
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

		testRemoveRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateUserOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "testuser2", updateOp.User)
			require.Equal(t, "", updateOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testRemoveRole}

		finishFunc, err := b.BeginUserUpdate(context.Background(), &newUser, &oldUser, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should be able to add a new role when old role was empty", func(t *testing.T) {
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

		testAddRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateUserOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "testuser3", updateOp.User)
			require.Equal(t, "Admin", updateOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testAddRole}

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
		testNoCall := func(ctx context.Context, req *v1.MutateRequest) error {
			callCount++
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoCall}

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

		testDeleteAdmin := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			deleteOp := op.GetDeleteUserOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "df2p421det1q8c", deleteOp.User)
			require.Equal(t, "Admin", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDeleteAdmin}
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

		testDeleteEditor := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			deleteOp := op.GetDeleteUserOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "editor123", deleteOp.User)
			require.Equal(t, "Editor", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDeleteEditor}
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

		testDeleteViewer := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			deleteOp := op.GetDeleteUserOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "viewer456", deleteOp.User)
			require.Equal(t, "Viewer", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDeleteViewer}
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
