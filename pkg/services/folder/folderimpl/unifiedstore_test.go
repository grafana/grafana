package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
)

type folderStorageFailure struct {
	name   string
	result *resourcepb.ErrorResult
	err    error
	want   error
}

func (f folderStorageFailure) searchResponse() *resourcepb.ResourceSearchResponse {
	if f.result == nil {
		return nil
	}
	return &resourcepb.ResourceSearchResponse{Error: f.result}
}

func folderStorageFailures(t *testing.T) []folderStorageFailure {
	t.Helper()
	result := &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "storage unavailable"}
	grpcStatus, err := status.New(codes.Unavailable, result.Message).WithDetails(result)
	require.NoError(t, err)
	grpcErr := grpcStatus.Err()
	return []folderStorageFailure{
		{name: "embedded", result: result, want: resource.StatusError(result)},
		{name: "grpc nil response", err: grpcErr, want: grpcErr},
	}
}

func requireFolderStorageError(t *testing.T, want, got error) {
	t.Helper()
	require.Equal(t, want, got)
	var statusErr *apierrors.StatusError
	if errors.As(want, &statusErr) {
		require.IsType(t, &apierrors.StatusError{}, got)
	} else {
		require.Same(t, want, got)
	}
}

func TestFolderChildrenSearchErrors(t *testing.T) {
	for _, tc := range folderStorageFailures(t) {
		t.Run(tc.name, func(t *testing.T) {
			cli := new(client.MockK8sHandler)
			cli.On("Search", mock.Anything, int64(1), mock.Anything).Return(tc.searchResponse(), tc.err).Once()
			store := &FolderUnifiedStoreImpl{k8sclient: cli, tracer: noop.NewTracerProvider().Tracer("test")}

			hits, err := store.GetChildren(t.Context(), folder.GetChildrenQuery{OrgID: 1})

			require.Empty(t, hits)
			requireFolderStorageError(t, tc.want, err)
			cli.AssertExpectations(t)
		})
	}
}

func TestFolderSearchLaterPageErrors(t *testing.T) {
	for _, tc := range folderStorageFailures(t) {
		t.Run(tc.name, func(t *testing.T) {
			cli := new(client.MockK8sHandler)
			cli.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
				return req.Offset == 0
			})).Return(buildFolderSearchResponse(folderResult{uid: "first"}), nil).Once()
			cli.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
				return req.Offset == 1
			})).Return(tc.searchResponse(), tc.err).Once()
			store := &FolderUnifiedStoreImpl{k8sclient: cli, tracer: noop.NewTracerProvider().Tracer("test")}

			hits, err := store.searchAllFolders(t.Context(), 1)

			require.Empty(t, hits)
			requireFolderStorageError(t, tc.want, err)
			cli.AssertExpectations(t)
		})
	}
}

func TestFolderCountInOrgErrorCompatibility(t *testing.T) {
	for _, tc := range folderStorageFailures(t) {
		t.Run(tc.name, func(t *testing.T) {
			cli := new(client.MockK8sHandler)
			var resp *resourcepb.ResourceStatsResponse
			if tc.result != nil {
				resp = &resourcepb.ResourceStatsResponse{Error: tc.result}
			}
			cli.On("GetStats", mock.Anything, int64(1)).Return(resp, tc.err).Once()
			store := &FolderUnifiedStoreImpl{k8sclient: cli}
			got, err := store.CountInOrg(t.Context(), 1)
			require.Zero(t, got)
			requireFolderStorageError(t, tc.want, err)
			cli.AssertExpectations(t)
		})
	}
}

func TestFolderCountInOrgSuccess(t *testing.T) {
	cli := new(client.MockK8sHandler)
	cli.On("GetStats", mock.Anything, int64(1)).Return(&resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{{Count: 42}},
	}, nil).Once()
	store := &FolderUnifiedStoreImpl{k8sclient: cli}

	got, err := store.CountInOrg(t.Context(), 1)

	require.NoError(t, err)
	require.Equal(t, int64(42), got)
	cli.AssertExpectations(t)
}

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
			// Slashes in a title must be escaped so the title is not mistaken
			// for a path separator. Consumers (backend SplitFullpath, the
			// alerting frontend) rely on this to match a rule's folder.
			name: "should escape slashes in titles",
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
			wantPath:     "Parent\\/With\\/Slashes/Element With Spaces",
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

