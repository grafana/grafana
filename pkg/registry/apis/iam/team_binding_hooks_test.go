package iam

import (
	"context"
	"sync"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/stretchr/testify/require"
)

func TestAfterTeamBindingCreate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should create zanzana entry for team binding with member permission", func(t *testing.T) {
		wg.Add(1)
		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
				External:   false,
			},
		}

		testMemberBinding := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(t, "org-1", req.Namespace)
			require.Nil(t, req.Deletes)

			expectedTuple := &v1.TupleKey{
				User:     "user:user-1",
				Relation: "member",
				Object:   "team:team-1",
			}

			actualTuple := req.Writes.TupleKeys[0]
			require.Equal(t, expectedTuple.User, actualTuple.User)
			require.Equal(t, expectedTuple.Relation, actualTuple.Relation)
			require.Equal(t, expectedTuple.Object, actualTuple.Object)
			require.Nil(t, actualTuple.Condition)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testMemberBinding}
		b.AfterTeamBindingCreate(&teamBinding, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entry for team binding with admin permission", func(t *testing.T) {
		wg.Add(1)
		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-2",
				Namespace: "org-2",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-2",
				},
				Permission: iamv0.TeamBindingTeamPermissionAdmin,
				External:   true,
			},
		}

		testAdminBinding := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(t, "org-2", req.Namespace)
			require.Nil(t, req.Deletes)

			expectedTuple := &v1.TupleKey{
				User:     "user:user-2",
				Relation: "admin",
				Object:   "team:team-2",
			}

			actualTuple := req.Writes.TupleKeys[0]
			require.Equal(t, expectedTuple.User, actualTuple.User)
			require.Equal(t, expectedTuple.Relation, actualTuple.Relation)
			require.Equal(t, expectedTuple.Object, actualTuple.Object)
			require.Nil(t, actualTuple.Condition)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testAdminBinding}
		b.AfterTeamBindingCreate(&teamBinding, nil)
		wg.Wait()
	})

	t.Run("should not write to zanzana when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-3",
				Namespace: "org-3",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-3",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-3",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		// Should not panic or error when zClient is nil
		builder.AfterTeamBindingCreate(&teamBinding, nil)
	})

	t.Run("should handle conversion error gracefully", func(t *testing.T) {
		// TeamBinding with empty subject name should fail conversion
		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-4",
				Namespace: "org-4",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "", // Empty name should cause error
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-4",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		writeCalled := false
		testErrorHandling := func(ctx context.Context, req *v1.WriteRequest) error {
			writeCalled = true
			// Should not be called due to conversion error
			require.Fail(t, "Write should not be called when conversion fails")
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testErrorHandling}
		b.AfterTeamBindingCreate(&teamBinding, nil)
		// Wait a bit to ensure the goroutine has time to process
		// The goroutine will complete but won't call the write callback
		time.Sleep(100 * time.Millisecond)
		require.False(t, writeCalled, "Write callback should not be called when conversion fails")
	})
}

