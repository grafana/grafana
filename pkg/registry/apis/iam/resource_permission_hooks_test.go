package iam

import (
	"context"
	"sync"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
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

		testFolderEntries := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)
			require.Equal(t, "org-2", req.Namespace)

			expectedOperations := []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group: "folder.grafana.app", Resource: "folders", Name: "fold1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "u1",
								Verb: "View",
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group: "folder.grafana.app", Resource: "folders", Name: "fold1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindBasicRole),
								Name: "Editor",
								Verb: "Edit",
							},
						},
					},
				},
			}
			require.ElementsMatch(t, expectedOperations, req.Operations)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testFolderEntries}
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

		testDashEntries := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			// object := "resource:dashboard.grafana.app/dashboards/dash1"

			require.NotNil(t, req)
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)
			require.Equal(t, "default", req.Namespace)

			expectedOperations := []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindServiceAccount),
								Name: "sa1",
								Verb: "View",
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindTeam),
								Name: "team1",
								Verb: "Edit",
							},
						},
					},
				},
			}
			require.ElementsMatch(t, expectedOperations, req.Operations)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDashEntries}
		b.AfterResourcePermissionCreate(&dashPerm, nil)
		wg.Wait()
	})
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

		testFolderWrite := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should delete old permission
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 3)
			require.Equal(t, "org-2", req.Namespace)

			expectedOperations := []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group: "folder.grafana.app", Resource: "folders", Name: "fold1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "u1",
								Verb: "View",
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group: "folder.grafana.app", Resource: "folders", Name: "fold1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindTeam),
								Name: "team1",
								Verb: "View",
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group: "folder.grafana.app", Resource: "folders", Name: "fold1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "u2",
								Verb: "Edit",
							},
						},
					},
				},
			}

			require.ElementsMatch(t, expectedOperations, req.Operations)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testFolderWrite}

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

		testDashWrite := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "default", req.Namespace)

			// Should delete old permission
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)

			expectedOperations := []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "u1",
								Verb: "View",
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_CreatePermission{
						CreatePermission: &v1.CreatePermissionOperation{
							Resource: &v1.Resource{
								Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindServiceAccount),
								Name: "sa1",
								Verb: "Edit",
							},
						},
					},
				},
			}

			require.ElementsMatch(t, expectedOperations, req.Operations)

			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDashWrite}

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

		testFolderDelete := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.NotNil(t, req)
			require.Equal(t, "org-2", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)

			expectedOperations := []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group: "folder.grafana.app", Resource: "folders", Name: "fold1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindUser),
								Name: "u1",
								Verb: "View",
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group: "folder.grafana.app", Resource: "folders", Name: "fold1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindBasicRole),
								Name: "Editor",
								Verb: "Edit",
							},
						},
					},
				},
			}
			require.ElementsMatch(t, expectedOperations, req.Operations)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testFolderDelete}
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

		testDashDelete := func(ctx context.Context, req *v1.MutateRequest) error {
			defer wg.Done()

			require.NotNil(t, req)
			require.Equal(t, "default", req.Namespace)

			// Should have deletes but no writes
			require.NotNil(t, req.Operations)
			require.Len(t, req.Operations, 2)

			expectedOperations := []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindServiceAccount),
								Name: "sa1",
								Verb: "View",
							},
						},
					},
				},
				{
					Operation: &v1.MutateOperation_DeletePermission{
						DeletePermission: &v1.DeletePermissionOperation{
							Resource: &v1.Resource{
								Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash1",
							},
							Permission: &v1.Permission{
								Kind: string(iamv0.ResourcePermissionSpecPermissionKindTeam),
								Name: "team1",
								Verb: "Edit",
							},
						},
					},
				},
			}
			require.ElementsMatch(t, expectedOperations, req.Operations)
			return nil
		}

		b.zClient = &FakeZanzanaClient{mutateCallback: testDashDelete}
		b.AfterResourcePermissionDelete(&dashPerm, nil)
		wg.Wait()
	})
}
