package folderimpl

import (
	"context"
	"net/http"
	"slices"
	"testing"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
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
					{
						Key:      resource.SEARCH_FIELD_NAME,
						Operator: string(selection.NotIn),
						Values:   []string{accesscontrol.K6FolderUID},
					},
				},
			},
			Limit:  searchPageSize, // pagination is in pages of searchPageSize
			Offset: 0,              // q.Limit * (q.Page - 1) with defaulted Page=1
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
					{
						Key:      resource.SEARCH_FIELD_NAME,
						Operator: string(selection.NotIn),
						Values:   []string{accesscontrol.K6FolderUID},
					},
				},
			},
			Limit:  searchPageSize, // pagination is in pages of searchPageSize
			Offset: 0,              // q.Limit * (q.Page - 1) with defaulted Page=1
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
					{
						Key:      resource.SEARCH_FIELD_NAME,
						Operator: string(selection.NotIn),
						Values:   []string{accesscontrol.K6FolderUID},
					},
				},
			},
			Limit:  10, // user-supplied; under searchPageSize so a single page is fetched
			Offset: 20, // user-supplied q.Limit * (q.Page - 1) = 10 * (3 - 1)
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

	t.Run("k6 folder should be excluded via NotIn filter for non-service accounts", func(t *testing.T) {
		// For non-service-account users, the search request should include a NotIn filter for k6-app
		hasK6NotInFilter := func(req *resourcepb.ResourceSearchRequest) bool {
			for _, f := range req.Options.Fields {
				if f.Key == resource.SEARCH_FIELD_NAME &&
					f.Operator == string(selection.NotIn) &&
					len(f.Values) == 1 && f.Values[0] == accesscontrol.K6FolderUID {
					return true
				}
			}
			return false
		}

		mockCli.On("Search", mock.Anything, orgID, mock.MatchedBy(hasK6NotInFilter)).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
			TotalHits: 0,
		}, nil).Once()
		mockCli.On("Get", mock.Anything, "folder", orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "folder"},
			},
		}, nil)

		result, err := store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:   "folder",
			OrgID: orgID,
		})
		require.NoError(t, err)
		require.Len(t, result, 0)
	})

	t.Run("k6 folder should be returned for service accounts (no NotIn filter)", func(t *testing.T) {
		// For service accounts, the search request should NOT include a NotIn filter for k6-app
		hasNoK6NotInFilter := func(req *resourcepb.ResourceSearchRequest) bool {
			for _, f := range req.Options.Fields {
				if f.Key == resource.SEARCH_FIELD_NAME &&
					f.Operator == string(selection.NotIn) {
					return false
				}
			}
			return true
		}

		mockCli.On("Search", mock.Anything, orgID, mock.MatchedBy(hasNoK6NotInFilter)).Return(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key:   &resourcepb.ResourceKey{Name: accesscontrol.K6FolderUID, Resource: "folder"},
						Cells: [][]byte{[]byte("folder")},
					},
				},
			},
			TotalHits: 1,
		}, nil).Once()
		mockCli.On("Get", mock.Anything, accesscontrol.K6FolderUID, orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": accesscontrol.K6FolderUID},
			},
		}, nil)

		result, err := store.GetChildren(ctx, folder.GetChildrenQuery{
			UID:          "folder",
			OrgID:        orgID,
			SignedInUser: &identity.StaticRequester{Type: claims.TypeServiceAccount},
		})
		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Equal(t, accesscontrol.K6FolderUID, result[0].UID)
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
					{
						Key:      resource.SEARCH_FIELD_NAME,
						Operator: string(selection.NotIn),
						Values:   []string{accesscontrol.K6FolderUID},
					},
				},
			},
			Limit:  searchPageSize, // pagination is in pages of searchPageSize
			Offset: 0,              // q.Limit * (q.Page - 1) with defaulted Page=1
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