func TestBeginTeamBindingUpdate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should update zanzana entry when permission changes from member to admin", func(t *testing.T) {
		wg.Add(1)
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionAdmin,
			},
		}

		testPermissionUpdate := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			// Should delete old member permission
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:user-1", Relation: "member", Object: "team:team-1"},
			)

			// Should write new admin permission
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(
				t,
				req.Writes.TupleKeys[0],
				&v1.TupleKey{User: "user:user-1", Relation: "admin", Object: "team:team-1"},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testPermissionUpdate}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should update zanzana entry when user changes", func(t *testing.T) {
		wg.Add(1)
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-2",
				Namespace: "org-2",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-2",
				Namespace: "org-2",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		testUserUpdate := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should delete old user binding
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:user-1", Relation: "member", Object: "team:team-1"},
			)

			// Should write new user binding
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(
				t,
				req.Writes.TupleKeys[0],
				&v1.TupleKey{User: "user:user-2", Relation: "member", Object: "team:team-1"},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testUserUpdate}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should update zanzana entry when team changes", func(t *testing.T) {
		wg.Add(1)
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-3",
				Namespace: "org-3",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionAdmin,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-3",
				Namespace: "org-3",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-2",
				},
				Permission: iamv0.TeamBindingTeamPermissionAdmin,
			},
		}

		testTeamUpdate := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)

			// Should delete old team binding
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:user-1", Relation: "admin", Object: "team:team-1"},
			)

			// Should write new team binding
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(
				t,
				req.Writes.TupleKeys[0],
				&v1.TupleKey{User: "user:user-1", Relation: "admin", Object: "team:team-2"},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testTeamUpdate}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should not write to zanzana when update fails", func(t *testing.T) {
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-4",
				Namespace: "org-4",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-4",
				Namespace: "org-4",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		testNoWriteOnFailure := func(ctx context.Context, req *v1.WriteRequest) error {
			// Should not be called when success=false
			require.Fail(t, "Write should not be called when update fails")
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testNoWriteOnFailure}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call finish function with success=false
		finishFunc(context.Background(), false)
		// No wait needed since write should not be called
	})

	t.Run("should not write to zanzana when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-5",
				Namespace: "org-5",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-5",
				Namespace: "org-5",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		finishFunc, err := builder.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when zClient is nil
	})

	t.Run("should handle empty old binding subject name gracefully", func(t *testing.T) {
		wg.Add(1)
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-6",
				Namespace: "org-6",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "", // Empty name - conversion will be skipped
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-6",
				Namespace: "org-6",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		testEmptyOldBinding := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-6", req.Namespace)

			// Should not delete old binding (it was skipped due to empty name)
			require.Nil(t, req.Deletes)

			// Should write new binding
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)
			require.Equal(
				t,
				req.Writes.TupleKeys[0],
				&v1.TupleKey{User: "user:user-2", Relation: "member", Object: "team:team-1"},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testEmptyOldBinding}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc) // Should still return finish function

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should return nil finish func when bindings are identical", func(t *testing.T) {
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-7",
				Namespace: "org-7",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-7",
				Namespace: "org-7",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		writeCalled := false
		testNoWriteOnNoChange := func(ctx context.Context, req *v1.WriteRequest) error {
			writeCalled = true
			require.Fail(t, "Write should not be called when bindings are identical")
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testNoWriteOnNoChange}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when bindings are identical

		// Verify write was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, writeCalled, "Write callback should not be called when bindings are identical")
	})

	t.Run("should return nil finish func when new binding has empty subject name", func(t *testing.T) {
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-8",
				Namespace: "org-8",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-8",
				Namespace: "org-8",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "", // Empty name - should cause early return
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		writeCalled := false
		testNoWriteOnInvalidBinding := func(ctx context.Context, req *v1.WriteRequest) error {
			writeCalled = true
			require.Fail(t, "Write should not be called when new binding has empty subject name")
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testNoWriteOnInvalidBinding}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when new binding has empty subject name

		// Verify write was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, writeCalled, "Write callback should not be called when new binding has empty subject name")
	})

	t.Run("should return nil finish func when new binding has empty team ref name", func(t *testing.T) {
		oldBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-9",
				Namespace: "org-9",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		newBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-9",
				Namespace: "org-9",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "", // Empty name - should cause early return
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		writeCalled := false
		testNoWriteOnInvalidBinding := func(ctx context.Context, req *v1.WriteRequest) error {
			writeCalled = true
			require.Fail(t, "Write should not be called when new binding has empty team ref name")
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testNoWriteOnInvalidBinding}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when new binding has empty team ref name

		// Verify write was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, writeCalled, "Write callback should not be called when new binding has empty team ref name")
	})
}