func TestToFolderLegacyCounts(t *testing.T) {
	counts := func(stats ...map[string]interface{}) *unstructured.Unstructured {
		items := make([]interface{}, 0, len(stats))
		for _, s := range stats {
			items = append(items, s)
		}
		return &unstructured.Unstructured{Object: map[string]interface{}{"counts": items}}
	}
	stat := func(group, res string, count int64) map[string]interface{} {
		return map[string]interface{}{"group": group, "resource": res, "count": count}
	}

	testCases := []struct {
		name  string
		input *unstructured.Unstructured
		want  folder.DescendantCounts
	}{
		{
			name: "resources still living in the single-tenant tables are counted",
			input: counts(
				stat("rules.alerting.grafana.app", "alertrules", 0),
				stat("sql-fallback", "alertrules", 3),
			),
			want: folder.DescendantCounts{"alertrules": 3},
		},
		{
			name: "unified storage counts win over the single-tenant tables",
			input: counts(
				stat("rules.alerting.grafana.app", "alertrules", 5),
				stat("sql-fallback", "alertrules", 3),
			),
			want: folder.DescendantCounts{"alertrules": 5},
		},
		{
			name: "order of the entries does not matter",
			input: counts(
				stat("sql-fallback", "alertrules", 3),
				stat("rules.alerting.grafana.app", "alertrules", 0),
			),
			want: folder.DescendantCounts{"alertrules": 3},
		},
		{
			name: "empty folder stays empty",
			input: counts(
				stat("dashboard.grafana.app", "dashboards", 0),
				stat("rules.alerting.grafana.app", "alertrules", 0),
				stat("sql-fallback", "alertrules", 0),
			),
			want: folder.DescendantCounts{"dashboards": 0, "alertrules": 0},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := toFolderLegacyCounts(tc.input)
			require.NoError(t, err)
			require.Equal(t, tc.want, *got)
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
			Fields:       folderReferenceFields,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
			Limit:  folderSearchLimit, // q.Limit defaults to folderSearchLimit
			Offset: 0,                 // q.Limit * (q.Page - 1) with defaulted Page=1
		}).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
					},
				},
				{
					Key: &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
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
			Fields:       folderReferenceFields,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
			Limit:  folderSearchLimit, // q.Limit defaults to folderSearchLimit
			Offset: 0,                 // q.Limit * (q.Page - 1) with defaulted Page=1
		}).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
					},
				},
				{
					Key: &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
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
			Fields:       folderReferenceFields,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
			Limit:  10,
			Offset: 20, // q.Limit * (q.Page - 1) = 10 * (3 - 1)
		}).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
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
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows:      []*resourcepb.ResourceSearchRow{},
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
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: accesscontrol.K6FolderUID, Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder"}},
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
			Fields:       folderReferenceFields,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
			Limit:  folderSearchLimit, // q.Limit defaults to folderSearchLimit
			Offset: 0,                 // q.Limit * (q.Page - 1) with defaulted Page=1
		}).Return(&resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
					},
				},
				{
					Key: &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
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
		// Internal searchChildren applies no visibility filters, so the
		// request should carry exactly one Fields entry: the folder In.
		if req == nil || req.Options == nil || len(req.Options.Fields) != 1 {
			return false
		}
		f := req.Options.Fields[0]
		return f.Key == resource.SEARCH_FIELD_FOLDER &&
			f.Operator == string(selection.In) &&
			slices.Equal(f.Values, parents)
	}
	var rows []*resourcepb.ResourceSearchRow
	for _, p := range parents {
		for _, uid := range byParent[p] {
			rows = append(rows, &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: uid, Resource: "folder"}, Values: []*resourcepb.ResourceSearchValue{
				{FieldIndex: 0, StringValues: []string{p}},
			}})
		}
	}
	mockCli.On("Search", mock.Anything, orgID, mock.MatchedBy(matcher)).Return(&resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
		},
		Rows:           rows,
		TotalHits:      int64(len(rows)),
		TotalHitsExact: true,
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

	t.Run("level with more parents than descendantsBatchSize fires chunked Search calls", func(t *testing.T) {
		// 150 root children at level 1 — exceeds descendantsBatchSize=100,
		// so the level-2 walk must split into one Search per chunk-of-100
		// parents (slices.Chunk).
		mockCli := new(client.MockK8sHandler)
		expectGetFolder(mockCli, "root", orgID)

		n := descendantsBatchSize + descendantsBatchSize/2 // 150
		level1 := make([]string, n)
		for i := range n {
			level1[i] = fmt.Sprintf("c%03d", i)
		}
		expectSearchChildren(mockCli, orgID, []string{"root"}, map[string][]string{"root": level1})
		// Two chunked Search calls at level 2; both return no children.
		expectSearchChildren(mockCli, orgID, level1[:descendantsBatchSize], nil)
		expectSearchChildren(mockCli, orgID, level1[descendantsBatchSize:], nil)

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
			log:         log.New("test"),
			maxDepth:    8,
		}
		got, err := ss.GetDescendants(ctx, orgID, "root")
		require.NoError(t, err)
		require.Len(t, got, n)
		mockCli.AssertExpectations(t)
	})

	t.Run("depth cap with descendants still queued returns ErrMaximumDepthReached", func(t *testing.T) {
		// Tree of height 3 (root -> l1 -> l2 -> l3) with maxDepth=1. The loop
		// processes levels 0, 1 and 2 (root, l1, l2), then exits with l3
		// still queued. Returning the partial subtree would let Service.Delete
		// leave the rest behind, so we surface ErrMaximumDepthReached instead.
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
		_, err := ss.GetDescendants(ctx, orgID, "root")
		require.ErrorIs(t, err, folder.ErrMaximumDepthReached)
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

	t.Run("does not validate parent existence and applies no visibility filters", func(t *testing.T) {
		mockCli := new(client.MockK8sHandler)
		// Only Search is expected; Get is NOT called for the parent.
		expectSearchChildren(mockCli, orgID, []string{"some-parent"}, map[string][]string{"some-parent": {"a", "b"}})

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
		}
		got, err := ss.searchChildren(ctx, orgID, []string{"some-parent"})
		require.NoError(t, err)
		require.Len(t, got, 2)
		mockCli.AssertExpectations(t)
		mockCli.AssertNotCalled(t, "Get", mock.Anything, "some-parent", orgID, mock.Anything, mock.Anything)
	})

	t.Run("paginates when a page returns searchPageSize hits", func(t *testing.T) {
		mockCli := new(client.MockK8sHandler)

		// Build searchPageSize+1 children so the first Search returns a full
		// page (triggering the inner page loop) and the second returns the
		// remaining hit.
		n := searchPageSize + 1
		children := make([]string, n)
		for i := range n {
			children[i] = fmt.Sprintf("c%05d", i)
		}

		buildResp := func(uids []string) *resourcepb.ResourceSearchResponse {
			rows := make([]*resourcepb.ResourceSearchRow, len(uids))
			for i, uid := range uids {
				rows[i] = &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: uid, Resource: "folder"}, Values: []*resourcepb.ResourceSearchValue{
					{FieldIndex: 0, StringValues: []string{"root"}},
				}}
			}
			return &resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Fields: []*resourcepb.ResourceSearchField{
					{Name: "folder", Type: resourcepb.ResourceSearchField_STRING},
				},
				Rows:           rows,
				TotalHits:      int64(n),
				TotalHitsExact: true,
			}
		}
		pageMatcher := func(offset int64) any {
			return mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
				return req != nil && req.Limit == int64(searchPageSize) && req.Offset == offset
			})
		}

		mockCli.On("Search", mock.Anything, orgID, pageMatcher(0)).
			Return(buildResp(children[:searchPageSize]), nil).Once()
		mockCli.On("Search", mock.Anything, orgID, pageMatcher(int64(searchPageSize))).
			Return(buildResp(children[searchPageSize:]), nil).Once()

		ss := &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      noop.NewTracerProvider().Tracer("test"),
		}
		got, err := ss.searchChildren(ctx, orgID, []string{"root"})
		require.NoError(t, err)
		require.Len(t, got, n)
		mockCli.AssertExpectations(t)
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
			name: "should escape slashes in folder and parent titles",
			args: args{
				f: &folder.Folder{
					Title:     "Child/With/Slashes",
					UID:       "child-uid",
					ParentUID: "parent-uid",
				},
				relations: map[string]string{
					"child-uid":  "parent-uid",
					"parent-uid": "",
				},
				folderMap: map[string]*folder.Folder{
					"parent-uid": {
						Title: "Parent/With/Slashes",
						UID:   "parent-uid",
					},
				},
			},
			want: &folder.Folder{
				Title:        "Child/With/Slashes",
				UID:          "child-uid",
				ParentUID:    "parent-uid",
				Fullpath:     "Parent\\/With\\/Slashes/Child\\/With\\/Slashes",
				FullpathUIDs: "parent-uid/child-uid",
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

// searchRow builds a single-hit row for the folder search index with the
// title/folder columns getFoldersMetadata relies on.
func searchRow(uid, title, parentUID string) *resourcepb.ResourceSearchRow {
	return &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: uid, Resource: "folder"}, Values: []*resourcepb.ResourceSearchValue{
		{FieldIndex: 0, StringValues: []string{title}},
		{FieldIndex: 1, StringValues: []string{parentUID}},
	}}
}