// expectSearchChildren sets up a Search mock that matches a multi-value `In`
// on the given parents and returns rows for each parent's children. The row
// Key.Name is the child UID and the first cell is the parent UID (matches
// the column definition the implementation does not actually inspect, but
// mirrors the existing TestGetChildren mock shape).
func expectSearchChildren(mockCli *client.MockK8sHandler, orgID int64, parents []string, byParent map[string][]string) {
	matcher := func(req *resourcepb.ResourceSearchRequest) bool {
		if req == nil || req.Options == nil || len(req.Options.Fields) == 0 {
			return false
		}
		f := req.Options.Fields[0]
		return f.Key == resource.SEARCH_FIELD_FOLDER &&
			f.Operator == string(selection.In) &&
			slices.Equal(f.Values, parents)
	}
	var rows []*resourcepb.ResourceTableRow
	for _, p := range parents {
		for _, uid := range byParent[p] {
			rows = append(rows, &resourcepb.ResourceTableRow{
				Key:   &resourcepb.ResourceKey{Name: uid, Resource: "folder"},
				Cells: [][]byte{[]byte(p)},
			})
		}
	}
	mockCli.On("Search", mock.Anything, orgID, mock.MatchedBy(matcher)).Return(&resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: rows,
		},
		TotalHits: int64(len(rows)),
	}, nil).Once()
}

// expectGetFolder sets up a minimal Get mock returning an Unstructured for the
// given UID. The body is intentionally minimal — the call sites here only need
// existence, not field fidelity.
func expectGetFolder(mockCli *client.MockK8sHandler, uid string, orgID int64) {
	mockCli.On("Get", mock.Anything, uid, orgID, mock.Anything, mock.Anything).Return(&unstructured.Unstructured{
		Object: map[string]interface{}{
			"metadata": map[string]interface{}{"name": uid},
		},
	}, nil).Once()
}

