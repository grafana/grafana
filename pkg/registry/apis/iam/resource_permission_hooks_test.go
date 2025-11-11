package iam

import (
	"context"
	"sync"
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
	writeCallback  func(context.Context, *v1.WriteRequest) error
	readCallback   func(context.Context, *v1.ReadRequest) (*v1.ReadResponse, error)
	mutateCallback func(context.Context, *v1.MutateRequest) error
}

// Read implements zanzana.Client.
func (f *FakeZanzanaClient) Read(ctx context.Context, req *v1.ReadRequest) (*v1.ReadResponse, error) {
	if f.readCallback != nil {
		return f.readCallback(ctx, req)
	}
	return &v1.ReadResponse{}, nil
}

// Write implements zanzana.Client.
func (f *FakeZanzanaClient) Write(ctx context.Context, req *v1.WriteRequest) error {
	return f.writeCallback(ctx, req)
}

// Mutate implements zanzana.Client.
func (f *FakeZanzanaClient) Mutate(ctx context.Context, req *v1.MutateRequest) error {
	if f.mutateCallback != nil {
		return f.mutateCallback(ctx, req)
	}
	return nil
}

func requireTuplesMatch(t *testing.T, actual []*v1.TupleKey, expected []*v1.TupleKey, msgAndArgs ...interface{}) {
	t.Helper()
	for _, exp := range expected {
		found := false
		for _, act := range actual {
			if act.User == exp.User &&
				act.Relation == exp.Relation &&
				act.Object == exp.Object {
				found = true
				break
			}
		}
		if !found {
			require.Fail(t, "Expected tuple not found", "Tuple: %+v\n%v", exp, msgAndArgs)
		}
	}
}

func requireDeleteTuplesMatch(t *testing.T, actual []*v1.TupleKeyWithoutCondition, expected []*v1.TupleKeyWithoutCondition, msgAndArgs ...interface{}) {
	t.Helper()
	for _, exp := range expected {
		found := false
		for _, act := range actual {
			if act.User == exp.User &&
				act.Relation == exp.Relation &&
				act.Object == exp.Object {
				found = true
				break
			}
		}
		if !found {
			require.Fail(t, "Expected delete tuple not found", "Tuple: %+v\n%v", exp, msgAndArgs)
		}
	}
}

func TestAfterResourcePermissionCreate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should create zanzana entries for folder resource permissions", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "org-2", req.Namespace)

			expectedTuples := []*v1.TupleKey{
				{User: "user:u1", Relation: "view", Object: "folder:fold1"},
				{User: "role:basic_editor#assignee", Relation: "edit", Object: "folder:fold1"},
			}

			requireTuplesMatch(t, req.Writes.TupleKeys, expectedTuples)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testFolderEntries}
		b.AfterResourcePermissionCreate(&folderPerm, nil)
		wg.Wait()
	})

	t.Run("should create zanzana entries for dashboard resource permissions", func(t *testing.T) {
		wg.Add(1)
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
			defer wg.Done()
			object := "resource:dashboard.grafana.app/dashboards/dash1"

			require.NotNil(t, req)
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)
			require.Equal(t, "default", req.Namespace)

			// Verify all tuples have the group_filter condition
			for _, tuple := range req.Writes.TupleKeys {
				require.NotNil(t, tuple.Condition, "Condition should not be nil for tuple %+v", tuple)
				require.Equal(t, "group_filter", tuple.Condition.Name)
			}

			expectedTuples := []*v1.TupleKey{
				{User: "service-account:sa1", Relation: "view", Object: object},
				{User: "team:team1#member", Relation: "edit", Object: object},
			}

			requireTuplesMatch(t, req.Writes.TupleKeys, expectedTuples)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashEntries}
		b.AfterResourcePermissionCreate(&dashPerm, nil)
	})
	wg.Wait()
}

