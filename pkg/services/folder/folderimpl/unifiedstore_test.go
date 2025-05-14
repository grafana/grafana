package folderimpl

import (
	"context"
	"net/http"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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
	store := FolderUnifiedStoreImpl{
		k8sclient:   mockCli,
		userService: usertest.NewUserServiceFake(),
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
	store := FolderUnifiedStoreImpl{
		k8sclient:   mockCli,
		userService: usertest.NewUserServiceFake(),
	}

	ctx := context.Background()
	orgID := int64(2)

	t.Run("should be able to find children folders, and set defaults for pages", func(t *testing.T) {
		mockCli.On("Search", mock.Anything, orgID, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Fields: []*resource.Requirement{
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
		}).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{Name: "folder", Type: resource.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key:   &resource.ResourceKey{Name: "folder2", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
					{
						Key:   &resource.ResourceKey{Name: "folder3", Resource: "folder"},
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
		mockCli.On("Search", mock.Anything, orgID, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Fields: []*resource.Requirement{
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
		}).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{Name: "folder", Type: resource.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key:   &resource.ResourceKey{Name: "folder2", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
					{
						Key:   &resource.ResourceKey{Name: "folder3", Resource: "folder"},
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
		mockCli.On("Search", mock.Anything, orgID, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Fields: []*resource.Requirement{
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
		}).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{Name: "folder", Type: resource.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key:   &resource.ResourceKey{Name: "folder2", Resource: "folder"},
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
		mockCli.On("Search", mock.Anything, orgID, mock.Anything).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{Name: "folder", Type: resource.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key:   &resource.ResourceKey{Name: accesscontrol.K6FolderUID, Resource: "folder"},
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
		mockCli.On("Search", mock.Anything, orgID, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Fields: []*resource.Requirement{
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
		}).Return(&resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{Name: "folder", Type: resource.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key:   &resource.ResourceKey{Name: "folder2", Resource: "folder"},
						Cells: [][]byte{[]byte("folder1")},
					},
					{
						Key:   &resource.ResourceKey{Name: "folder3", Resource: "folder"},
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
