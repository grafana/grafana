package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSearchFallback(t *testing.T) {
	t.Run("should hit legacy search handler on mode 0", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode0},
			},
		}
		dual := dualwrite.ProvideStaticServiceForTests(cfg)
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
		if mockLegacyClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
	})

	t.Run("should hit legacy search handler on mode 1", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode1},
			},
		}
		dual := dualwrite.ProvideStaticServiceForTests(cfg)
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
		if mockLegacyClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
	})

	t.Run("should hit legacy search handler on mode 2", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode2},
			},
		}
		dual := dualwrite.ProvideStaticServiceForTests(cfg)
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
		if mockLegacyClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
	})

	t.Run("should hit unified storage search handler on mode 3", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode3},
			},
		}
		dual := dualwrite.ProvideStaticServiceForTests(cfg)
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		if mockLegacyClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
	})

	t.Run("should hit unified storage search handler on mode 4", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		dual := dualwrite.ProvideStaticServiceForTests(cfg)
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		if mockLegacyClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
	})

	t.Run("should hit unified storage search handler on mode 5", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
			},
		}
		dual := dualwrite.ProvideStaticServiceForTests(cfg)
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		if mockLegacyClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
	})
}

func TestSearchHandlerPagination(t *testing.T) {
	t.Run("should calculate offset and page parameters", func(t *testing.T) {
		limit := 50
		for i, tt := range []struct {
			offset         int
			page           int
			expectedOffset int
			expectedPage   int
		}{
			{
				offset:         0,
				page:           0,
				expectedOffset: 0,
				expectedPage:   1,
			},
			{
				offset:         0,
				page:           1,
				expectedOffset: 0,
				expectedPage:   1,
			},
			{
				offset:         0,
				page:           2,
				expectedOffset: 50,
				expectedPage:   2,
			},
			{
				offset:         0,
				page:           3,
				expectedOffset: 100,
				expectedPage:   3,
			},
			{
				offset:         50,
				page:           0,
				expectedOffset: 50,
				expectedPage:   2,
			},
			{
				offset:         100,
				page:           0,
				expectedOffset: 100,
				expectedPage:   3,
			},
			{
				offset:         149,
				page:           0,
				expectedOffset: 149,
				expectedPage:   3,
			},
			{
				offset:         150,
				page:           0,
				expectedOffset: 150,
				expectedPage:   4,
			},
		} {
			mockClient := &MockClient{}

			cfg := &setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode0},
				},
			}
			dual := dualwrite.ProvideStaticServiceForTests(cfg)
			searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), dual, mockClient, mockClient, nil)

			rr := httptest.NewRecorder()
			endpoint := fmt.Sprintf("/search?limit=%d", limit)
			if tt.offset > 0 {
				endpoint = fmt.Sprintf("%s&offset=%d", endpoint, tt.offset)
			}
			if tt.page > 0 {
				endpoint = fmt.Sprintf("%s&page=%d", endpoint, tt.page)
			}
			req := httptest.NewRequest("GET", endpoint, nil)
			req.Header.Add("content-type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

			searchHandler.DoSearch(rr, req)

			if mockClient.LastSearchRequest == nil {
				t.Fatalf("expected Search to be called, but it was not")
			}

			require.Equal(t, int(mockClient.LastSearchRequest.Offset), tt.expectedOffset, fmt.Sprintf("mismatch offset in test %d", i))
			require.Equal(t, int(mockClient.LastSearchRequest.Page), tt.expectedPage, fmt.Sprintf("mismatch page in test %d", i))
		}
	})
}

func TestSearchHandler(t *testing.T) {
	t.Run("Sort - default sort by resource", func(t *testing.T) {
		rows := make([]*resourcepb.ResourceTableRow, len(mockResults))
		for i, r := range mockResults {
			rows[i] = &resourcepb.ResourceTableRow{
				Key: &resourcepb.ResourceKey{
					Name:     r.Name,
					Resource: r.Resource,
				},
				Cells: [][]byte{
					[]byte(r.Value),
				},
			}
		}

		mockResponse := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: resource.SEARCH_FIELD_TITLE},
				},
				Rows: rows,
			},
		}
		// Create a mock client
		mockClient := &MockClient{
			MockResponses: []*resourcepb.ResourceSearchResponse{mockResponse},
		}

		features := featuremgmt.WithFeatures()
		// Initialize the search handler with the mock client
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}

		resp := rr.Result()
		defer func() {
			if err := resp.Body.Close(); err != nil {
				t.Fatal(err)
			}
		}()

		p := &v0alpha1.SearchResults{}
		err := json.NewDecoder(resp.Body).Decode(p)
		require.NoError(t, err)
		assert.Equal(t, len(mockResults), len(p.Hits))
		assert.Equal(t, mockResults[2].Value, p.Hits[0].Title)
		assert.Equal(t, mockResults[1].Value, p.Hits[3].Title)
	})
}