func TestGetDescendants(t *testing.T) {
	orgID := int64(1)
	ctx := context.Background()

	t.Run("returns full subtree via level-by-level search", func(t *testing.T) {
		mockCli := new(client.MockK8sHandler)
		expectGetFolder(mockCli, "root", orgID)
		// One Search per level (parents at that level batched into a single In).
		expectSearchChildren(mockCli, orgID, []string{"root"}, map[string][]string{"root": {"child1", "child3"}})
		expectSearchChildren(mockCli, orgID, []string{"child1", "child3"}, map[string][]string{"child1": {"child2"}})
		expectSearchChildren(mockCli, orgID, []string{"child2"}, nil)

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
			log:         log.New("test"),
			maxDepth:    8,
		}
		got, err := ss.GetDescendants(ctx, orgID, "root")
		require.NoError(t, err)

		gotUIDs := make([]string, 0, len(got))
		for _, f := range got {
			gotUIDs = append(gotUIDs, f.UID)
			require.Equal(t, orgID, f.OrgID)
		}
		require.ElementsMatch(t, []string{"child1", "child2", "child3"}, gotUIDs)
		mockCli.AssertExpectations(t)
	})

	t.Run("returns empty when ancestor is a leaf", func(t *testing.T) {
		mockCli := new(client.MockK8sHandler)
		expectGetFolder(mockCli, "leaf", orgID)
		expectSearchChildren(mockCli, orgID, []string{"leaf"}, nil)

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
			log:         log.New("test"),
			maxDepth:    8,
		}
		got, err := ss.GetDescendants(ctx, orgID, "leaf")
		require.NoError(t, err)
		require.Empty(t, got)
		mockCli.AssertExpectations(t)
	})

	t.Run("propagates ErrFolderNotFound when ancestor is missing", func(t *testing.T) {
		mockCli := new(client.MockK8sHandler)
		mockCli.On("Get", mock.Anything, "missing", orgID, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{Group: "folders.folder.grafana.app", Resource: "folder"}, "missing")).Once()

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
			log:         log.New("test"),
			maxDepth:    8,
		}
		_, err := ss.GetDescendants(ctx, orgID, "missing")
		require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
		mockCli.AssertExpectations(t)
	})

	t.Run("detects 3-node cycle", func(t *testing.T) {
		// a -> b -> c -> a
		mockCli := new(client.MockK8sHandler)
		expectGetFolder(mockCli, "a", orgID)
		expectSearchChildren(mockCli, orgID, []string{"a"}, map[string][]string{"a": {"b"}})
		expectSearchChildren(mockCli, orgID, []string{"b"}, map[string][]string{"b": {"c"}})
		expectSearchChildren(mockCli, orgID, []string{"c"}, map[string][]string{"c": {"a"}})

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
			log:         log.New("test"),
			maxDepth:    8,
		}
		_, err := ss.GetDescendants(ctx, orgID, "a")
		require.ErrorIs(t, err, folder.ErrCircularReference)
	})

	t.Run("detects self-referencing cycle", func(t *testing.T) {
		// self -> self
		mockCli := new(client.MockK8sHandler)
		expectGetFolder(mockCli, "self", orgID)
		expectSearchChildren(mockCli, orgID, []string{"self"}, map[string][]string{"self": {"self"}})

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
			log:         log.New("test"),
			maxDepth:    8,
		}
		_, err := ss.GetDescendants(ctx, orgID, "self")
		require.ErrorIs(t, err, folder.ErrCircularReference)
	})

	t.Run("depth cap returns partial result without error", func(t *testing.T) {
		// Tree of height 3 (root -> l1 -> l2 -> l3) with maxDepth=1.
		// The loop (mirroring GetHeight) processes searches at depths 0, 1
		// and 2 (root, l1, l2) and then exits because depth=2 > maxDepth=1.
		// l3 is discovered as a child reference of l2 and added to the
		// output, but its own search is never issued so any l4 descendants
		// would be truncated. The warning fires because depth > maxDepth.
		mockCli := new(client.MockK8sHandler)
		expectGetFolder(mockCli, "root", orgID)
		expectSearchChildren(mockCli, orgID, []string{"root"}, map[string][]string{"root": {"l1"}})
		expectSearchChildren(mockCli, orgID, []string{"l1"}, map[string][]string{"l1": {"l2"}})
		expectSearchChildren(mockCli, orgID, []string{"l2"}, map[string][]string{"l2": {"l3"}})

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
			log:         log.New("test"),
			maxDepth:    1,
		}
		got, err := ss.GetDescendants(ctx, orgID, "root")
		require.NoError(t, err)

		gotUIDs := make([]string, 0, len(got))
		for _, f := range got {
			gotUIDs = append(gotUIDs, f.UID)
		}
		require.ElementsMatch(t, []string{"l1", "l2", "l3"}, gotUIDs)
		mockCli.AssertExpectations(t)
		mockCli.AssertNotCalled(t, "Search", mock.Anything, orgID, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
			return req != nil && req.Options != nil && len(req.Options.Fields) > 0 &&
				req.Options.Fields[0].Key == resource.SEARCH_FIELD_FOLDER &&
				len(req.Options.Fields[0].Values) == 1 &&
				req.Options.Fields[0].Values[0] == "l3"
		}))
	})
}

func TestSearchChildren(t *testing.T) {
	orgID := int64(1)
	ctx := context.Background()

	t.Run("does not validate parent existence", func(t *testing.T) {
		mockCli := new(client.MockK8sHandler)
		// Only Search is expected; Get is NOT called for the parent.
		expectSearchChildren(mockCli, orgID, []string{"some-parent"}, map[string][]string{"some-parent": {"a", "b"}})

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
		}
		got, err := ss.searchChildren(ctx, []string{"some-parent"}, folder.GetChildrenQuery{OrgID: orgID})
		require.NoError(t, err)
		require.Len(t, got, 2)
		mockCli.AssertExpectations(t)
		mockCli.AssertNotCalled(t, "Get", mock.Anything, "some-parent", orgID, mock.Anything, mock.Anything)
	})
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
			require.NoError(t, buildFolderFullPaths(tt.args.f, tt.args.relations, tt.args.folderMap))
			require.Equal(t, tt.want.Fullpath, tt.args.f.Fullpath, "BuildFolderFullPaths() = %v, want %v", tt.args.f.Fullpath, tt.want.Fullpath)
			require.Equal(t, tt.want.FullpathUIDs, tt.args.f.FullpathUIDs, "BuildFolderFullPaths() = %v, want %v", tt.args.f.FullpathUIDs, tt.want.FullpathUIDs)
			require.Equal(t, tt.want.Title, tt.args.f.Title, "BuildFolderFullPaths() = %v, want %v", tt.args.f.Title, tt.want.Title)
			require.Equal(t, tt.want.UID, tt.args.f.UID, "BuildFolderFullPaths() = %v, want %v", tt.args.f.UID, tt.want.UID)
			require.Equal(t, tt.want.ParentUID, tt.args.f.ParentUID, "BuildFolderFullPaths() = %v, want %v", tt.args.f.ParentUID, tt.want.ParentUID)
		})
	}
}