func TestAfterTeamBindingDelete(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should delete zanzana entry for team binding with member permission", func(t *testing.T) {
		wg.Add(1)
		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
				External:   false,
			},
		}

		testMemberDelete := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Nil(t, req.Writes)

			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:user-1", Relation: "member", Object: "team:team-1"},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testMemberDelete}
		b.AfterTeamBindingDelete(&teamBinding, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entry for team binding with admin permission", func(t *testing.T) {
		wg.Add(1)
		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-2",
				Namespace: "org-2",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-2",
				},
				Permission: iamv0.TeamBindingTeamPermissionAdmin,
				External:   true,
			},
		}

		testAdminDelete := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Nil(t, req.Writes)

			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:user-2", Relation: "admin", Object: "team:team-2"},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testAdminDelete}
		b.AfterTeamBindingDelete(&teamBinding, nil)
		wg.Wait()
	})

	t.Run("should not delete from zanzana when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-3",
				Namespace: "org-3",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-3",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-3",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		// Should not panic or error when zClient is nil
		builder.AfterTeamBindingDelete(&teamBinding, nil)
	})

	t.Run("should handle conversion error gracefully", func(t *testing.T) {
		// TeamBinding with empty team ref name should fail conversion
		teamBinding := iamv0.TeamBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-4",
				Namespace: "org-4",
			},
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-4",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "", // Empty name should cause error
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		writeCalled := false
		testErrorHandling := func(ctx context.Context, req *v1.WriteRequest) error {
			writeCalled = true
			// Should not be called due to conversion error
			require.Fail(t, "Write should not be called when conversion fails")
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testErrorHandling}
		b.AfterTeamBindingDelete(&teamBinding, nil)
		// Wait a bit to ensure the goroutine has time to process
		// The goroutine will complete but won't call the write callback
		time.Sleep(100 * time.Millisecond)
		require.False(t, writeCalled, "Write callback should not be called when conversion fails")
	})
}

func TestConvertTeamBindingToTuple(t *testing.T) {
	t.Run("should convert member permission correctly", func(t *testing.T) {
		tb := &iamv0.TeamBinding{
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		tuple, err := convertTeamBindingToTuple(tb)
		require.NoError(t, err)
		require.NotNil(t, tuple)
		require.Equal(t, "user:user-1", tuple.User)
		require.Equal(t, "member", tuple.Relation)
		require.Equal(t, "team:team-1", tuple.Object)
		require.Nil(t, tuple.Condition)
	})

	t.Run("should convert admin permission correctly", func(t *testing.T) {
		tb := &iamv0.TeamBinding{
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-2",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-2",
				},
				Permission: iamv0.TeamBindingTeamPermissionAdmin,
			},
		}

		tuple, err := convertTeamBindingToTuple(tb)
		require.NoError(t, err)
		require.NotNil(t, tuple)
		require.Equal(t, "user:user-2", tuple.User)
		require.Equal(t, "admin", tuple.Relation)
		require.Equal(t, "team:team-2", tuple.Object)
		require.Nil(t, tuple.Condition)
	})

	t.Run("should return error for empty subject name", func(t *testing.T) {
		tb := &iamv0.TeamBinding{
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		tuple, err := convertTeamBindingToTuple(tb)
		require.Error(t, err)
		require.Nil(t, tuple)
		require.Equal(t, errEmptyName, err)
	})

	t.Run("should return error for empty team ref name", func(t *testing.T) {
		tb := &iamv0.TeamBinding{
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "",
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		tuple, err := convertTeamBindingToTuple(tb)
		require.Error(t, err)
		require.Nil(t, tuple)
		require.Equal(t, errEmptyName, err)
	})

	t.Run("should default to member for unknown permission", func(t *testing.T) {
		tb := &iamv0.TeamBinding{
			Spec: iamv0.TeamBindingSpec{
				Subject: iamv0.TeamBindingspecSubject{
					Name: "user-1",
				},
				TeamRef: iamv0.TeamBindingTeamRef{
					Name: "team-1",
				},
				Permission: "unknown", // Invalid permission
			},
		}

		tuple, err := convertTeamBindingToTuple(tb)
		require.NoError(t, err)
		require.NotNil(t, tuple)
		// Should default to member relation
		require.Equal(t, "member", tuple.Relation)
	})
}
