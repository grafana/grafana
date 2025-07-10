package folderimpl

import (
	"context"
	"net/http"
	"testing"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
)

func TestComputeFullPath(t *testing.T) {
	testCases := []struct {
		name         string
		parents      []*folder.Folder
		wantPath     string
		wantPathUIDs string
	}{
		{
			name:         "empty slice should return empty paths",
			parents:      []*folder.Folder{},
			wantPath:     "",
			wantPathUIDs: "",
		},
		{
			name: "single element should return single path",
			parents: []*folder.Folder{
				{
					Title: "Element",
					UID:   "Element-uid",
				},
			},
			wantPath:     "Element",
			wantPathUIDs: "Element-uid",
		},
		{
			name: "multiple parents should return hierarchical path",
			parents: []*folder.Folder{
				{
					Title: "Grandparent",
					UID:   "grandparent-uid",
				},
				{
					Title: "Parent",
					UID:   "parent-uid",
				},
				{
					Title: "Element",
					UID:   "Element-uid",
				},
			},
			wantPath:     "Grandparent/Parent/Element",
			wantPathUIDs: "grandparent-uid/parent-uid/Element-uid",
		},
		{
			name: "should handle special characters in titles",
			parents: []*folder.Folder{
				{
					Title: "Parent/With/Slashes",
					UID:   "parent-uid",
				},
				{
					Title: "Element With Spaces",
					UID:   "Element-uid",
				},
			},
			wantPath:     "Parent/With/Slashes/Element With Spaces",
			wantPathUIDs: "parent-uid/Element-uid",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			gotPath, gotPathUIDs := computeFullPath(tc.parents)
			require.Equal(t, tc.wantPath, gotPath)
			require.Equal(t, tc.wantPathUIDs, gotPathUIDs)
		})
	}
}

func TestGetParents(t *testing.T) {
	mockCli := new(client.MockK8sHandler)
	tracer := noop.NewTracerProvider().Tracer("TestGetParents")
	store := FolderUnifiedStoreImpl{
		k8sclient:   mockCli,
		userService: usertest.NewUserServiceFake(),
		tracer:      tracer,
	}

	ctx := context.Background()
	orgID := int64(1)

	t.Run("should return list of parent folders of a given folder uid", func(t *testing.T) {
		mockCli.On("Get", mock.Anything, "parentone", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":        "parentone",
					"annotations": map[string]interface{}{"grafana.app/folder": "parenttwo"},
				},
			},
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "parenttwo", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":        "parenttwo",
					"annotations": map[string]interface{}{"grafana.app/folder": "parentthree"},
				},
			},
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "parentthree", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":        "parentthree",
					"annotations": map[string]interface{}{"grafana.app/folder": "parentfour"},
				},
			},
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "parentfour", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "parentfour",
				},
			},
		}, nil).Once()
		result, err := store.GetParents(ctx, folder.GetParentsQuery{
			UID:   "parentone",
			OrgID: orgID,
		})

		require.NoError(t, err)
		require.Len(t, result, 3)
		require.Equal(t, "parentfour", result[0].UID)
		require.Equal(t, "parentthree", result[1].UID)
		require.Equal(t, "parenttwo", result[2].UID)
	})

	t.Run("should stop if user doesnt have access to the parent folder", func(t *testing.T) {
		mockCli.On("Get", mock.Anything, "parentone", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":        "parentone",
					"annotations": map[string]interface{}{"grafana.app/folder": "parenttwo"},
				},
			},
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "parenttwo", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":        "parenttwo",
					"annotations": map[string]interface{}{"grafana.app/folder": "parentthree"},
				},
			},
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "parentthree", orgID, mock.Anything, mock.Anything).Return(nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{Code: http.StatusForbidden},
		}).Once()
		result, err := store.GetParents(ctx, folder.GetParentsQuery{
			UID:   "parentone",
			OrgID: orgID,
		})

		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Equal(t, "parenttwo", result[0].UID)
	})

	t.Run("should stop if parent folder is not found", func(t *testing.T) {
		mockCli.On("Get", mock.Anything, "parentone", orgID, mock.Anything, mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "folders.folder.grafana.app", Resource: "folder"}, "parentone")).Once()

		_, err := store.GetParents(ctx, folder.GetParentsQuery{
			UID:   "parentone",
			OrgID: orgID,
		})

		require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
	})
}

