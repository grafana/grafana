package tempo

import (
	"testing"
	"time"

	apidata "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	schemas "github.com/grafana/schemads"
	"github.com/stretchr/testify/require"
)

func TestGlobalColumnValuesErrors(t *testing.T) {
	errs := globalColumnValuesErrors([]string{tempoSpanColTraceIDHidden, "resource.service.name"}, "upstream failed")
	require.Len(t, errs, 1)
	require.Equal(t, "upstream failed", errs["resource.service.name"])

	errsOnlyFixed := globalColumnValuesErrors([]string{tempoSpanColSpanID}, "no ds")
	require.Len(t, errsOnlyFixed, 1)
	require.Equal(t, "no ds", errsOnlyFixed[""])
}

func TestSpansFixedColumnsSupportsValues(t *testing.T) {
	for _, c := range spansFixedColumns() {
		require.NotNil(t, c.SupportsValues, "column %q", c.Name)
		switch c.Name {
		case tempoSpanColName, tempoSpanColDuration:
			require.True(t, *c.SupportsValues, "column %q", c.Name)
		default:
			require.False(t, *c.SupportsValues, "column %q", c.Name)
		}
	}
}

func TestMergeSpansColumnsUnique_DropsDynamicWhenNameMatchesFixed(t *testing.T) {
	fixed := []schemas.Column{{Name: "name"}, {Name: "duration"}}
	dynamic := []schemas.Column{
		{Name: "name", Description: "dup from tags"},
		{Name: "resource.svc", Description: "ok"},
		{Name: "duration"},
	}
	got := mergeSpansColumnsUnique(fixed, dynamic)
	names := make([]string, len(got))
	for i, c := range got {
		names[i] = c.Name
	}
	require.Equal(t, []string{"name", "duration", "resource.svc"}, names)
}

func TestFlattenTempoSearchTagScopesToColumnNames(t *testing.T) {
	scopes := []tempoSearchTagScope{
		{Name: string(dataquery.TraceqlSearchScopeIntrinsic), Tags: []string{"name", "status"}},
		{Name: string(dataquery.TraceqlSearchScopeResource), Tags: []string{"service.name", "cluster"}},
		{Name: string(dataquery.TraceqlSearchScopeSpan), Tags: []string{"db"}},
	}
	got := flattenTempoSearchTagScopesToColumnNames(scopes)
	require.Equal(t, []string{
		"name",
		"resource.cluster",
		"resource.service.name",
		"span.db",
		"status",
	}, got)
}

func TestTagColumnNamesSetFromScopes(t *testing.T) {
	scopes := []tempoSearchTagScope{
		{Name: string(dataquery.TraceqlSearchScopeIntrinsic), Tags: []string{"status"}},
		{Name: string(dataquery.TraceqlSearchScopeResource), Tags: []string{"service.name"}},
	}
	set := tagColumnNamesSetFromScopes(scopes)
	_, hasStatus := set["status"]
	_, hasSvc := set["resource.service.name"]
	require.True(t, hasStatus)
	require.True(t, hasSvc)
	_, hasUnknown := set["not.a.tag"]
	require.False(t, hasUnknown)
}

func TestFlattenTempoSearchTagScopesToColumnNames_Dedupes(t *testing.T) {
	scopes := []tempoSearchTagScope{
		{Name: string(dataquery.TraceqlSearchScopeIntrinsic), Tags: []string{"name"}},
		{Name: string(dataquery.TraceqlSearchScopeIntrinsic), Tags: []string{"name", "status"}},
	}
	got := flattenTempoSearchTagScopesToColumnNames(scopes)
	require.Equal(t, []string{"name", "status"}, got)
}

func TestParseFlexibleTimeForTagValues(t *testing.T) {
	ts, err := parseFlexibleTimeForTagValues("2024-01-02T15:04:05Z")
	require.NoError(t, err)
	require.Equal(t, time.Date(2024, 1, 2, 15, 4, 5, 0, time.UTC), ts.UTC())

	ms, err := parseFlexibleTimeForTagValues("1704205445000")
	require.NoError(t, err)
	require.Equal(t, int64(1704205445000), ms.UnixMilli())
}

func TestTimeRangeToUnixForTempoTagAPI(t *testing.T) {
	start, end := timeRangeToUnixForTempoTagAPI(apidata.TimeRange{
		From: "2024-01-01T00:00:00Z",
		To:   "2024-01-02T00:00:00Z",
	})
	require.Equal(t, int64(1704067200), start)
	require.Equal(t, int64(1704153600), end)

	start2, end2 := timeRangeToUnixForTempoTagAPI(apidata.TimeRange{})
	require.Greater(t, end2, start2)
	require.GreaterOrEqual(t, end2-start2, int64(tempoDefaultTagValuesLookbackSec)-200)
}
