package display

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	authlib "github.com/grafana/authlib/types"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestGetDisplayListSearchErrors(t *testing.T) {
	plainErr := errors.New("index down")
	for name, input := range map[string]struct {
		resp *resourcepb.ResourceSearchResponse
		err  error
	}{
		"embedded": {resp: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{
			Code: http.StatusServiceUnavailable, Message: "index unavailable",
		}}},
		"transport": {err: status.Error(codes.Unavailable, "index unavailable")},
		"plain":     {err: plainErr},
	} {
		t.Run(name, func(t *testing.T) {
			client := resource.NewMockResourceClient(t)
			client.EXPECT().Search(mock.Anything, mock.Anything).Return(input.resp, input.err).Twice()
			provider := NewSearchDisplayProvider(client)
			result, err := provider.GetDisplayList(t.Context(), authlib.NamespaceInfo{Value: "stacks-1"}, []string{"user:user-1"})
			require.Nil(t, result)
			if name == "plain" {
				require.ErrorIs(t, err, plainErr)
			} else {
				require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
			}
		})
	}
}

func TestBuildSearchJobsRequestsFieldValues(t *testing.T) {
	provider := &SearchDisplayProvider{}
	jobs := provider.buildSearchJobs(authlib.NamespaceInfo{Value: "stacks-1"}, dispKeys{
		uids: []string{"user-1"},
		ids:  []int64{42},
	})

	require.Len(t, jobs, 4)
	for _, job := range jobs {
		require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, job.req.ResultFormat)
		switch job.req.Options.Key.Resource {
		case "users":
			require.Equal(t, []string{
				resource.SEARCH_FIELD_TITLE,
				builders.USER_EMAIL,
				builders.USER_LOGIN,
				resource.SEARCH_FIELD_LEGACY_ID,
			}, job.req.Fields)
		case "serviceaccounts":
			require.Equal(t, []string{
				resource.SEARCH_FIELD_TITLE,
				resource.SEARCH_FIELD_LEGACY_ID,
			}, job.req.Fields)
		default:
			t.Fatalf("unexpected resource %q", job.req.Options.Key.Resource)
		}
	}
}

func TestAppendDisplayRowsDecodesFieldValues(t *testing.T) {
	typedResponse := &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING},
			{Name: builders.USER_EMAIL, Type: resourcepb.ResourceSearchField_STRING},
			{Name: builders.USER_LOGIN, Type: resourcepb.ResourceSearchField_STRING},
			{Name: resource.SEARCH_FIELD_LEGACY_ID, Type: resourcepb.ResourceSearchField_INT64},
		},
		Rows: []*resourcepb.ResourceSearchRow{{
			Key: &resourcepb.ResourceKey{Name: "user-1"},
			Values: []*resourcepb.ResourceSearchValue{
				{FieldIndex: 0, StringValues: []string{""}},
				{FieldIndex: 1, StringValues: []string{"user@example.com"}},
				{FieldIndex: 2, StringValues: []string{"login"}},
				{FieldIndex: 3, Int64Values: []int64{42}},
			},
		}},
	}

	decode := func(response *resourcepb.ResourceSearchResponse) (*iam.DisplayList, map[string]struct{}, map[int64]struct{}) {
		list := &iam.DisplayList{}
		foundUIDs := map[string]struct{}{}
		foundIDs := map[int64]struct{}{}
		require.NoError(t, appendDisplayRows(list, response, authlib.TypeUser, foundUIDs, foundIDs))
		return list, foundUIDs, foundIDs
	}

	typedList, typedUIDs, typedIDs := decode(typedResponse)
	require.Equal(t, map[string]struct{}{"user-1": {}}, typedUIDs)
	require.Equal(t, map[int64]struct{}{42: {}}, typedIDs)
	require.Equal(t, "login", typedList.Items[0].DisplayName)
	require.Equal(t, int64(42), typedList.Items[0].InternalID)
}

func TestDecodeDisplayRowsRejectsLegacyFormats(t *testing.T) {
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		99,
	} {
		t.Run(format.String(), func(t *testing.T) {
			_, err := decodeDisplayRows(&resourcepb.ResourceSearchResponse{ResultFormat: format})
			require.ErrorContains(t, err, "unsupported search result format")
		})
	}
}
