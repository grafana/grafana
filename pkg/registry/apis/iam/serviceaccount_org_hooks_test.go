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

func TestAfterServiceAccountCreate(t *testing.T) {
	var wg sync.WaitGroup

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should create zanzana entry for service account with Admin role", func(t *testing.T) {
		wg.Add(1)
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test-admin",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleAdmin,
			},
		}

		testAdminRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateServiceAccountOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "sa-test-admin", updateOp.ServiceAccount)
			require.Equal(t, "Admin", updateOp.Role)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testAdminRole}
		b.AfterServiceAccountCreate(&sa, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entry for service account with Editor role", func(t *testing.T) {
		wg.Add(1)
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test-editor",
				Namespace: "org-2",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleEditor,
			},
		}

		testEditorRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateServiceAccountOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "sa-test-editor", updateOp.ServiceAccount)
			require.Equal(t, "Editor", updateOp.Role)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testEditorRole}
		b.AfterServiceAccountCreate(&sa, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entry for service account with Viewer role", func(t *testing.T) {
		wg.Add(1)
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test-viewer",
				Namespace: "org-3",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleViewer,
			},
		}

		testViewerRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			updateOp := op.GetUpdateServiceAccountOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "sa-test-viewer", updateOp.ServiceAccount)
			require.Equal(t, "Viewer", updateOp.Role)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testViewerRole}
		b.AfterServiceAccountCreate(&sa, nil)
		wg.Wait()
	})

	t.Run("should skip when service account has no role", func(t *testing.T) {
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-norole",
				Namespace: "org-4",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: "",
			},
		}

		b.zClient = nil
		b.AfterServiceAccountCreate(&sa, nil)
	})

	t.Run("should skip when service account has None role", func(t *testing.T) {
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-none",
				Namespace: "org-5",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleNone,
			},
		}

		b.zClient = nil
		b.AfterServiceAccountCreate(&sa, nil)
	})

	t.Run("should skip when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleAdmin,
			},
		}

		builder.AfterServiceAccountCreate(&sa, nil)
	})
}

func TestBeginServiceAccountUpdate(t *testing.T) {
	var wg sync.WaitGroup

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should update zanzana entry when role changes from Viewer to Admin", func(t *testing.T) {
		wg.Add(1)
		oldSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleViewer,
			},
		}

		newSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleAdmin,
			},
		}

		testRoleChange := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 2)

			updateOp := req.Operations[0].GetUpdateServiceAccountOrgRole()
			require.NotNil(t, updateOp)
			require.Equal(t, "sa-test", updateOp.ServiceAccount)
			require.Equal(t, "Admin", updateOp.Role)

			deleteOp := req.Operations[1].GetDeleteServiceAccountOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "sa-test", deleteOp.ServiceAccount)
			require.Equal(t, "Viewer", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testRoleChange}

		finishFunc, err := b.BeginServiceAccountUpdate(context.Background(), &newSA, &oldSA, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should only delete old role when new role is None", func(t *testing.T) {
		wg.Add(1)
		oldSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test2",
				Namespace: "org-2",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleEditor,
			},
		}

		newSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test2",
				Namespace: "org-2",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleNone,
			},
		}

		testRemoveRole := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.Len(t, req.Operations, 1)

			deleteOp := req.Operations[0].GetDeleteServiceAccountOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "sa-test2", deleteOp.ServiceAccount)
			require.Equal(t, "Editor", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testRemoveRole}

		finishFunc, err := b.BeginServiceAccountUpdate(context.Background(), &newSA, &oldSA, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), true)
		wg.Wait()
	})

	t.Run("should skip update when role hasn't changed", func(t *testing.T) {
		oldSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test3",
				Namespace: "org-3",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleEditor,
			},
		}

		newSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test3",
				Namespace: "org-3",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleEditor,
			},
		}

		finishFunc, err := b.BeginServiceAccountUpdate(context.Background(), &newSA, &oldSA, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc)
	})

	t.Run("should not call zanzana when update fails", func(t *testing.T) {
		oldSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test4",
				Namespace: "org-4",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleViewer,
			},
		}

		newSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test4",
				Namespace: "org-4",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleAdmin,
			},
		}

		callCount := 0
		testNoCall := func(ctx context.Context, req *v1.MutateRequest) error {
			callCount++
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testNoCall}

		finishFunc, err := b.BeginServiceAccountUpdate(context.Background(), &newSA, &oldSA, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		finishFunc(context.Background(), false)
		require.Equal(t, 0, callCount, "zanzana should not be called when update fails")
	})

	t.Run("should skip when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		oldSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleViewer,
			},
		}

		newSA := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleAdmin,
			},
		}

		finishFunc, err := builder.BeginServiceAccountUpdate(context.Background(), &newSA, &oldSA, nil)
		require.NoError(t, err)
		require.Nil(t, finishFunc)
	})
}

func TestAfterServiceAccountDelete(t *testing.T) {
	var wg sync.WaitGroup

	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should delete zanzana entry for service account with Admin role", func(t *testing.T) {
		wg.Add(1)
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test-admin",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleAdmin,
			},
		}

		testDeleteAdmin := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			deleteOp := op.GetDeleteServiceAccountOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "sa-test-admin", deleteOp.ServiceAccount)
			require.Equal(t, "Admin", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDeleteAdmin}
		b.AfterServiceAccountDelete(&sa, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entry for service account with Editor role", func(t *testing.T) {
		wg.Add(1)
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test-editor",
				Namespace: "org-2",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleEditor,
			},
		}

		testDeleteEditor := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			deleteOp := op.GetDeleteServiceAccountOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "sa-test-editor", deleteOp.ServiceAccount)
			require.Equal(t, "Editor", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDeleteEditor}
		b.AfterServiceAccountDelete(&sa, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entry for service account with Viewer role", func(t *testing.T) {
		wg.Add(1)
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test-viewer",
				Namespace: "org-3",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleViewer,
			},
		}

		testDeleteViewer := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-3", req.Namespace)
			require.Len(t, req.Operations, 1)

			op := req.Operations[0]
			require.NotNil(t, op)
			deleteOp := op.GetDeleteServiceAccountOrgRole()
			require.NotNil(t, deleteOp)
			require.Equal(t, "sa-test-viewer", deleteOp.ServiceAccount)
			require.Equal(t, "Viewer", deleteOp.Role)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDeleteViewer}
		b.AfterServiceAccountDelete(&sa, nil)
		wg.Wait()
	})

	t.Run("should skip when service account has no role", func(t *testing.T) {
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-norole",
				Namespace: "org-4",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: "",
			},
		}

		b.zClient = nil
		b.AfterServiceAccountDelete(&sa, nil)
	})

	t.Run("should skip when service account has None role", func(t *testing.T) {
		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-none",
				Namespace: "org-5",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleNone,
			},
		}

		b.zClient = nil
		b.AfterServiceAccountDelete(&sa, nil)
	})

	t.Run("should skip when zClient is nil", func(t *testing.T) {
		builder := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  nil,
		}

		sa := iamv0.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sa-test",
				Namespace: "org-1",
			},
			Spec: iamv0.ServiceAccountSpec{
				Role: iamv0.ServiceAccountOrgRoleAdmin,
			},
		}

		builder.AfterServiceAccountDelete(&sa, nil)
	})
}