type folderIndexSearchClient struct {
	client.K8sHandler
	index              resource.ResourceIndex
	access             *folderSearchAccessClient
	ignoreExactTotal   bool
	ignoreUIDFilter    bool
	allFields          bool
	lastFields         []string
	calls              int
	firstPageRows      int
	firstTotalExact    bool
	firstResponseBytes int
	afterSearch        func(int)
}

func (c *folderIndexSearchClient) Search(ctx context.Context, _ int64, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	c.calls++
	c.lastFields = req.Fields
	req.Options.Key = &resourcepb.ResourceKey{Namespace: "default", Group: "folder.grafana.app", Resource: "folders"}
	if c.ignoreUIDFilter {
		// Reproduce the full-tree lookup without changing path construction.
		req.Options.Fields = nil
		req.Limit = searchPageSize
	}
	if c.allFields {
		// Keep the previous request shape for the field-selection comparison.
		req.Fields = nil
	}
	response, err := c.index.Search(ctx, c.access, req, nil, nil)
	if err == nil && response != nil {
		if c.ignoreExactTotal {
			// Reproduce the previous pagination for the benchmark comparison.
			response.TotalHitsExact = false
		}
		if c.calls == 1 {
			c.firstPageRows, c.firstTotalExact = len(response.Rows), response.TotalHitsExact
			c.firstResponseBytes = proto.Size(response)
		}
	}
	if c.afterSearch != nil {
		c.afterSearch(c.calls)
	}
	return response, err
}

type folderSearchAccessClient struct {
	claims.AccessClient
	allowedFolders map[string]bool
	deniedUIDs     []string
	checked        int
}

func (c *folderSearchAccessClient) BatchCheck(_ context.Context, _ claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	c.checked += len(req.Checks)
	results := make(map[string]claims.BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		results[check.CorrelationID] = claims.BatchCheckResult{Allowed: (c.allowedFolders == nil || c.allowedFolders[check.Folder]) && !slices.Contains(c.deniedUIDs, check.Name)}
	}
	return claims.BatchCheckResponse{Results: results}, nil
}

