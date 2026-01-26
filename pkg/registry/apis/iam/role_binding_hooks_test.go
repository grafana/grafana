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

func TestAfterRoleBindingCreate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should create zanzana entry for role binding", func(t *testing.T) {
		wg.Add(1)
		roleBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-1",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-1",
					},
				},
			},
		}

		testRoleBinding := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 1)
			require.Equal(t, "org-1", req.Namespace)

			expectedOperation := &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateRoleBinding{
					CreateRoleBinding: &v1.CreateRoleBindingOperation{
						SubjectKind: "user",
						SubjectName: "user-1",
						RoleKind:    "role",
						RoleName:    "role-1",
					},
				},
			}

			actualCreate := req.Operations[0].Operation.(*v1.MutateOperation_CreateRoleBinding).CreateRoleBinding
			expectedCreate := expectedOperation.Operation.(*v1.MutateOperation_CreateRoleBinding).CreateRoleBinding

			require.Equal(t, expectedCreate.SubjectKind, actualCreate.SubjectKind)
			require.Equal(t, expectedCreate.SubjectName, actualCreate.SubjectName)
			require.Equal(t, expectedCreate.RoleKind, actualCreate.RoleKind)
			require.Equal(t, expectedCreate.RoleName, actualCreate.RoleName)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testRoleBinding}
		b.AfterRoleBindingCreate(&roleBinding, nil)
		wg.Wait()
	})

	t.Run("should not write to zanzana when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		roleBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-3",
				Namespace: "org-3",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-3",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-3",
					},
				},
			},
		}

		// Should not panic or error when zClient is nil
		builder.AfterRoleBindingCreate(&roleBinding, nil)
	})
}

func TestBeginRoleBindingUpdate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should update zanzana entry when role binding changed", func(t *testing.T) {
		wg.Add(1)
		oldBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-1",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-foo",
					},
					{
						Kind: "role",
						Name: "role-2",
					},
				},
			},
		}

		newBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-1",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-bar",
					},
				},
			},
		}

		testRoleBindingUpdate := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 3)

			// Should write new binding and delete old one
			require.True(t, containsOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteRoleBinding{
					DeleteRoleBinding: &v1.DeleteRoleBindingOperation{
						SubjectKind: "user",
						SubjectName: "user-1",
						RoleKind:    "role",
						RoleName:    "role-foo",
					},
				},
			}))

			require.True(t, containsOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateRoleBinding{
					CreateRoleBinding: &v1.CreateRoleBindingOperation{
						SubjectKind: "user",
						SubjectName: "user-1",
						RoleKind:    "role",
						RoleName:    "role-bar",
					},
				},
			}))

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testRoleBindingUpdate}

		finishFunc, err := b.BeginRoleBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should return nil finish func when bindings are identical", func(t *testing.T) {
		oldBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-2",
				Namespace: "org-2",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-1",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-1",
					},
				},
			},
		}

		newBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-2",
				Namespace: "org-2",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-1",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-1",
					},
				},
			},
		}

		writeCalled := false
		testNoWriteOnNoChange := func(ctx context.Context, req *v1.MutateRequest) error {
			writeCalled = true
			require.Fail(t, "Write should not be called when bindings are identical")
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoWriteOnNoChange}

		finishFunc, err := b.BeginRoleBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when bindings are identical

		// Verify write was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, writeCalled, "Write callback should not be called when bindings are identical")
	})

	t.Run("should return nil finish func when new binding has empty subject name", func(t *testing.T) {
		oldBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-8",
				Namespace: "org-8",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-1",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-1",
					},
				},
			},
		}

		newBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-8",
				Namespace: "org-8",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "",
					Name: "", // Empty name - should cause early return
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-1",
					},
				},
			},
		}

		writeCalled := false
		testNoWriteOnInvalidBinding := func(ctx context.Context, req *v1.MutateRequest) error {
			writeCalled = true
			require.Fail(t, "Write should not be called when new binding has empty subject name")
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoWriteOnInvalidBinding}

		finishFunc, err := b.BeginRoleBindingUpdate(context.Background(), &newBinding, &oldBinding, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc) // Should return nil when new binding has empty subject name

		// Verify write was never called
		time.Sleep(100 * time.Millisecond)
		require.False(t, writeCalled, "Write callback should not be called when new binding has empty subject name")
	})
}

func TestAfterRoleBindingDelete(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should delete zanzana entry for team binding with member permission", func(t *testing.T) {
		wg.Add(1)
		roleBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-1",
				Namespace: "org-1",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-1",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-1",
					},
					{
						Kind: "role",
						Name: "role-2",
					},
				},
			},
		}

		testRoleBindingDelete := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)
			require.True(t, containsOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteRoleBinding{
					DeleteRoleBinding: &v1.DeleteRoleBindingOperation{
						SubjectKind: "user",
						SubjectName: "user-1",
						RoleKind:    "role",
						RoleName:    "role-1",
					},
				},
			}))
			require.True(t, containsOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteRoleBinding{
					DeleteRoleBinding: &v1.DeleteRoleBindingOperation{
						SubjectKind: "user",
						SubjectName: "user-1",
						RoleKind:    "role",
						RoleName:    "role-2",
					},
				},
			}))

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testRoleBindingDelete}
		b.AfterRoleBindingDelete(&roleBinding, nil)
		wg.Wait()
	})

	t.Run("should not delete from zanzana when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		roleBinding := iamv0.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "binding-3",
				Namespace: "org-3",
			},
			Spec: iamv0.RoleBindingSpec{
				Subject: iamv0.RoleBindingspecSubject{
					Kind: "user",
					Name: "user-3",
				},
				RoleRefs: []iamv0.RoleBindingspecRoleRef{
					{
						Kind: "role",
						Name: "role-3",
					},
				},
			},
		}

		// Should not panic or error when zClient is nil
		builder.AfterRoleBindingDelete(&roleBinding, nil)
	})
}

func containsOperation(operations []*v1.MutateOperation, operation *v1.MutateOperation) bool {
	return slices.ContainsFunc(operations, func(o *v1.MutateOperation) bool {
		switch operation.Operation.(type) {
		case *v1.MutateOperation_DeleteRoleBinding:
			deleteOperation := operation.Operation.(*v1.MutateOperation_DeleteRoleBinding)
			deleteO, ok := o.Operation.(*v1.MutateOperation_DeleteRoleBinding)
			if !ok {
				return false
			}
			return deleteO.DeleteRoleBinding.SubjectKind == deleteOperation.DeleteRoleBinding.SubjectKind &&
				deleteO.DeleteRoleBinding.SubjectName == deleteOperation.DeleteRoleBinding.SubjectName &&
				deleteO.DeleteRoleBinding.RoleKind == deleteOperation.DeleteRoleBinding.RoleKind &&
				deleteO.DeleteRoleBinding.RoleName == deleteOperation.DeleteRoleBinding.RoleName
		case *v1.MutateOperation_CreateRoleBinding:
			createOperation := operation.Operation.(*v1.MutateOperation_CreateRoleBinding)
			createO, ok := o.Operation.(*v1.MutateOperation_CreateRoleBinding)
			if !ok {
				return false
			}
			return createO.CreateRoleBinding.SubjectKind == createOperation.CreateRoleBinding.SubjectKind &&
				createO.CreateRoleBinding.SubjectName == createOperation.CreateRoleBinding.SubjectName &&
				createO.CreateRoleBinding.RoleKind == createOperation.CreateRoleBinding.RoleKind &&
				createO.CreateRoleBinding.RoleName == createOperation.CreateRoleBinding.RoleName
		}
		return false
	})
}