func TestGetChildren(t *testing.T) {
	mockCli := new(client.MockK8sHandler)
	tracer := noop.NewTracerProvider().Tracer("TestGetChildren")
	store := FolderUnifiedStoreImpl{
		k8sclient:   mockCli,
		userService: usertest.NewUserServiceFake(),
		tracer:      tracer,
	}

	ctx := context.Background()
	orgID := int64(2)

	t.Run("should be able to find children folders, and set defaults for pages", func(t *testing.T) {
		mockCli.On("Search", mock.Anything, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: string(selection.In),
						Values:   []string{"folder1"},
					},
				},
			},
			Limit:  folderSearchLimit, // should default to folderSearchLimit
			Offset: 0,                 // should be set as limit * (page - 1)
			Page:   1,                 // should be set to 1 by default
		}).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key:   &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
					{
						Key:   &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "folder1", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "folder1"},
			},
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "folder2", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "folder2"},
			},
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "folder3", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "folder3"},
			},
		}, nil).Once()

		// don't set page or limit - should be automatically added
		result, err := store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:   "folder1",
			OrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, result, 2)
		require.Equal(t, "folder2", result[0].UID)
		require.Equal(t, "folder3", result[1].UID)
	})

	t.Run("should return an error if the folder is not found", func(t *testing.T) {
		mockCli.On("Search", mock.Anything, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: string(selection.In),
						Values:   []string{"folder1"},
					},
				},
			},
			Limit:  folderSearchLimit, // should default to folderSearchLimit
			Offset: 0,                 // should be set as limit * (page - 1)
			Page:   1,                 // should be set to 1 by default
		}).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key:   &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
					{
						Key:   &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "folder1", orgID, mock.Anything, mock.Anything).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "folders.folder.grafana.app", Resource: "folder"}, "folder1")).Once()

		_, err := store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:   "folder1",
			OrgID: orgID,
		})
		require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
	})

	t.Run("pages should be able to be set, general folder should be turned to empty string, and folder uids should be passed in", func(t *testing.T) {
		mockCli.On("Search", mock.Anything, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: string(selection.In),
						Values:   []string{""}, // should be an empty string if general is passed in
					},
					{
						Key:      resource.SEARCH_FIELD_NAME,
						Operator: string(selection.In),
						Values:   []string{"folder2"},
					},
				},
			},
			Limit:  10,
			Offset: 20, // should be set as limit * (page - 1)
			Page:   3,
		}).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key:   &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "folder2", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "folder2"},
			},
		}, nil).Once()

		result, err := store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:        "general",
			OrgID:      orgID,
			Limit:      10,
			Page:       3,
			FolderUIDs: []string{"folder2"},
		})
		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Equal(t, "folder2", result[0].UID)
	})

	t.Run("k6 folder should only be returned to service accounts", func(t *testing.T) {
		mockCli.On("Search", mock.Anything, orgID, mock.Anything).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key:   &resourcepb.ResourceKey{Name: accesscontrol.K6FolderUID, Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
				},
			},
			TotalHits: 1,
		}, nil)
		mockCli.On("Get", mock.Anything, "folder", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "folder"},
			},
		}, nil)
		mockCli.On("Get", mock.Anything, accesscontrol.K6FolderUID, orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": accesscontrol.K6FolderUID},
			},
		}, nil)

		result, err := store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:   "folder",
			OrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, result, 0)

		result, err = store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:          "folder",
			OrgID:        orgID,
			SignedInUser: &identity.StaticRequester{Type: claims.TypeServiceAccount},
		})
		require.NoError(t, err)
		require.Len(t, result, 1)
	})

	t.Run("should not do get requests for the children if RefOnly is true", func(t *testing.T) {
		mockCli.On("Search", mock.Anything, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: string(selection.In),
						Values:   []string{"folder1"},
					},
				},
			},
			Limit:  folderSearchLimit, // should default to folderSearchLimit
			Offset: 0,                 // should be set as limit * (page - 1)
			Page:   1,                 // should be set to 1 by default
		}).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key:   &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
					{
						Key:   &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		// only get the parent folder in this request
		mockCli.On("Get", mock.Anything, "folder1", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "folder1"},
			},
		}, nil).Once()

		// don't set page or limit - should be automatically added
		result, err := store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:   "folder1",
			OrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, result, 2)
		require.Equal(t, "folder2", result[0].UID)
		require.Equal(t, "folder3", result[1].UID)
	})
}