func TestBeginResourcePermissionUpdate(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should update zanzana entries for folder resource permissions", func(t *testing.T) {
		wg.Add(1)
		oldFolderPerm := iamv0.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-2",
			},
			Spec: iamv0.ResourcePermissionSpec{
				Resource: iamv0.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app", Resource: "folders", Name: "fold1",
				},
				Permissions: []iamv0.ResourcePermissionspecPermission{
					{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "u1", Verb: "View"},
				},
			},
		}

		newFolderPerm := iamv0.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-2",
			},
			Spec: iamv0.ResourcePermissionSpec{
				Resource: iamv0.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app", Resource: "folders", Name: "fold1",
				},
				Permissions: []iamv0.ResourcePermissionspecPermission{
					{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "u2", Verb: "Edit"},
					{Kind: iamv0.ResourcePermissionSpecPermissionKindTeam, Name: "team1", Verb: "View"},
				},
			},
		}

		testFolderWrite := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should delete old permission
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:u1", Relation: "view", Object: "folder:fold1"},
			)

			// Should write new permissions
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 2)

			expectedWrites := []*v1.TupleKey{
				{User: "user:u2", Relation: "edit", Object: "folder:fold1"},
				{User: "team:team1#member", Relation: "view", Object: "folder:fold1"},
			}
			requireTuplesMatch(t, req.Writes.TupleKeys, expectedWrites)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testFolderWrite}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginResourcePermissionUpdate(context.Background(), &newFolderPerm, &oldFolderPerm, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
	})

	wg.Wait()
	t.Run("should update zanzana entries for dashboard resource permissions", func(t *testing.T) {
		wg.Add(1)
		oldDashPerm := iamv0.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: iamv0.ResourcePermissionSpec{
				Resource: iamv0.ResourcePermissionspecResource{
					ApiGroup: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
				},
				Permissions: []iamv0.ResourcePermissionspecPermission{
					{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "u1", Verb: "View"},
				},
			},
		}

		newDashPerm := iamv0.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: iamv0.ResourcePermissionSpec{
				Resource: iamv0.ResourcePermissionspecResource{
					ApiGroup: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
				},
				Permissions: []iamv0.ResourcePermissionspecPermission{
					{Kind: iamv0.ResourcePermissionSpecPermissionKindServiceAccount, Name: "sa1", Verb: "Edit"},
				},
			},
		}

		object := "resource:dashboard.grafana.app/dashboards/dash1"

		testDashWrite := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "default", req.Namespace)

			// Should delete old permission
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 1)
			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:u1", Relation: "view", Object: object},
			)

			// Should write new permission
			require.NotNil(t, req.Writes)
			require.Len(t, req.Writes.TupleKeys, 1)

			tuple := req.Writes.TupleKeys[0]
			require.NotNil(t, tuple.Condition)
			require.Equal(t, "group_filter", tuple.Condition.Name)
			tuple.Condition = nil
			require.Equal(
				t,
				tuple,
				&v1.TupleKey{User: "service-account:sa1", Relation: "edit", Object: object},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashWrite}

		// Call BeginUpdate which does all the work
		finishFunc, err := b.BeginResourcePermissionUpdate(context.Background(), &newDashPerm, &oldDashPerm, nil)
		require.NoError(t, err)
		require.NotNil(t, finishFunc)

		// Call the finish function with success=true to trigger the zanzana write
		finishFunc(context.Background(), true)
		wg.Wait()
	})
}

func TestAfterResourcePermissionDelete(t *testing.T) {
	var wg sync.WaitGroup
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}
	t.Run("should delete zanzana entries for folder resource permissions", func(t *testing.T) {
		wg.Add(1)
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

		testFolderDelete := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)
			require.Nil(t, req.Writes)

			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "user:u1", Relation: "view", Object: "folder:fold1"},
			)
			require.Equal(
				t,
				req.Deletes.TupleKeys[1],
				&v1.TupleKeyWithoutCondition{User: "role:basic_editor#assignee", Relation: "edit", Object: "folder:fold1"},
			)
			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testFolderDelete}
		b.AfterResourcePermissionDelete(&folderPerm, nil)
		wg.Wait()
	})

	t.Run("should delete zanzana entries for dashboard resource permissions", func(t *testing.T) {
		wg.Add(1)
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

		testDashDelete := func(ctx context.Context, req *v1.WriteRequest) error {
			defer wg.Done()
			object := "resource:dashboard.grafana.app/dashboards/dash1"

			require.NotNil(t, req)
			require.Equal(t, "default", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Deletes)
			require.Len(t, req.Deletes.TupleKeys, 2)
			require.Nil(t, req.Writes)

			require.Equal(
				t,
				req.Deletes.TupleKeys[0],
				&v1.TupleKeyWithoutCondition{User: "service-account:sa1", Relation: "view", Object: object},
			)
			require.Equal(
				t,
				req.Deletes.TupleKeys[1],
				&v1.TupleKeyWithoutCondition{User: "team:team1#member", Relation: "edit", Object: object},
			)

			return nil
		}

		b.zClient = &FakeZanzanaClient{writeCallback: testDashDelete}
		b.AfterResourcePermissionDelete(&dashPerm, nil)
		wg.Wait()
	})
}