func newFolderIndexSearchStore(t testing.TB, count int, cfg search.PostRankAuthzConfig, parents ...string) (*FolderUnifiedStoreImpl, *folderIndexSearchClient) {
	t.Helper()
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:                 t.TempDir(),
		FileThreshold:        100,
		PostRankAuthzEnabled: true,
		PostRankAuthz:        cfg,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	index, err := backend.BuildIndex(t.Context(), resource.NamespacedResource{
		Namespace: "default", Group: "folder.grafana.app", Resource: "folders",
	}, int64(count), "test", func(idx resource.ResourceIndex) (int64, error) {
		items := make([]*resource.BulkIndexItem, count)
		for i := range items {
			name := fmt.Sprintf("folder-%05d", i)
			parent := "allowed"
			if i%2 == 1 {
				parent = "denied"
			}
			if i < len(parents) {
				parent = parents[i]
			}
			items[i] = &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key: &resourcepb.ResourceKey{
						Namespace: "default", Group: "folder.grafana.app", Resource: "folders", Name: name,
					},
					Name: name, Title: name, Folder: parent, RV: 1,
					Description: "A folder for service dashboards and alert rules.",
					Created:     1700000000000,
					Updated:     1700000001000,
					CreatedBy:   "user:creator",
					UpdatedBy:   "user:editor",
					Labels: map[string]string{
						utils.LabelKeyDeprecatedInternalID: fmt.Sprint(i + 1), //nolint:staticcheck // Exercise legacy field compatibility.
						"team":                             "observability",
					},
					Manager: &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repository"},
				},
			}
		}
		return int64(count), idx.BulkIndex(&resource.BulkIndexRequest{Items: items, ResourceVersion: 1})
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)

	cli := &folderIndexSearchClient{index: index, access: &folderSearchAccessClient{AccessClient: claims.FixedAccessClient(true)}}
	return &FolderUnifiedStoreImpl{k8sclient: cli, tracer: noop.NewTracerProvider().Tracer("test")}, cli
}

func TestFolderSearchPostRankAuthz(t *testing.T) {
	for _, children := range []bool{false, true} {
		for _, tc := range []struct {
			name           string
			count          int
			allowedFolders map[string]bool
			cfg            search.PostRankAuthzConfig
			want           int
		}{
			{name: "all folders", count: 1771, want: 1771},
			{name: "restricted caller", count: 1771, allowedFolders: map[string]bool{"allowed": true}, want: 886},
			{name: "no readable folders", count: 1771, allowedFolders: map[string]bool{}, want: 0},
			{name: "candidate budget", count: 21, allowedFolders: map[string]bool{"allowed": true},
				cfg: search.PostRankAuthzConfig{MaxWindow: 5, MaxCandidates: 5}, want: 11},
		} {
			t.Run(fmt.Sprintf("%s/children=%t", tc.name, children), func(t *testing.T) {
				store, cli := newFolderIndexSearchStore(t, tc.count, tc.cfg)
				cli.access.allowedFolders = tc.allowedFolders
				ctx := claims.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})

				var hits []*folder.FolderReference
				var err error
				if children {
					hits, err = store.searchChildren(ctx, 1, []string{"allowed", "denied"})
				} else {
					hits, err = store.searchAllFolders(ctx, 1)
				}

				require.NoError(t, err)
				require.Len(t, hits, tc.want)
				for i, hit := range hits {
					n := i
					if tc.allowedFolders != nil {
						n *= 2
					}
					require.Equal(t, fmt.Sprintf("folder-%05d", n), hit.UID)
					require.Equal(t, int64(n+1), hit.ID) //nolint:staticcheck // Exercise legacy field compatibility.
					require.Equal(t, utils.ManagerKindRepo, hit.ManagedBy)
				}
				if tc.cfg.MaxCandidates > 0 {
					require.Greater(t, cli.calls, 1)
					require.Positive(t, cli.firstPageRows)
					require.Less(t, cli.firstPageRows, searchPageSize)
					require.False(t, cli.firstTotalExact)
				} else {
					require.Equal(t, 1, cli.calls)
					require.True(t, cli.firstTotalExact)
					require.Equal(t, tc.count, cli.access.checked)
				}
			})
		}
	}
}

func TestFolderSearchFields(t *testing.T) {
	store, cli := newFolderIndexSearchStore(t, 3, search.PostRankAuthzConfig{})
	ctx := claims.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
	items := make([]*resource.BulkIndexItem, 3)
	for i, title := range []string{"A/B", "Child", "Nested"} {
		name := fmt.Sprintf("folder-%05d", i)
		parent := "general"
		if i > 0 {
			parent = fmt.Sprintf("folder-%05d", i-1)
		}
		doc := &resource.IndexableDocument{
			Key:  &resourcepb.ResourceKey{Namespace: "default", Group: "folder.grafana.app", Resource: "folders", Name: name},
			Name: name, Title: title, Folder: parent, RV: 2,
		}
		if i == 1 {
			doc.Labels = map[string]string{utils.LabelKeyDeprecatedInternalID: "9007199254740993"} //nolint:staticcheck // Exercise legacy field compatibility.
			doc.Manager = &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "test-repository"}
		}
		items[i] = &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc}
	}
	require.NoError(t, cli.index.BulkIndex(&resource.BulkIndexRequest{Items: items, ResourceVersion: 2}))

	cli.allFields = true
	want, err := store.searchAllFolders(ctx, 1)
	require.NoError(t, err)
	require.Len(t, want, 3)

	cli.allFields = false
	got, err := store.searchAllFolders(ctx, 1)

	require.NoError(t, err)
	require.Equal(t, want, got)
	require.Equal(t, []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_MANAGER_KIND,
		resource.SEARCH_FIELD_LEGACY_ID,
		resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID,
	}, cli.lastFields)
	require.Equal(t, []*folder.FolderReference{
		{UID: "folder-00000", Title: "A/B"},
		{UID: "folder-00001", Title: "Child", ParentUID: "folder-00000", ManagedBy: utils.ManagerKindRepo,
			ID: 9007199254740993}, //nolint:staticcheck // Exercise legacy field compatibility.
		{UID: "folder-00002", Title: "Nested", ParentUID: "folder-00001"},
	}, got)

	folders, err := store.GetFolders(ctx, folder.GetFoldersFromStoreQuery{GetFoldersQuery: folder.GetFoldersQuery{
		OrgID: 1, UIDs: []string{"folder-00002"}, MetadataOnly: true, WithFullpath: true, WithFullpathUIDs: true,
	}})
	require.NoError(t, err)
	require.Len(t, folders, 1)
	require.Equal(t, "A\\/B/Child/Nested", folders[0].Fullpath)
	require.Equal(t, "folder-00000/folder-00001/folder-00002", folders[0].FullpathUIDs)
}