func TestGetFolders(t *testing.T) {
	type args struct {
		ctx context.Context
		q   folder.GetFoldersFromStoreQuery
	}
	tests := []struct {
		name    string
		args    args
		mock    func(mockCli *client.MockK8sHandler)
		want    []*folder.Folder
		wantErr bool
	}{
		{
			name: "should return all folders from k8s",
			args: args{
				ctx: context.Background(),
				q: folder.GetFoldersFromStoreQuery{
					GetFoldersQuery: folder.GetFoldersQuery{
						OrgID: orgID,
					},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, orgID, metav1.ListOptions{
					Limit:    folderListLimit,
					TypeMeta: metav1.TypeMeta{},
				}).Return(&unstructured.UnstructuredList{
					Items: []unstructured.Unstructured{
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder1",
									"uid":  "folder1",
								},
								"spec": map[string]interface{}{
									"title": "folder1",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder2",
									"uid":  "folder2",
								},
								"spec": map[string]interface{}{
									"title": "folder2",
								},
							},
						},
					},
				}, nil).Once()
			},
			want: []*folder.Folder{
				{
					UID:   "folder1",
					Title: "folder1",
					OrgID: orgID,
				},
				{
					UID:   "folder2",
					Title: "folder2",
					OrgID: orgID,
				},
			},
			wantErr: false,
		},
		{
			name: "should return folders from k8s by uid",
			args: args{
				ctx: context.Background(),
				q: folder.GetFoldersFromStoreQuery{
					GetFoldersQuery: folder.GetFoldersQuery{
						OrgID: orgID,
						UIDs:  []string{"folder1", "folder2"},
					},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, orgID, metav1.ListOptions{
					Limit:    folderListLimit,
					TypeMeta: metav1.TypeMeta{},
				}).Return(&unstructured.UnstructuredList{
					Items: []unstructured.Unstructured{
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder1",
									"uid":  "folder1",
								},
								"spec": map[string]interface{}{
									"title": "folder1",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder2",
									"uid":  "folder2",
								},
								"spec": map[string]interface{}{
									"title": "folder2",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder3",
									"uid":  "folder3",
								},
								"spec": map[string]interface{}{
									"title": "folder3",
								},
							},
						},
					},
				}, nil).Once()
			},
			want: []*folder.Folder{
				{
					UID:   "folder1",
					Title: "folder1",
					OrgID: orgID,
				},
				{
					UID:   "folder2",
					Title: "folder2",
					OrgID: orgID,
				},
			},
			wantErr: false,
		},
		{
			name: "should return all folders from k8s with fullpath enabled",
			args: args{
				ctx: context.Background(),
				q: folder.GetFoldersFromStoreQuery{
					GetFoldersQuery: folder.GetFoldersQuery{
						OrgID:        orgID,
						WithFullpath: true,
					},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, orgID, metav1.ListOptions{
					Limit:         folderListLimit,
					TypeMeta:      metav1.TypeMeta{},
					LabelSelector: "grafana.app/fullpath=true",
				}).Return(&unstructured.UnstructuredList{
					Items: []unstructured.Unstructured{
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "root1",
									"uid":  "root1",
								},
								"spec": map[string]interface{}{
									"title": "root1",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "root2",
									"uid":  "root2",
								},
								"spec": map[string]interface{}{
									"title": "root2",
								},
							},
						},
					},
				}, nil).Once()
			},
			want: []*folder.Folder{
				{
					UID:          "root1",
					Title:        "root1",
					OrgID:        orgID,
					Fullpath:     "root1",
					FullpathUIDs: "root1",
				},
				{
					UID:          "root2",
					Title:        "root2",
					OrgID:        orgID,
					Fullpath:     "root2",
					FullpathUIDs: "root2",
				},
			},
			wantErr: false,
		},
		{
			name: "should return folders from k8s by uid with fullpath enabled",
			args: args{
				ctx: context.Background(),
				q: folder.GetFoldersFromStoreQuery{
					GetFoldersQuery: folder.GetFoldersQuery{
						OrgID:        orgID,
						UIDs:         []string{"folder1", "folder2"},
						WithFullpath: true,
					},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, orgID, metav1.ListOptions{
					Limit:         folderListLimit,
					TypeMeta:      metav1.TypeMeta{},
					LabelSelector: "grafana.app/fullpath=true",
				}).Return(&unstructured.UnstructuredList{
					Items: []unstructured.Unstructured{
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "parentcommon",
									"uid":  "parentcommon",
								},
								"spec": map[string]interface{}{
									"title": "parentcommon",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name":        "folder1",
									"uid":         "folder1",
									"annotations": map[string]interface{}{"grafana.app/folder": "parentcommon"},
								},
								"spec": map[string]interface{}{
									"title": "folder1",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name":        "folder2",
									"uid":         "folder2",
									"annotations": map[string]interface{}{"grafana.app/folder": "parentcommon"},
								},
								"spec": map[string]interface{}{
									"title": "folder2",
								},
							},
						},
					},
				}, nil).Once()
			},
			want: []*folder.Folder{
				{
					UID:          "folder1",
					Title:        "folder1",
					OrgID:        orgID,
					Fullpath:     "parentcommon/folder1",
					FullpathUIDs: "parentcommon/folder1",
				},
				{
					UID:          "folder2",
					Title:        "folder2",
					OrgID:        orgID,
					Fullpath:     "parentcommon/folder2",
					FullpathUIDs: "parentcommon/folder2",
				},
			},
			wantErr: false,
		},
		{
			name: "should return error if k8s returns error",
			args: args{
				ctx: context.Background(),
				q: folder.GetFoldersFromStoreQuery{
					GetFoldersQuery: folder.GetFoldersQuery{
						OrgID: orgID,
						UIDs:  []string{"folder1", "folder2"},
					},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, orgID, metav1.ListOptions{
					Limit:    folderListLimit,
					TypeMeta: metav1.TypeMeta{},
				}).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "folders.folder.grafana.app", Resource: "folder"}, "folder1")).Once()
			},
			want:    nil,
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockCLI := new(client.MockK8sHandler)
			tt.mock(mockCLI)
			tracer := noop.NewTracerProvider().Tracer("TestGetFolders")
			ss := &FolderUnifiedStoreImpl{
				k8sclient:   mockCLI,
				userService: usertest.NewUserServiceFake(),
				tracer:      tracer,
			}
			got, err := ss.GetFolders(tt.args.ctx, tt.args.q)
			require.Equal(t, tt.wantErr, err != nil, "GetFolders() error = %v, wantErr %v", err, tt.wantErr)
			if !tt.wantErr {
				require.Len(t, got, len(tt.want), "GetFolders() = %v, want %v", got, tt.want)
				for i, folder := range got {
					require.Equal(t, tt.want[i].UID, folder.UID, "GetFolders() = %v, want %v", got, tt.want)
					require.Equal(t, tt.want[i].OrgID, folder.OrgID, "GetFolders() = %v, want %v", got, tt.want)
					require.Equal(t, tt.want[i].Fullpath, folder.Fullpath, "GetFolders() = %v, want %v", got, tt.want)
					require.Equal(t, tt.want[i].FullpathUIDs, folder.FullpathUIDs, "GetFolders() = %v, want %v", got, tt.want)
				}
			}
		})
	}
}