func TestSearchHandlerSharedDashboards(t *testing.T) {
	t.Run("should return empty result without searching if user does not have shared dashboards", func(t *testing.T) {
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?folder=sharedwithme", nil)
		req.Header.Add("content-type", "application/json")
		// "Permissions" prop in "SignedInUser" is where we store the uid of dashboards shared with the user
		// doesn't exist here, which represents a user without any shared dashboards
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		assert.Equal(t, mockClient.CallCount, 0)

		resp := rr.Result()
		defer func() {
			if err := resp.Body.Close(); err != nil {
				t.Fatal(err)
			}
		}()

		p := &v0alpha1.SearchResults{}
		err := json.NewDecoder(resp.Body).Decode(p)
		require.NoError(t, err)
		assert.Equal(t, 0, len(p.Hits))
	})

	t.Run("should return empty result if user has access to folder of all shared dashboards", func(t *testing.T) {
		// dashboardSearchRequest
		mockResponse1 := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "folder",
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "dashboardinroot",
							Resource: "dashboard",
						},
						Cells: [][]byte{[]byte("")}, // root folder doesn't have uid
					},
					{
						Key: &resourcepb.ResourceKey{
							Name:     "dashboardinpublicfolder",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("publicfolder"), // folder uid
						},
					},
				},
			},
		}

		// folderSearchRequest
		mockResponse2 := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "folder",
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "publicfolder",
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte(""), // root folder uid
						},
					},
				},
			},
		}

		mockClient := &MockClient{
			MockResponses: []*resourcepb.ResourceSearchResponse{mockResponse1, mockResponse2},
		}

		features := featuremgmt.WithFeatures()
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?folder=sharedwithme", nil)
		req.Header.Add("content-type", "application/json")
		allPermissions := make(map[int64]map[string][]string)
		permissions := make(map[string][]string)
		permissions[dashboards.ActionDashboardsRead] = []string{"dashboards:uid:dashboardinroot", "dashboards:uid:dashboardinpublicfolder"}
		allPermissions[1] = permissions
		// "Permissions" is where we store the uid of dashboards shared with the user
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test", OrgID: 1, Permissions: allPermissions}))

		searchHandler.DoSearch(rr, req)

		assert.Equal(t, mockClient.CallCount, 2)

		resp := rr.Result()
		defer func() {
			if err := resp.Body.Close(); err != nil {
				t.Fatal(err)
			}
		}()

		p := &v0alpha1.SearchResults{}
		err := json.NewDecoder(resp.Body).Decode(p)
		require.NoError(t, err)
		assert.Equal(t, 0, len(p.Hits))
	})

	t.Run("should return the dashboards shared with the user", func(t *testing.T) {
		// dashboardSearchRequest
		mockResponse1 := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "folder",
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "dashboardinroot",
							Resource: "dashboard",
						},
						Cells: [][]byte{[]byte("")}, // root folder doesn't have uid
					},
					{
						Key: &resourcepb.ResourceKey{
							Name:     "dashboardinprivatefolder",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("privatefolder"), // folder uid
						},
					},
					{
						Key: &resourcepb.ResourceKey{
							Name:     "dashboardinpublicfolder",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("publicfolder"), // folder uid
						},
					},
				},
			},
		}

		// folderSearchRequest
		mockResponse2 := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "folder",
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "publicfolder",
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte(""), // root folder uid
						},
					},
				},
			},
		}

		mockResponse3 := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{
						Name: "folder",
					},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{
							Name:     "dashboardinprivatefolder",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("privatefolder"), // folder uid
						},
					},
				},
			},
		}

		mockClient := &MockClient{
			MockResponses: []*resourcepb.ResourceSearchResponse{mockResponse1, mockResponse2, mockResponse3},
		}

		features := featuremgmt.WithFeatures()
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?folder=sharedwithme", nil)
		req.Header.Add("content-type", "application/json")
		allPermissions := make(map[int64]map[string][]string)
		permissions := make(map[string][]string)
		permissions[dashboards.ActionDashboardsRead] = []string{"dashboards:uid:dashboardinroot", "dashboards:uid:dashboardinprivatefolder", "dashboards:uid:dashboardinpublicfolder"}
		allPermissions[1] = permissions
		// "Permissions" is where we store the uid of dashboards shared with the user
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test", OrgID: 1, Permissions: allPermissions}))

		searchHandler.DoSearch(rr, req)

		assert.Equal(t, mockClient.CallCount, 3)

		// first call gets all dashboards user has permission for
		firstCall := mockClient.MockCalls[0]
		assert.Equal(t, firstCall.Options.Fields[0].Values, []string{"dashboardinroot", "dashboardinprivatefolder", "dashboardinpublicfolder"})
		// second call gets folders associated with the previous dashboards
		secondCall := mockClient.MockCalls[1]
		assert.Equal(t, secondCall.Options.Fields[0].Values, []string{"privatefolder", "publicfolder"})
		// lastly, search ONLY for dashboards user has permission to read that are within folders the user does NOT have
		// permission to read
		thirdCall := mockClient.MockCalls[2]
		assert.Equal(t, thirdCall.Options.Fields[0].Values, []string{"dashboardinprivatefolder"})

		resp := rr.Result()
		defer func() {
			if err := resp.Body.Close(); err != nil {
				t.Fatal(err)
			}
		}()

		p := &v0alpha1.SearchResults{}
		err := json.NewDecoder(resp.Body).Decode(p)
		require.NoError(t, err)
		assert.Equal(t, len(mockResponse3.Results.Rows), len(p.Hits))
	})
}