func TestBuildFolderFullPaths_CircularReference(t *testing.T) {
	type args struct {
		f         *folder.Folder
		relations map[string]string
		folderMap map[string]*folder.Folder
	}
	tests := []struct {
		name        string
		args        args
		expectedErr string
	}{
		{
			name: "should detect direct circular reference (A -> B -> A)",
			args: args{
				f: &folder.Folder{
					Title:     "FolderA",
					UID:       "folder-a",
					ParentUID: "folder-b",
				},
				relations: map[string]string{
					"folder-a": "folder-b",
					"folder-b": "folder-a", // circular: B points back to A
				},
				folderMap: map[string]*folder.Folder{
					"folder-a": {
						Title:     "FolderA",
						UID:       "folder-a",
						ParentUID: "folder-b",
					},
					"folder-b": {
						Title:     "FolderB",
						UID:       "folder-b",
						ParentUID: "folder-a",
					},
				},
			},
			expectedErr: "circular reference detected",
		},
		{
			name: "should detect self-reference (A -> A)",
			args: args{
				f: &folder.Folder{
					Title:     "FolderA",
					UID:       "folder-a",
					ParentUID: "folder-a", // points to itself
				},
				relations: map[string]string{
					"folder-a": "folder-a",
				},
				folderMap: map[string]*folder.Folder{
					"folder-a": {
						Title:     "FolderA",
						UID:       "folder-a",
						ParentUID: "folder-a",
					},
				},
			},
			expectedErr: "circular reference detected",
		},
		{
			name: "should detect longer circular reference (A -> B -> C -> A)",
			args: args{
				f: &folder.Folder{
					Title:     "FolderA",
					UID:       "folder-a",
					ParentUID: "folder-b",
				},
				relations: map[string]string{
					"folder-a": "folder-b",
					"folder-b": "folder-c",
					"folder-c": "folder-a", // circular: C points back to A
				},
				folderMap: map[string]*folder.Folder{
					"folder-a": {
						Title:     "FolderA",
						UID:       "folder-a",
						ParentUID: "folder-b",
					},
					"folder-b": {
						Title:     "FolderB",
						UID:       "folder-b",
						ParentUID: "folder-c",
					},
					"folder-c": {
						Title:     "FolderC",
						UID:       "folder-c",
						ParentUID: "folder-a",
					},
				},
			},
			expectedErr: "circular reference detected",
		},
		{
			name: "should detect circular reference starting from middle (B in A -> B -> C -> A)",
			args: args{
				f: &folder.Folder{
					Title:     "FolderB",
					UID:       "folder-b",
					ParentUID: "folder-c",
				},
				relations: map[string]string{
					"folder-a": "folder-b",
					"folder-b": "folder-c",
					"folder-c": "folder-a",
				},
				folderMap: map[string]*folder.Folder{
					"folder-a": {
						Title:     "FolderA",
						UID:       "folder-a",
						ParentUID: "folder-b",
					},
					"folder-b": {
						Title:     "FolderB",
						UID:       "folder-b",
						ParentUID: "folder-c",
					},
					"folder-c": {
						Title:     "FolderC",
						UID:       "folder-c",
						ParentUID: "folder-a",
					},
				},
			},
			expectedErr: "circular reference detected",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := buildFolderFullPaths(tt.args.f, tt.args.relations, tt.args.folderMap)
			require.Error(t, err)
			require.Contains(t, err.Error(), tt.expectedErr)
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