func TestBuildFolderFullPaths(t *testing.T) {
	type args struct {
		f         *folder.Folder
		relations map[string]string
		folderMap map[string]*folder.Folder
	}
	tests := []struct {
		name string
		args args
		want *folder.Folder
	}{
		{
			name: "should build full path for a folder with no parents",
			args: args{
				f: &folder.Folder{
					Title: "Root",
					UID:   "root-uid",
				},
				relations: map[string]string{},
				folderMap: map[string]*folder.Folder{},
			},
			want: &folder.Folder{
				Title:        "Root",
				UID:          "root-uid",
				Fullpath:     "Root",
				FullpathUIDs: "root-uid",
			},
		},
		{
			name: "should build full path for a folder with one parent",
			args: args{
				f: &folder.Folder{
					Title:     "Child",
					UID:       "child-uid",
					ParentUID: "parent-uid",
				},
				relations: map[string]string{
					"child-uid": "parent-uid",
				},
				folderMap: map[string]*folder.Folder{
					"parent-uid": {
						Title: "Parent",
						UID:   "parent-uid",
					},
				},
			},
			want: &folder.Folder{
				Title:        "Child",
				UID:          "child-uid",
				ParentUID:    "parent-uid",
				Fullpath:     "Parent/Child",
				FullpathUIDs: "parent-uid/child-uid",
			},
		},
		{
			name: "should build full path for a folder with multiple parents",
			args: args{
				f: &folder.Folder{
					Title:     "Child",
					UID:       "child-uid",
					ParentUID: "parent-uid",
				},
				relations: map[string]string{
					"child-uid":       "parent-uid",
					"parent-uid":      "grandparent-uid",
					"grandparent-uid": "",
				},
				folderMap: map[string]*folder.Folder{
					"child-uid": {
						Title:     "Child",
						UID:       "child-uid",
						ParentUID: "parent-uid",
					},
					"parent-uid": {
						Title:     "Parent",
						UID:       "parent-uid",
						ParentUID: "grandparent-uid",
					},
					"grandparent-uid": {
						Title: "Grandparent",
						UID:   "grandparent-uid",
					},
				},
			},
			want: &folder.Folder{
				Title:        "Child",
				UID:          "child-uid",
				ParentUID:    "parent-uid",
				Fullpath:     "Grandparent/Parent/Child",
				FullpathUIDs: "grandparent-uid/parent-uid/child-uid",
			},
		},
		{
			name: "should build full path for a folder with no parents in the map",
			args: args{
				f: &folder.Folder{
					Title:     "Child",
					UID:       "child-uid",
					ParentUID: "parent-uid",
				},
				relations: map[string]string{
					"child-uid": "parent-uid",
				},
				folderMap: map[string]*folder.Folder{},
			},
			want: &folder.Folder{
				Title:        "Child",
				UID:          "child-uid",
				ParentUID:    "parent-uid",
				Fullpath:     "Child",
				FullpathUIDs: "child-uid",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buildFolderFullPaths(tt.args.f, tt.args.relations, tt.args.folderMap)
			require.Equal(t, tt.want.Fullpath, tt.args.f.Fullpath, "BuildFolderFullPaths() = %v, want %v", tt.args.f.Fullpath, tt.want.Fullpath)
			require.Equal(t, tt.want.FullpathUIDs, tt.args.f.FullpathUIDs, "BuildFolderFullPaths() = %v, want %v", tt.args.f.FullpathUIDs, tt.want.FullpathUIDs)
			require.Equal(t, tt.want.Title, tt.args.f.Title, "BuildFolderFullPaths() = %v, want %v", tt.args.f.Title, tt.want.Title)
			require.Equal(t, tt.want.UID, tt.args.f.UID, "BuildFolderFullPaths() = %v, want %v", tt.args.f.UID, tt.want.UID)
			require.Equal(t, tt.want.ParentUID, tt.args.f.ParentUID, "BuildFolderFullPaths() = %v, want %v", tt.args.f.ParentUID, tt.want.ParentUID)
		})
	}
}

