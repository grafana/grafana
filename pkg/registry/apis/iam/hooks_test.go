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
	readCallback  func(context.Context, *v1.ReadRequest) (*v1.ReadResponse, error)
}

// Write implements zanzana.Client.
func (f *FakeZanzanaClient) Write(ctx context.Context, req *v1.WriteRequest) error {
	return f.writeCallback(ctx, req)
}

// Read implements zanzana.Client.
func (f *FakeZanzanaClient) Read(ctx context.Context, req *v1.ReadRequest) (*v1.ReadResponse, error) {
	if f.readCallback != nil {
		return f.readCallback(ctx, req)
	}
	return &v1.ReadResponse{}, nil
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

func TestAfterResourcePermissionUpdate(t *testing.T) {
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should update zanzana entries for folder resource permissions", func(t *testing.T) {
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

		// Mock the Read response to return existing tuples
		testFolderRead := func(ctx context.Context, req *v1.ReadRequest) (*v1.ReadResponse, error) {
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)
			require.Equal(t, "folder:fold1", req.TupleKey.Object)

			// Return the old tuple that should be deleted
			return &v1.ReadResponse{
				Tuples: []*v1.Tuple{
					{
						Key: &v1.TupleKey{User: "user:u1", Relation: "view", Object: "folder:fold1"},
					},
				},
			}, nil
		}

		testFolderWrite := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should delete old permission (from Read)
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
			require.Equal(
				t,
				req.Writes.TupleKeys[0],
				&v1.TupleKey{User: "user:u2", Relation: "edit", Object: "folder:fold1"},
			)
			require.Equal(
				t,
				req.Writes.TupleKeys[1],
				&v1.TupleKey{User: "team:team1#member", Relation: "view", Object: "folder:fold1"},
			)
			return nil
		}

		b.zClient = &FakeZanzanaClient{
			readCallback:  testFolderRead,
			writeCallback: testFolderWrite,
		}
		b.AfterResourcePermissionUpdate(&newFolderPerm, nil)
	})

	// Wait for the ticket to be released
	<-b.zTickets

	t.Run("should update zanzana entries for dashboard resource permissions", func(t *testing.T) {
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

		// Mock the Read response to return existing tuples with conditions
		testDashRead := func(ctx context.Context, req *v1.ReadRequest) (*v1.ReadResponse, error) {
			require.NotNil(t, req)
			require.Equal(t, "default", req.Namespace)
			require.Equal(t, object, req.TupleKey.Object)

			// Return the old tuple that should be deleted
			return &v1.ReadResponse{
				Tuples: []*v1.Tuple{
					{
						Key: &v1.TupleKey{User: "user:u1", Relation: "view", Object: object},
					},
				},
			}, nil
		}

		testDashWrite := func(ctx context.Context, req *v1.WriteRequest) error {
			require.NotNil(t, req)
			require.Equal(t, "default", req.Namespace)

			// Should delete old permission (from Read)
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

		b.zClient = &FakeZanzanaClient{
			readCallback:  testDashRead,
			writeCallback: testDashWrite,
		}
		b.AfterResourcePermissionUpdate(&newDashPerm, nil)
	})
}

func TestAfterResourcePermissionDelete(t *testing.T) {
	b := &IdentityAccessManagementAPIBuilder{
		logger:   log.NewNopLogger(),
		zTickets: make(chan bool, 1),
	}

	t.Run("should delete zanzana entries for folder resource permissions", func(t *testing.T) {
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
	})

	// Wait for the ticket to be released
	<-b.zTickets

	t.Run("should delete zanzana entries for dashboard resource permissions", func(t *testing.T) {
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
	})
}