func TestConvertHttpSearchRequestToResourceSearchRequest(t *testing.T) {
	testUser := &user.SignedInUser{
		Namespace: "test-namespace",
		OrgID:     1,
	}

	dashboardKey := &resourcepb.ResourceKey{
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Namespace: "test-namespace",
	}
	folderKey := &resourcepb.ResourceKey{
		Group:     "folder.grafana.app",
		Resource:  "folders",
		Namespace: "test-namespace",
	}
	defaultFields := []string{"title", "folder", "tags", "description", "manager.kind", "manager.id"}

	tests := map[string]struct {
		queryString           string
		sharedDashboards      []string
		sharedDashboardsError error
		expected              *resourcepb.ResourceSearchRequest
		expectedError         error
	}{
		"default values with no query params": {
			queryString: "",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"custom limit and offset": {
			queryString: "limit=100&offset=50",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "",
				Limit:     100,
				Offset:    50,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"pagination with page parameter": {
			queryString: "limit=25&page=3",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "",
				Limit:     25,
				Offset:    50,
				Page:      3,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"query string and explain": {
			queryString: "query=test-query&explain=true",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "test-query",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   true,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"additional fields": {
			queryString: "field=custom1&field=custom2",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    append(defaultFields, "custom1", "custom2"),
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"view permission": {
			queryString: "permission=view",
			expected: &resourcepb.ResourceSearchRequest{
				Options:    &resourcepb.ListOptions{Key: dashboardKey},
				Query:      "",
				Limit:      50,
				Offset:     0,
				Page:       1,
				Explain:    false,
				Fields:     defaultFields,
				Permission: int64(dashboardaccess.PERMISSION_VIEW),
				Federated:  []*resourcepb.ResourceKey{folderKey},
			},
		},
		"edit permission": {
			queryString: "permission=Edit",
			expected: &resourcepb.ResourceSearchRequest{
				Options:    &resourcepb.ListOptions{Key: dashboardKey},
				Query:      "",
				Limit:      50,
				Offset:     0,
				Page:       1,
				Explain:    false,
				Fields:     defaultFields,
				Permission: int64(dashboardaccess.PERMISSION_EDIT),
				Federated:  []*resourcepb.ResourceKey{folderKey},
			},
		},
		"admin permission": {
			queryString: "permission=ADMIN",
			expected: &resourcepb.ResourceSearchRequest{
				Options:    &resourcepb.ListOptions{Key: dashboardKey},
				Query:      "",
				Limit:      50,
				Offset:     0,
				Page:       1,
				Explain:    false,
				Fields:     defaultFields,
				Permission: int64(dashboardaccess.PERMISSION_ADMIN),
				Federated:  []*resourcepb.ResourceKey{folderKey},
			},
		},
		"type dashboard only": {
			queryString: "type=dashboard",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{Key: dashboardKey},
				Query:   "",
				Limit:   50,
				Offset:  0,
				Page:    1,
				Explain: false,
				Fields:  defaultFields,
			},
		},
		"type folder only": {
			queryString: "type=folder",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{Key: folderKey},
				Query:   "",
				Limit:   50,
				Offset:  0,
				Page:    1,
				Explain: false,
				Fields:  defaultFields,
			},
		},
		"both types should include federated": {
			queryString: "type=dashboard&type=folder",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"sort ascending": {
			queryString: "sort=title",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				SortBy:    []*resourcepb.ResourceSearchRequest_Sort{{Field: "title", Desc: false}},
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"sort descending": {
			queryString: "sort=-title",
			expected: &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: dashboardKey},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				SortBy:    []*resourcepb.ResourceSearchRequest_Sort{{Field: "title", Desc: true}},
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"facet fields": {
			queryString: "facet=tags&facet=folder",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{Key: dashboardKey},
				Query:   "",
				Limit:   50,
				Offset:  0,
				Page:    1,
				Explain: false,
				Fields:  defaultFields,
				Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
					"tags":   {Field: "tags", Limit: 50},
					"folder": {Field: "folder", Limit: 50},
				},
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"tag filter": {
			queryString: "tag=tag1&tag=tag2",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    dashboardKey,
					Fields: []*resourcepb.Requirement{{Key: "tags", Operator: "=", Values: []string{"tag1", "tag2"}}},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"folder filter": {
			queryString: "folder=my-folder",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    dashboardKey,
					Fields: []*resourcepb.Requirement{{Key: "folder", Operator: "=", Values: []string{"my-folder"}}},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"tag and folder filter together": {
			queryString: "tag=tag1&tag=tag2&folder=my-folder",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: dashboardKey,
					Fields: []*resourcepb.Requirement{
						{Key: "tags", Operator: "=", Values: []string{"tag1", "tag2"}},
						{Key: "folder", Operator: "=", Values: []string{"my-folder"}},
					},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"root folder should be converted to empty string": {
			queryString: "folder=general",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    dashboardKey,
					Fields: []*resourcepb.Requirement{{Key: "folder", Operator: "=", Values: []string{""}}},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"shared with me folder with dashboards": {
			queryString:      "folder=sharedwithme",
			sharedDashboards: []string{"dash1", "dash2", "dash3"},
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    dashboardKey,
					Fields: []*resourcepb.Requirement{{Key: "name", Operator: "in", Values: []string{"dash1", "dash2", "dash3"}}},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"shared with me folder without dashboards returns error": {
			queryString:      "folder=sharedwithme",
			sharedDashboards: []string{},
			expectedError:    errEmptyResults,
		},
		"name filter": {
			queryString: "name=name1&name=name2",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    dashboardKey,
					Fields: []*resourcepb.Requirement{{Key: "name", Operator: "in", Values: []string{"name1", "name2"}}},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"comprehensive filter with query, tags, folder, and name": {
			queryString: "query=search-term&tag=monitoring&tag=prod&folder=my-folder&name=dash1&name=dash2",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: dashboardKey,
					Fields: []*resourcepb.Requirement{
						{Key: "tags", Operator: "=", Values: []string{"monitoring", "prod"}},
						{Key: "folder", Operator: "=", Values: []string{"my-folder"}},
						{Key: "name", Operator: "in", Values: []string{"dash1", "dash2"}},
					},
				},
				Query:     "search-term",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"libraryPanel filter": {
			queryString: "libraryPanel=panel1&libraryPanel=panel2",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    dashboardKey,
					Fields: []*resourcepb.Requirement{{Key: "reference.LibraryPanel", Operator: "=", Values: []string{"panel1", "panel2"}}},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
		"libraryPanel and tag filter together": {
			queryString: "libraryPanel=panel1&tag=monitoring&tag=prod",
			expected: &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: dashboardKey,
					Fields: []*resourcepb.Requirement{
						{Key: "tags", Operator: "=", Values: []string{"monitoring", "prod"}},
						{Key: "reference.LibraryPanel", Operator: "=", Values: []string{"panel1"}},
					},
				},
				Query:     "",
				Limit:     50,
				Offset:    0,
				Page:      1,
				Explain:   false,
				Fields:    defaultFields,
				Federated: []*resourcepb.ResourceKey{folderKey},
			},
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			queryParams, err := url.ParseQuery(tt.queryString)
			require.NoError(t, err)

			getDashboardsFunc := func() ([]string, error) {
				if tt.sharedDashboardsError != nil {
					return nil, tt.sharedDashboardsError
				}
				return tt.sharedDashboards, nil
			}

			result, err := convertHttpSearchRequestToResourceSearchRequest(queryParams, testUser, getDashboardsFunc)

			if tt.expectedError != nil {
				assert.ErrorIs(t, err, tt.expectedError)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// MockClient implements the ResourceIndexClient interface for testing
type MockClient struct {
	resourcepb.ResourceIndexClient
	resource.ResourceIndex

	// Capture the last SearchRequest for assertions
	LastSearchRequest *resourcepb.ResourceSearchRequest

	MockResponses []*resourcepb.ResourceSearchResponse
	MockCalls     []*resourcepb.ResourceSearchRequest
	CallCount     int
}

type MockResult struct {
	Name     string
	Resource string
	Value    string
}

var mockResults = []MockResult{
	{
		Name:     "d1",
		Resource: "dashboard",
		Value:    "Dashboard 1",
	},
	{
		Name:     "d2",
		Resource: "dashboard",
		Value:    "Dashboard 2",
	},
	{
		Name:     "f1",
		Resource: "folder",
		Value:    "Folder 1",
	},
	{
		Name:     "f2",
		Resource: "folder",
		Value:    "Folder 2",
	},
}

func (m *MockClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	m.LastSearchRequest = in
	m.MockCalls = append(m.MockCalls, in)

	var response *resourcepb.ResourceSearchResponse
	if m.CallCount < len(m.MockResponses) {
		response = m.MockResponses[m.CallCount]
	}

	m.CallCount = m.CallCount + 1

	return response, nil
}
func (m *MockClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}
func (m *MockClient) CountManagedObjects(ctx context.Context, in *resourcepb.CountManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.CountManagedObjectsResponse, error) {
	return nil, nil
}
func (m *MockClient) Watch(ctx context.Context, in *resourcepb.WatchRequest, opts ...grpc.CallOption) (resourcepb.ResourceStore_WatchClient, error) {
	return nil, nil
}
func (m *MockClient) Delete(ctx context.Context, in *resourcepb.DeleteRequest, opts ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	return nil, nil
}
func (m *MockClient) Create(ctx context.Context, in *resourcepb.CreateRequest, opts ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	return nil, nil
}
func (m *MockClient) Update(ctx context.Context, in *resourcepb.UpdateRequest, opts ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	return nil, nil
}
func (m *MockClient) Read(ctx context.Context, in *resourcepb.ReadRequest, opts ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return nil, nil
}
func (m *MockClient) GetBlob(ctx context.Context, in *resourcepb.GetBlobRequest, opts ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	return nil, nil
}
func (m *MockClient) PutBlob(ctx context.Context, in *resourcepb.PutBlobRequest, opts ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	return nil, nil
}
func (m *MockClient) List(ctx context.Context, in *resourcepb.ListRequest, opts ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return nil, nil
}
func (m *MockClient) ListManagedObjects(ctx context.Context, in *resourcepb.ListManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.ListManagedObjectsResponse, error) {
	return nil, nil
}
func (m *MockClient) IsHealthy(ctx context.Context, in *resourcepb.HealthCheckRequest, opts ...grpc.CallOption) (*resourcepb.HealthCheckResponse, error) {
	return nil, nil
}
func (m *MockClient) BulkProcess(ctx context.Context, opts ...grpc.CallOption) (resourcepb.BulkStore_BulkProcessClient, error) {
	return nil, nil
}
func (m *MockClient) UpdateIndex(ctx context.Context, reason string) error {
	return nil
}

func (m *MockClient) GetQuotaUsage(ctx context.Context, req *resourcepb.QuotaUsageRequest, opts ...grpc.CallOption) (*resourcepb.QuotaUsageResponse, error) {
	return nil, nil
}