func BenchmarkSearchAllFolders(b *testing.B) {
	for _, restricted := range []bool{false, true} {
		for _, tc := range []struct {
			name             string
			ignoreExactTotal bool
			allFields        bool
		}{
			{name: "legacy-pagination", ignoreExactTotal: true, allFields: true},
			{name: "all-fields", allFields: true},
			{name: "selected-fields"},
		} {
			b.Run(fmt.Sprintf("restricted=%t/%s", restricted, tc.name), func(b *testing.B) {
				store, cli := newFolderIndexSearchStore(b, 1771, search.PostRankAuthzConfig{})
				cli.ignoreExactTotal, cli.allFields = tc.ignoreExactTotal, tc.allFields
				want := 1771
				if restricted {
					cli.access.allowedFolders = map[string]bool{"allowed": true}
					want = 886
				}
				ctx := claims.WithAuthInfo(b.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
				b.ReportAllocs()
				for b.Loop() {
					hits, err := store.searchAllFolders(ctx, 1)
					if err != nil {
						b.Fatal(err)
					}
					if len(hits) != want {
						b.Fatalf("got %d folders, want %d", len(hits), want)
					}
				}
				b.ReportMetric(float64(cli.calls)/float64(b.N), "searches/op")
				b.ReportMetric(float64(cli.access.checked)/float64(b.N), "authz-hits/op")
				b.ReportMetric(float64(cli.firstResponseBytes), "first-response-bytes")
			})
		}
	}
}

func TestFolderSearchPagination(t *testing.T) {
	type page struct {
		count int
		total int64
		exact bool
	}
	for _, tc := range []struct {
		name  string
		pages []page
	}{
		{name: "empty", pages: []page{{}}},
		{name: "exact page boundary", pages: []page{{count: searchPageSize, total: searchPageSize, exact: true}}},
		{name: "multiple pages", pages: []page{
			{count: searchPageSize, total: searchPageSize + 1, exact: true},
			{count: 1, total: searchPageSize + 1, exact: true},
		}},
		{name: "short page with approximate total", pages: []page{
			{count: 1, total: 2},
			{count: 1, total: 2, exact: true},
		}},
		{name: "approximate total already reached", pages: []page{
			{count: 1, total: 1},
			{count: 1, total: 2, exact: true},
		}},
		{name: "server without exactness", pages: []page{{count: 1, total: 1}, {}}},
		{name: "total grows between pages", pages: []page{
			{count: 1, total: 2, exact: true},
			{count: 2, total: 3, exact: true},
		}},
		{name: "total shrinks between pages", pages: []page{
			{count: 1, total: 3, exact: true},
			{count: 1, total: 2, exact: true},
		}},
		{name: "empty page with remaining approximate hits", pages: []page{{total: 10}}},
	} {
		for _, children := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/children=%t", tc.name, children), func(t *testing.T) {
				cli := new(client.MockK8sHandler)
				var want []string
				offset := int64(0)
				for _, p := range tc.pages {
					results := make([]folderResult, p.count)
					for i := range results {
						uid := fmt.Sprintf("folder-%05d", len(want))
						results[i] = folderResult{uid: uid}
						want = append(want, uid)
					}
					response := buildFolderSearchResponse(results...)
					response.TotalHits, response.TotalHitsExact = p.total, p.exact
					options := &resourcepb.ListOptions{}
					if children {
						options.Fields = []*resourcepb.Requirement{{
							Key: resource.SEARCH_FIELD_FOLDER, Operator: string(selection.In), Values: []string{"root"},
						}}
					}
					cli.On("Search", mock.Anything, int64(1), &resourcepb.ResourceSearchRequest{
						Fields:       folderReferenceFields,
						Options:      options,
						Limit:        searchPageSize,
						Offset:       offset,
						ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
					}).Return(response, nil).Once()
					offset += int64(p.count)
				}
				store := &FolderUnifiedStoreImpl{k8sclient: cli, tracer: noop.NewTracerProvider().Tracer("test")}

				var hits []*folder.FolderReference
				var err error
				if children {
					hits, err = store.searchChildren(t.Context(), 1, []string{"root"})
				} else {
					hits, err = store.searchAllFolders(t.Context(), 1)
				}

				require.NoError(t, err)
				require.Len(t, hits, len(want))
				for i, hit := range hits {
					require.Equal(t, want[i], hit.UID)
				}
				cli.AssertExpectations(t)
			})
		}
	}
}