func TestList(t *testing.T) {
	type args struct {
		ctx   context.Context
		orgID int64
		opts  metav1.ListOptions
	}
	tests := []struct {
		name    string
		args    args
		mock    func(mockCli *client.MockK8sHandler)
		want    *unstructured.UnstructuredList
		wantErr bool
	}{
		{
			name: "should return all folders",
			args: args{
				ctx:   context.Background(),
				orgID: orgID,
				opts: metav1.ListOptions{
					Limit:    0,
					TypeMeta: metav1.TypeMeta{},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, int64(1), metav1.ListOptions{
					Limit:    folderListLimit,
					TypeMeta: metav1.TypeMeta{},
				}).Return(&unstructured.UnstructuredList{
					Items: []unstructured.Unstructured{
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder1",
									"uid":  "folder1",
								},
								"spec": map[string]interface{}{
									"title": "folder1",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder2",
									"uid":  "folder2",
								},
								"spec": map[string]interface{}{
									"title": "folder2",
								},
							},
						},
					},
				}, nil).Once()
			},
			want: &unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					{
						Object: map[string]interface{}{
							"metadata": map[string]interface{}{
								"name": "folder1",
								"uid":  "folder1",
							},
							"spec": map[string]interface{}{
								"title": "folder1",
							},
						},
					},
					{
						Object: map[string]interface{}{
							"metadata": map[string]interface{}{
								"name": "folder2",
								"uid":  "folder2",
							},
							"spec": map[string]interface{}{
								"title": "folder2",
							},
						},
					},
				},
			},
		},
		{
			name: "should return folders with limit",
			args: args{
				ctx:   context.Background(),
				orgID: orgID,
				opts: metav1.ListOptions{
					Limit:    1,
					TypeMeta: metav1.TypeMeta{},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, int64(1), metav1.ListOptions{
					Limit:    1,
					TypeMeta: metav1.TypeMeta{},
				}).Return(&unstructured.UnstructuredList{
					Items: []unstructured.Unstructured{
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder1",
									"uid":  "folder1",
								},
								"spec": map[string]interface{}{
									"title": "folder1",
								},
							},
						},
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder2",
									"uid":  "folder2",
								},
								"spec": map[string]interface{}{
									"title": "folder2",
								},
							},
						},
					},
				}, nil).Once()
			},
			want: &unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					{
						Object: map[string]interface{}{
							"metadata": map[string]interface{}{
								"name": "folder1",
								"uid":  "folder1",
							},
							"spec": map[string]interface{}{
								"title": "folder1",
							},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "should return folders with continue token",
			args: args{
				ctx:   context.Background(),
				orgID: orgID,
				opts: metav1.ListOptions{
					Limit:    1,
					TypeMeta: metav1.TypeMeta{},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, int64(1), metav1.ListOptions{
					Limit:    1,
					TypeMeta: metav1.TypeMeta{},
				}).Return(&unstructured.UnstructuredList{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"continue": "continue-token",
						},
					},
					Items: []unstructured.Unstructured{
						{
							Object: map[string]interface{}{
								"metadata": map[string]interface{}{
									"name": "folder1",
									"uid":  "folder1",
								},
								"spec": map[string]interface{}{
									"title": "folder1",
								},
							},
						},
					},
				}, nil).Once()
			},
			want: &unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					{
						Object: map[string]interface{}{
							"metadata": map[string]interface{}{
								"name": "folder1",
								"uid":  "folder1",
							},
							"spec": map[string]interface{}{
								"title": "folder1",
							},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "should return error if k8s returns error",
			args: args{
				ctx:   context.Background(),
				orgID: orgID,
				opts: metav1.ListOptions{
					Limit:    0,
					TypeMeta: metav1.TypeMeta{},
				},
			},
			mock: func(mockCli *client.MockK8sHandler) {
				mockCli.On("List", mock.Anything, int64(1), metav1.ListOptions{
					Limit:    folderListLimit,
					TypeMeta: metav1.TypeMeta{},
				}).Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "folders.folder.grafana.app", Resource: "folder"}, "folder1")).Once()
			},
			want:    nil,
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockCLI := new(client.MockK8sHandler)
			tt.mock(mockCLI)
			tracer := noop.NewTracerProvider().Tracer("TestList")
			ss := &FolderUnifiedStoreImpl{
				k8sclient:   mockCLI,
				userService: usertest.NewUserServiceFake(),
				tracer:      tracer,
			}
			got, err := ss.list(tt.args.ctx, tt.args.orgID, tt.args.opts)
			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}
