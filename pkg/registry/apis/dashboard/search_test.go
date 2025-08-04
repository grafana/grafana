package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
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

func TestSearchHandler(t *testing.T) {
	t.Run("Multiple comma separated fields will be appended to default dashboard search fields", func(t *testing.T) {
		// Create a mock client
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		// Initialize the search handler with the mock client
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?field=field1&field=field2&field=field3", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		expectedFields := []string{"title", "folder", "tags", "field1", "field2", "field3"}
		if fmt.Sprintf("%v", mockClient.LastSearchRequest.Fields) != fmt.Sprintf("%v", expectedFields) {
			t.Errorf("expected fields %v, got %v", expectedFields, mockClient.LastSearchRequest.Fields)
		}
	})

	t.Run("Single field will be appended to default dashboard search fields", func(t *testing.T) {
		// Create a mock client
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		// Initialize the search handler with the mock client
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?field=field1", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		expectedFields := []string{"title", "folder", "tags", "field1"}
		if fmt.Sprintf("%v", mockClient.LastSearchRequest.Fields) != fmt.Sprintf("%v", expectedFields) {
			t.Errorf("expected fields %v, got %v", expectedFields, mockClient.LastSearchRequest.Fields)
		}
	})

	t.Run("Passing no fields will search using default dashboard fields", func(t *testing.T) {
		// Create a mock client
		mockClient := &MockClient{}

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
		expectedFields := []string{"title", "folder", "tags"}
		if fmt.Sprintf("%v", mockClient.LastSearchRequest.Fields) != fmt.Sprintf("%v", expectedFields) {
			t.Errorf("expected fields %v, got %v", expectedFields, mockClient.LastSearchRequest.Fields)
		}
	})

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
	t.Run("should bail out if FlagUnifiedStorageSearchPermissionFiltering is not enabled globally", func(t *testing.T) {
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
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		assert.Equal(t, mockClient.CallCount, 0)
	})

	t.Run("should return empty result without searching if user does not have shared dashboards", func(t *testing.T) {
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering)
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

		features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering)
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

		features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering)
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