func TestGetFoldersMetadataAncestorErrors(t *testing.T) {
	for _, tc := range folderStorageFailures(t) {
		t.Run(tc.name, func(t *testing.T) {
			cli := new(client.MockK8sHandler)
			child := buildFolderSearchResponse(folderResult{uid: "child", parentUID: "parent"})
			child.TotalHitsExact = true
			for _, uid := range []string{"child", "parent"} {
				call := cli.On("Search", mock.Anything, int64(1), mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
					return len(req.Options.Fields) == 1 && slices.Equal(req.Options.Fields[0].Values, []string{uid})
				}))
				if uid == "child" {
					call.Return(child, nil).Once()
				} else {
					call.Return(tc.searchResponse(), tc.err).Once()
				}
			}
			store := &FolderUnifiedStoreImpl{k8sclient: cli, tracer: noop.NewTracerProvider().Tracer("test")}
			got, err := store.GetFolders(t.Context(), folder.GetFoldersFromStoreQuery{GetFoldersQuery: folder.GetFoldersQuery{
				OrgID: 1, UIDs: []string{"child"}, MetadataOnly: true, WithFullpath: true,
			}})
			require.Empty(t, got)
			requireFolderStorageError(t, tc.want, err)
			cli.AssertExpectations(t)
		})
	}
}

func TestGetFoldersMetadataConcurrentChanges(t *testing.T) {
	for _, change := range []string{"rename", "move", "delete", "permissions"} {
		t.Run(change, func(t *testing.T) {
			store, cli := newFolderIndexSearchStore(t, 5, search.PostRankAuthzConfig{}, "general", "folder-00000", "folder-00001", "general", "general")
			cli.afterSearch = func(call int) {
				if call != 1 {
					return
				}
				doc := &resource.IndexableDocument{
					Key:  &resourcepb.ResourceKey{Namespace: "default", Group: "folder.grafana.app", Resource: "folders", Name: "folder-00001"},
					Name: "folder-00001", Title: "folder-00001", Folder: "folder-00000", RV: 2,
				}
				action := resource.ActionIndex
				switch change {
				case "rename":
					doc.Title = "renamed"
				case "move":
					doc.Folder = "folder-00004"
				case "delete":
					action = resource.ActionDelete
				case "permissions":
					cli.access.deniedUIDs = []string{doc.Name}
				}
				require.NoError(t, cli.index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{Action: action, Key: doc.Key, Doc: doc}}, ResourceVersion: 2}))
			}
			ctx := claims.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
			got, err := store.GetFolders(ctx, folder.GetFoldersFromStoreQuery{GetFoldersQuery: folder.GetFoldersQuery{
				OrgID: 1, UIDs: []string{"folder-00002"}, MetadataOnly: true, WithFullpath: true,
			}})
			require.NoError(t, err)
			require.Len(t, got, 1)
			want := "folder-00002"
			switch change {
			case "rename":
				want = "folder-00000/renamed/folder-00002"
			case "move":
				want = "folder-00004/folder-00001/folder-00002"
			}
			require.Equal(t, want, got[0].Fullpath)
		})
	}
}

func TestGetFoldersMetadataLargeSelection(t *testing.T) {
	const count = maxFolderUIDFilterSize + 1
	parents := make([]string, count)
	uids := make([]string, count)
	for i := range count {
		parents[i] = "missing"
		uids[i] = fmt.Sprintf("folder-%05d", i)
	}
	store, cli := newFolderIndexSearchStore(t, count, search.PostRankAuthzConfig{}, parents...)
	ctx := claims.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
	got, err := store.GetFolders(ctx, folder.GetFoldersFromStoreQuery{GetFoldersQuery: folder.GetFoldersQuery{
		OrgID: 1, UIDs: uids, MetadataOnly: true, WithFullpath: true,
	}})
	require.NoError(t, err)
	require.Len(t, got, count)
	require.Equal(t, 1, cli.calls)
	require.Equal(t, count, cli.access.checked)
}

