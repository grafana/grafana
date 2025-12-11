package iam

import (
	"context"
	"slices"
	"sync"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
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

		testMemberBinding := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 1)
			require.Equal(t, "org-1", req.Namespace)

			expectedOperation := &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}

			require.True(t, containsTeamBindingOperation(req.Operations, expectedOperation))

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testMemberBinding}
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

		testAdminBinding := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 1)
			require.Equal(t, "org-2", req.Namespace)

			expectedOperation := &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-2",
						Permission:  "admin",
					},
				},
			}

			require.True(t, containsTeamBindingOperation(req.Operations, expectedOperation))

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testAdminBinding}
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

		testPermissionUpdate := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)

			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))

			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testPermissionUpdate}

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

		testUserUpdate := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)

			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))

			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testUserUpdate}

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

		testTeamUpdate := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)

			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-2",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testTeamUpdate}

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

		testNoMutateOnFailure := func(ctx context.Context, req *v1.MutateRequest) error {
			// Should not be called when success=false
			require.Fail(t, "Mutate should not be called when update fails")
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoMutateOnFailure}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call finish function with success=false
		finishFunc(context.Background(), false)
		// No wait needed since mutate should not be called
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
					Name: "", // Empty name will cause server-side error on delete
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

		testEmptyOldBinding := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-6", req.Namespace)
			require.NotNil(t, req.Operations)

			// Should have both delete and create operations
			// The delete will have empty subject and fail server-side validation
			require.Len(t, req.Operations, 2)

			// First operation is delete with empty subject
			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))

			// Second operation is create with valid data
			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testEmptyOldBinding}

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

		mutateCalled := false
		testNoMutateOnNoChange := func(ctx context.Context, req *v1.MutateRequest) error {
			mutateCalled = true
			require.Fail(t, "Mutate should not be called when bindings are identical")
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoMutateOnNoChange}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when bindings are identical

		// Verify mutate was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, mutateCalled, "Mutate callback should not be called when bindings are identical")
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

		mutateCalled := false
		testNoMutateOnInvalidBinding := func(ctx context.Context, req *v1.MutateRequest) error {
			mutateCalled = true
			require.Fail(t, "Mutate should not be called when new binding has empty subject name")
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoMutateOnInvalidBinding}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when new binding has empty subject name

		// Verify mutate was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, mutateCalled, "Mutate callback should not be called when new binding has empty subject name")
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

		mutateCalled := false
		testNoMutateOnInvalidBinding := func(ctx context.Context, req *v1.MutateRequest) error {
			mutateCalled = true
			require.Fail(t, "Mutate should not be called when new binding has empty team ref name")
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoMutateOnInvalidBinding}

		finishFunc, err := b.BeginTeamBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when new binding has empty team ref name

		// Verify mutate was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, mutateCalled, "Mutate callback should not be called when new binding has empty team ref name")
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

		testMemberDelete := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 1)

			expectedOperation := &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}

			require.True(t, containsTeamBindingOperation(req.Operations, expectedOperation))
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testMemberDelete}
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

		testAdminDelete := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 1)

			expectedOperation := &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-2",
						Permission:  "admin",
					},
				},
			}

			require.True(t, containsTeamBindingOperation(req.Operations, expectedOperation))
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testAdminDelete}
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

	t.Run("should handle empty team name gracefully", func(t *testing.T) {
		wg.Add(1)
		// TeamBinding with empty team ref name will be sent to server which will return error
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
					Name: "", // Empty name will cause server-side error
				},
				Permission: iamv0.TeamBindingTeamPermissionMember,
			},
		}

		testErrorHandling := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 1)
			require.Equal(t, "org-4", req.Namespace)

			// Operation will have empty team name, which would fail server-side validation
			require.True(t, containsTeamBindingOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-4",
						TeamName:    "",
						Permission:  "member",
					},
				},
			}))
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testErrorHandling}
		b.AfterTeamBindingDelete(&teamBinding, nil)
		wg.Wait()
	})
}

func containsTeamBindingOperation(operations []*v1.MutateOperation, operation *v1.MutateOperation) bool {
	return slices.ContainsFunc(operations, func(o *v1.MutateOperation) bool {
		switch operation.Operation.(type) {
		case *v1.MutateOperation_DeleteTeamBinding:
			deleteOperation := operation.Operation.(*v1.MutateOperation_DeleteTeamBinding)
			deleteO, ok := o.Operation.(*v1.MutateOperation_DeleteTeamBinding)
			if !ok {
				return false
			}
			return deleteO.DeleteTeamBinding.SubjectName == deleteOperation.DeleteTeamBinding.SubjectName &&
				deleteO.DeleteTeamBinding.TeamName == deleteOperation.DeleteTeamBinding.TeamName &&
				deleteO.DeleteTeamBinding.Permission == deleteOperation.DeleteTeamBinding.Permission
		case *v1.MutateOperation_CreateTeamBinding:
			createOperation := operation.Operation.(*v1.MutateOperation_CreateTeamBinding)
			createO, ok := o.Operation.(*v1.MutateOperation_CreateTeamBinding)
			if !ok {
				return false
			}
			return createO.CreateTeamBinding.SubjectName == createOperation.CreateTeamBinding.SubjectName &&
				createO.CreateTeamBinding.TeamName == createOperation.CreateTeamBinding.TeamName &&
				createO.CreateTeamBinding.Permission == createOperation.CreateTeamBinding.Permission
		}
		return false
	})
}
