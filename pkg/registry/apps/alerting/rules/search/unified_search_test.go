package search

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUnifiedBackendErrors(t *testing.T) {
	wantErr := errors.New("index unavailable")
	_, err := NewUnifiedClient(&fakeIndex{err: wantErr}).Search(t.Context(), &Query{})
	require.ErrorIs(t, err, wantErr)
	for _, perKind := range []bool{false, true} {
		backend := NewUnifiedClient(&fakeIndex{resp: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{Code: 403, Message: "forbidden"}}})
		_, err := backend.Search(t.Context(), &Query{PerKind: perKind})
		require.True(t, apierrors.IsForbidden(err))
	}
	for _, tc := range []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		want     string
	}{
		{name: "unknown format", response: &resourcepb.ResourceSearchResponse{ResultFormat: 99}, want: "unsupported search result format"},
		{name: "missing key", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: []*resourcepb.ResourceSearchRow{{}}}, want: "has no resource key"},
		{name: "nil row", response: &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: []*resourcepb.ResourceSearchRow{nil}}, want: "has no resource key"},
		{name: "column count mismatch", response: &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{{Name: fieldTitle}}, Rows: []*resourcepb.ResourceTableRow{{Key: &resourcepb.ResourceKey{Name: "a"}}},
		}}, want: "row has 0 cells but the table declares 1 columns"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result, err := NewUnifiedClient(&fakeIndex{resp: tc.response}).Search(t.Context(), &Query{PerKind: true, Fields: []string{fieldTitle}})
			require.ErrorContains(t, err, tc.want)
			require.Nil(t, result)
		})
	}
}

func TestUnifiedBackendBadCellOmitsOnlyThatField(t *testing.T) {
	for _, perKind := range []bool{false, true} {
		response := &resourcepb.ResourceSearchResponse{TotalHits: 5, TotalHitsExact: true, Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{searchColumns[fieldTitle], searchColumns[fieldPanelID]},
			Rows:    []*resourcepb.ResourceTableRow{{Key: &resourcepb.ResourceKey{Name: "a"}, Cells: [][]byte{[]byte("title"), []byte("invalid")}}},
		}}
		backend := NewUnifiedClient(&fakeIndex{resp: response})
		result, err := backend.Search(t.Context(), &Query{PerKind: perKind, Primary: alertrule.ResourceInfo.GroupResource(), Fields: []string{fieldTitle, fieldPanelID}})
		require.NoError(t, err)
		require.Equal(t, []Hit{{Name: "a", Values: map[string]any{fieldTitle: "title"}}}, result.Hits)
		require.Equal(t, int64(5), result.TotalHits)
		require.True(t, result.TotalHitsExact)
	}
}

func TestUnifiedBackendEmptyResponses(t *testing.T) {
	for _, perKind := range []bool{false, true} {
		for _, response := range []*resourcepb.ResourceSearchResponse{nil, {TotalHits: 10}} {
			result, err := NewUnifiedClient(&fakeIndex{resp: response}).Search(t.Context(), &Query{PerKind: perKind})
			require.NoError(t, err)
			require.Empty(t, result.Hits)
			require.Equal(t, response.GetTotalHits(), result.TotalHits)
		}
	}
}