// This measures index and caller work, not transport. Use searches/op with the
// deployed round-trip cost before interpreting full-path latency savings.
func BenchmarkGetFoldersMetadata(b *testing.B) {
	const count = 1774
	parents := make([]string, count)
	allUIDs := make([]string, count)
	for i := range count {
		allUIDs[i] = fmt.Sprintf("folder-%05d", i)
		switch {
		case i < 2 || i >= 210:
			parents[i] = "general"
		case i < 30:
			parents[i] = fmt.Sprintf("folder-%05d", i%2)
		default:
			parents[i] = fmt.Sprintf("folder-%05d", 2+(i-30)%28)
		}
	}
	for offset := range 3 {
		i := 211 + offset
		parents[i] = allUIDs[i-1]
	}
	denied := make([]string, 90)
	for i := range denied {
		denied[i] = allUIDs[31+i*2]
	}
	for _, tc := range []struct {
		name   string
		uids   []string
		paths  bool
		denied []string
		want   int
	}{
		{name: "single", uids: allUIDs[213:214]},
		{name: "single-path", uids: allUIDs[213:214], paths: true},
		{name: "180-paths", uids: allUIDs[30:210], paths: true},
		{name: "180-paths-restricted", uids: allUIDs[30:210], paths: true, denied: denied, want: 90},
		{name: "500-selected", uids: allUIDs[:500], paths: true},
		{name: "1000-selected", uids: allUIDs[:1000], paths: true},
		{name: "all-selected", uids: allUIDs, paths: true},
		{name: "unfiltered", paths: true},
	} {
		for _, fullTree := range []bool{true, false} {
			b.Run(fmt.Sprintf("%s/fullTree=%t", tc.name, fullTree), func(b *testing.B) {
				store, cli := newFolderIndexSearchStore(b, count, search.PostRankAuthzConfig{}, parents...)
				cli.ignoreUIDFilter = fullTree
				cli.access.deniedUIDs = tc.denied
				ctx := claims.WithAuthInfo(b.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
				q := folder.GetFoldersFromStoreQuery{GetFoldersQuery: folder.GetFoldersQuery{
					OrgID: 1, UIDs: tc.uids, MetadataOnly: true, WithFullpath: tc.paths, WithFullpathUIDs: tc.paths,
				}}
				want := len(tc.uids)
				if want == 0 {
					want = count
				}
				if tc.want > 0 {
					want = tc.want
				}
				b.ReportAllocs()
				for b.Loop() {
					folders, err := store.GetFolders(ctx, q)
					if err != nil {
						b.Fatal(err)
					}
					if len(folders) != want {
						b.Fatalf("got %d folders, want %d", len(folders), want)
					}
				}
				b.ReportMetric(float64(cli.calls)/float64(b.N), "searches/op")
				b.ReportMetric(float64(cli.access.checked)/float64(b.N), "authz-hits/op")
			})
		}
	}
}

func TestGetFoldersMetadataTargeted(t *testing.T) {
	for _, tc := range []struct {
		name      string
		uids      []string
		paths     bool
		uidPaths  bool
		denied    []string
		cfg       search.PostRankAuthzConfig
		legacy    bool
		want      []string
		wantPaths []string
		calls     int
		checked   int
		cycle     bool
	}{
		{name: "one folder", uids: []string{"folder-00002"}, want: []string{"folder-00002"}, calls: 1, checked: 1},
		{name: "parents", uids: []string{"folder-00002"}, paths: true, want: []string{"folder-00002"}, wantPaths: []string{"folder-00000/folder-00001/folder-00002"}, calls: 3, checked: 3},
		{name: "UID paths", uids: []string{"folder-00002"}, uidPaths: true, want: []string{"folder-00002"}, wantPaths: []string{"folder-00000/folder-00001/folder-00002"}, calls: 3, checked: 3},
		{name: "shared parents", uids: []string{"folder-00003", "folder-00002"}, paths: true, want: []string{"folder-00002", "folder-00003"}, wantPaths: []string{"folder-00000/folder-00001/folder-00002", "folder-00000/folder-00001/folder-00003"}, calls: 3, checked: 4},
		{name: "requested parent", uids: []string{"folder-00001", "folder-00002"}, paths: true, want: []string{"folder-00001", "folder-00002"}, wantPaths: []string{"folder-00000/folder-00001", "folder-00000/folder-00001/folder-00002"}, calls: 2, checked: 3},
		{name: "duplicates and empty UID", uids: []string{"folder-00002", "folder-00002", ""}, want: []string{"folder-00002"}, calls: 1, checked: 1},
		{name: "empty UID", uids: []string{""}},
		{name: "empty UID with paths", uids: []string{""}, paths: true, uidPaths: true},
		{name: "root UIDs", uids: []string{"", "general"}, paths: true, calls: 1},
		{name: "literal wildcard", uids: []string{"*"}, paths: true, calls: 1},
		{name: "invalid UID", uids: []string{"folder-00006 "}, paths: true, calls: 1, checked: 1},
		{name: "missing folder", uids: []string{"missing"}, paths: true, calls: 1},
		{name: "denied folder", uids: []string{"folder-00002"}, paths: true, denied: []string{"folder-00002"}, calls: 1, checked: 1},
		{name: "hidden parent", uids: []string{"folder-00002"}, paths: true, denied: []string{"folder-00001"}, want: []string{"folder-00002"}, wantPaths: []string{"folder-00002"}, calls: 2, checked: 2},
		{name: "shared hidden parent", uids: []string{"folder-00002", "folder-00003"}, paths: true, denied: []string{"folder-00001"}, want: []string{"folder-00002", "folder-00003"}, wantPaths: []string{"folder-00002", "folder-00003"}, calls: 2, checked: 3},
		{name: "requested hidden parent", uids: []string{"folder-00001", "folder-00002"}, paths: true, denied: []string{"folder-00001"}, want: []string{"folder-00002"}, wantPaths: []string{"folder-00002"}, calls: 1, checked: 2},
		{name: "missing parent", uids: []string{"folder-00005"}, paths: true, want: []string{"folder-00005"}, wantPaths: []string{"folder-00005"}, calls: 2, checked: 1},
		{name: "shared missing parent", uids: []string{"folder-00004", "folder-00005"}, paths: true, want: []string{"folder-00004", "folder-00005"}, wantPaths: []string{"folder-00004", "folder-00005"}, calls: 2, checked: 2},
		{name: "cycle", uids: []string{"folder-00006"}, paths: true, cycle: true, calls: 2, checked: 2},
		{name: "candidate budget", uids: []string{"folder-00000", "folder-00001", "folder-00002", "folder-00003", "folder-00004", "folder-00005"}, denied: []string{"folder-00001", "folder-00003", "folder-00005"}, cfg: search.PostRankAuthzConfig{MaxWindow: 2, MaxCandidates: 2}, want: []string{"folder-00000", "folder-00002", "folder-00004"}, calls: 3, checked: 12},
		{name: "older server", uids: []string{"folder-00002"}, paths: true, legacy: true, want: []string{"folder-00002"}, wantPaths: []string{"folder-00000/folder-00001/folder-00002"}, calls: 6, checked: 6},
		{name: "unfiltered", want: []string{"folder-00000", "folder-00001", "folder-00002", "folder-00003", "folder-00004", "folder-00005", "folder-00006", "folder-00007"}, calls: 1, checked: 8},
	} {
		t.Run(tc.name, func(t *testing.T) {
			parents := []string{"general", "folder-00000", "folder-00001", "folder-00001", "missing", "missing", "folder-00007", "folder-00006"}
			store, cli := newFolderIndexSearchStore(t, len(parents), tc.cfg, parents...)
			store.maxDepth = 1
			originalUIDs := slices.Clone(tc.uids)
			cli.access.deniedUIDs = tc.denied
			if tc.legacy {
				cli.ignoreExactTotal = true
			}
			ctx := claims.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, Namespace: "default"})
			got, err := store.GetFolders(ctx, folder.GetFoldersFromStoreQuery{GetFoldersQuery: folder.GetFoldersQuery{
				OrgID: 1, UIDs: tc.uids, MetadataOnly: true, WithFullpath: tc.paths, WithFullpathUIDs: tc.uidPaths,
			}})
			if tc.cycle {
				require.ErrorIs(t, err, folder.ErrCircularReference)
			} else {
				require.NoError(t, err)
				require.NotNil(t, got, "empty results must remain an empty list, not null")
				require.Len(t, got, len(tc.want))
				for i, f := range got {
					require.Equal(t, tc.want[i], f.UID)
					if len(tc.wantPaths) > 0 {
						require.Equal(t, tc.wantPaths[i], f.Fullpath)
						require.Equal(t, tc.wantPaths[i], f.FullpathUIDs)
					}
				}
			}
			require.Equal(t, tc.calls, cli.calls)
			require.Equal(t, tc.checked, cli.access.checked)
			require.Equal(t, originalUIDs, tc.uids)
		})
	}
}

