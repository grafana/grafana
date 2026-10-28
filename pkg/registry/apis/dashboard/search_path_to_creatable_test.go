package dashboard

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// folderRows builds a folder search response whose rows are (name, title, parent) triples.
func folderRows(rows ...[3]string) *resourcepb.ResourceSearchResponse {
	resp := &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING},
			{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
		},
	}
	for _, r := range rows {
		resp.Rows = append(resp.Rows, &resourcepb.ResourceSearchRow{
			Key: &resourcepb.ResourceKey{Name: r[0], Resource: "folders"},
			Values: []*resourcepb.ResourceSearchValue{
				{FieldIndex: 0, StringValues: []string{r[1]}},
				{FieldIndex: 1, StringValues: []string{r[2]}},
			},
		})
	}
	return resp
}

func searchPathToCreatable(t *testing.T, mockClient *MockClient, target string) *v0alpha1.SearchResults {
	t.Helper()
	handler := NewSearchHandler(tracing.NewNoopTracerService(), mockClient, nil)
	req := httptest.NewRequest("GET", "/search?"+target, nil)
	req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test", OrgID: 1}))
	rr := httptest.NewRecorder()

	handler.DoSearch(rr, req)

	require.Equal(t, 200, rr.Code, rr.Body.String())
	results := &v0alpha1.SearchResults{}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(results))
	return results
}

func canCreate(hit v0alpha1.DashboardHit) (value bool, present bool) {
	if hit.Field == nil {
		return false, false
	}
	v, ok := hit.Field.UnstructuredContent()["canCreate"].(bool)
	return v, ok
}

func TestSearchHandlerPathToCreatable(t *testing.T) {
	// general > public > org > team-a (the only folder the user can create in)
	creatable := folderRows([3]string{"team-a", "Team A", "org"})
	orgLookup := folderRows([3]string{"org", "Org", "public"})
	publicLookup := folderRows([3]string{"public", "Public", ""})

	t.Run("lists only folders on the way to a creatable one", func(t *testing.T) {
		setCreateToggle(t, true)
		mockClient := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{
			creatable, orgLookup, publicLookup,
			folderRows([3]string{"org", "Org", "public"}),
		}}

		results := searchPathToCreatable(t, mockClient, "type=folder&folder=public&include=pathToCreatable")

		require.Len(t, mockClient.MockCalls, 4)
		first := mockClient.MockCalls[0]
		assert.Equal(t, int64(dashboardaccess.PERMISSION_CREATE), first.Permission)
		assert.Equal(t, "folders", first.Options.Key.Resource)
		assert.Empty(t, first.Options.Fields, "the creatable lookup spans every folder, not just the parent")

		children := mockClient.MockCalls[3]
		var names []string
		var parent string
		for _, f := range children.Options.Fields {
			switch f.Key {
			case "name":
				names = f.Values
			case "folder":
				parent = f.Values[0]
			}
		}
		assert.ElementsMatch(t, []string{"team-a", "org", "public"}, names)
		assert.Equal(t, "public", parent)

		require.Len(t, results.Hits, 1)
		assert.Equal(t, "org", results.Hits[0].Name)
		value, present := canCreate(results.Hits[0])
		assert.True(t, present)
		assert.False(t, value, "Org is only on the path")
	})

	t.Run("marks the creatable folder", func(t *testing.T) {
		setCreateToggle(t, true)
		mockClient := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{
			creatable, orgLookup, publicLookup,
			folderRows([3]string{"team-a", "Team A", "org"}),
		}}

		results := searchPathToCreatable(t, mockClient, "type=folder&folder=org&include=pathToCreatable")

		require.Len(t, results.Hits, 1)
		value, present := canCreate(results.Hits[0])
		assert.True(t, present)
		assert.True(t, value)
	})

	t.Run("returns nothing when the user can create nowhere", func(t *testing.T) {
		setCreateToggle(t, true)
		mockClient := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{folderRows()}}

		results := searchPathToCreatable(t, mockClient, "type=folder&folder=public&include=pathToCreatable")

		assert.Empty(t, results.Hits)
		assert.Len(t, mockClient.MockCalls, 1, "no children lookup when there is nothing to reach")
	})

	t.Run("does not filter when too many folders are creatable", func(t *testing.T) {
		setCreateToggle(t, true)
		many := make([][3]string, 0, pathToCreatableLimit+1)
		for i := 0; i <= pathToCreatableLimit; i++ {
			many = append(many, [3]string{fmt.Sprintf("f%d", i), "F", ""})
		}
		mockClient := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{
			folderRows(many...),
			folderRows([3]string{"org", "Org", "public"}),
		}}

		results := searchPathToCreatable(t, mockClient, "type=folder&folder=public&include=pathToCreatable")

		require.Len(t, mockClient.MockCalls, 2)
		for _, f := range mockClient.MockCalls[1].Options.Fields {
			assert.NotEqual(t, "in", f.Operator)
		}
		require.Len(t, results.Hits, 1)
		_, present := canCreate(results.Hits[0])
		assert.False(t, present, "an unfiltered result says nothing about creatability")
	})

	t.Run("is ignored while the create permission toggle is off", func(t *testing.T) {
		setCreateToggle(t, false)
		mockClient := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{
			folderRows([3]string{"org", "Org", "public"}),
		}}

		results := searchPathToCreatable(t, mockClient, "type=folder&folder=public&include=pathToCreatable")

		assert.Len(t, mockClient.MockCalls, 1)
		require.Len(t, results.Hits, 1)
	})

	t.Run("is rejected for dashboards", func(t *testing.T) {
		setCreateToggle(t, true)
		handler := NewSearchHandler(tracing.NewNoopTracerService(), &MockClient{}, nil)
		req := httptest.NewRequest("GET", "/search?type=dashboard&include=pathToCreatable", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test", OrgID: 1}))
		rr := httptest.NewRecorder()

		handler.DoSearch(rr, req)

		assert.Equal(t, 400, rr.Code)
	})
}