func TestGetFoldersMetadata(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("TestGetFoldersMetadata")
	orgID := int64(1)
	ctx := context.Background()

	// A -> B -> C tree; getFoldersMetadata must build full paths from the search
	// hits alone, never reading a full folder object (no List/BatchGet/Get).
	newStore := func(t *testing.T) (*FolderUnifiedStoreImpl, *client.MockK8sHandler) {
		mockCli := new(client.MockK8sHandler)
		return &FolderUnifiedStoreImpl{
			k8sclient:   mockCli,
			userService: usertest.NewUserServiceFake(),
			tracer:      tracer,
			maxDepth:    8,
		}, mockCli
	}

	searchResponse := &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING},
			{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
		},
		Rows: []*resourcepb.ResourceSearchRow{
			searchRow("a", "A", ""),
			searchRow("b", "B", "a"),
			searchRow("c", "C", "b"),
		},
		TotalHits:      3,
		TotalHitsExact: true,
	}

	expectSearchAll := func(mockCli *client.MockK8sHandler) {
		mockCli.On("Search", mock.Anything, orgID, &resourcepb.ResourceSearchRequest{
			Fields:       folderReferenceFields,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Options:      &resourcepb.ListOptions{},
			Limit:        searchPageSize,
			Offset:       0,
		}).Return(searchResponse, nil).Once()
	}

	t.Run("builds full paths from the search index without reading full objects", func(t *testing.T) {
		store, mockCli := newStore(t)
		expectSearchAll(mockCli)

		got, err := store.GetFolders(ctx, folder.GetFoldersFromStoreQuery{
			GetFoldersQuery: folder.GetFoldersQuery{
				OrgID:            orgID,
				MetadataOnly:     true,
				WithFullpath:     true,
				WithFullpathUIDs: true,
			},
		})
		require.NoError(t, err)
		require.Len(t, got, 3)

		byUID := map[string]*folder.Folder{}
		for _, f := range got {
			byUID[f.UID] = f
		}
		require.Equal(t, "A/B/C", byUID["c"].Fullpath)
		require.Equal(t, "a/b/c", byUID["c"].FullpathUIDs)
		require.Equal(t, "A/B", byUID["b"].Fullpath)
		require.Equal(t, "A", byUID["a"].Fullpath)
		require.Equal(t, orgID, byUID["a"].OrgID)

		// The whole point of Option A: no full-object reads.
		mockCli.AssertNotCalled(t, "List", mock.Anything, mock.Anything, mock.Anything)
		mockCli.AssertNotCalled(t, "Get", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		mockCli.AssertExpectations(t)
	})

	t.Run("UID filter returns only requested folders but full paths use all ancestors", func(t *testing.T) {
		store, mockCli := newStore(t)
		for i := range 3 {
			row := searchResponse.Rows[2-i]
			mockCli.On("Search", mock.Anything, orgID, &resourcepb.ResourceSearchRequest{
				Fields: folderReferenceFields,
				Options: &resourcepb.ListOptions{Fields: []*resourcepb.Requirement{{
					Key: resource.SEARCH_FIELD_NAME, Operator: string(selection.In), Values: []string{row.Key.Name},
				}}},
				Limit: 2, ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			}).Return(&resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Fields:       searchResponse.Fields,
				Rows: []*resourcepb.ResourceSearchRow{
					row,
				},
				TotalHits: 1, TotalHitsExact: true,
			}, nil).Once()
		}

		got, err := store.GetFolders(ctx, folder.GetFoldersFromStoreQuery{
			GetFoldersQuery: folder.GetFoldersQuery{
				OrgID:        orgID,
				UIDs:         []string{"c"},
				MetadataOnly: true,
				WithFullpath: true,
			},
		})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.Equal(t, "c", got[0].UID)
		// Ancestors A and B aren't in the result set but are still resolved for the path.
		require.Equal(t, "A/B/C", got[0].Fullpath)
		mockCli.AssertExpectations(t)
	})
}
