package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/validation/field"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestTranslateGlobalHybridSearchTargets(t *testing.T) {
	dashboards := searchv0.HybridSearchResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	folders := searchv0.HybridSearchResource{Group: "folder.grafana.app", Resource: "folders"}
	for _, tc := range []struct {
		name      string
		resources []searchv0.HybridSearchResource
		field     string
		errorType field.ErrorType
	}{
		{name: "missing targets", field: "resources", errorType: field.ErrorTypeRequired},
		{name: "empty targets", resources: []searchv0.HybridSearchResource{}, field: "resources", errorType: field.ErrorTypeRequired},
		{name: "missing group", resources: []searchv0.HybridSearchResource{{Resource: "dashboards"}}, field: "resources[0].group", errorType: field.ErrorTypeRequired},
		{name: "blank group", resources: []searchv0.HybridSearchResource{{Group: " \t", Resource: "dashboards"}}, field: "resources[0].group", errorType: field.ErrorTypeRequired},
		{name: "missing resource", resources: []searchv0.HybridSearchResource{{Group: "dashboard.grafana.app"}}, field: "resources[0].resource", errorType: field.ErrorTypeRequired},
		{name: "blank resource", resources: []searchv0.HybridSearchResource{{Group: "dashboard.grafana.app", Resource: " \t"}}, field: "resources[0].resource", errorType: field.ErrorTypeRequired},
		{name: "uppercase group", resources: []searchv0.HybridSearchResource{{Group: "Dashboard.grafana.app", Resource: "dashboards"}}, field: "resources[0].group", errorType: field.ErrorTypeInvalid},
		{name: "uppercase resource", resources: []searchv0.HybridSearchResource{{Group: "dashboard.grafana.app", Resource: "Dashboards"}}, field: "resources[0].resource", errorType: field.ErrorTypeInvalid},
		{name: "padded group", resources: []searchv0.HybridSearchResource{{Group: " dashboard.grafana.app", Resource: "dashboards"}}, field: "resources[0].group", errorType: field.ErrorTypeInvalid},
		{name: "padded resource", resources: []searchv0.HybridSearchResource{{Group: "dashboard.grafana.app", Resource: "dashboards\t"}}, field: "resources[0].resource", errorType: field.ErrorTypeInvalid},
		{name: "duplicate targets", resources: []searchv0.HybridSearchResource{dashboards, folders, dashboards}, field: "resources[2]", errorType: field.ErrorTypeDuplicate},
		{name: "single target", resources: []searchv0.HybridSearchResource{dashboards}},
		{name: "multiple targets", resources: []searchv0.HybridSearchResource{folders, dashboards}},
		{name: "same resource in distinct groups", resources: []searchv0.HybridSearchResource{dashboards, {Group: "other.grafana.app", Resource: "dashboards"}}},
		{name: "external collection name", resources: []searchv0.HybridSearchResource{{Group: "example.ext.grafana.app", Resource: "alert_rules-v2"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := hybridQuery()
			q.Resources = tc.resources
			req, errs := TranslateGlobalHybridSearchQuery(q, "tenant-a")
			if tc.field != "" {
				require.Nil(t, req)
				require.Len(t, errs, 1)
				assert.Equal(t, tc.field, errs[0].Field)
				assert.Equal(t, tc.errorType, errs[0].Type)
				return
			}
			require.Empty(t, errs)
			require.NotNil(t, req)
			assert.Nil(t, req.Key) //nolint:staticcheck // Global search must not use the legacy selector.
			assert.Equal(t, "tenant-a", req.Namespace)
			assert.True(t, req.RequireHybridEnabled)
			require.Len(t, req.Resources, len(tc.resources))
			for i, target := range tc.resources {
				assert.Equal(t, target.Group, req.Resources[i].Group)
				assert.Equal(t, target.Resource, req.Resources[i].Resource)
			}
		})
	}
}

func TestTranslateHybridSearchRejectsResourceTargets(t *testing.T) {
	for _, tc := range []struct {
		name      string
		resources []searchv0.HybridSearchResource
	}{
		{name: "empty list", resources: []searchv0.HybridSearchResource{}},
		{name: "same target", resources: []searchv0.HybridSearchResource{{Group: "dashboard.grafana.app", Resource: "dashboards"}}},
		{name: "different target", resources: []searchv0.HybridSearchResource{{Group: "folder.grafana.app", Resource: "folders"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := hybridQuery()
			q.Resources = tc.resources
			req, errs := TranslateHybridSearchQuery(q, dashboardsGVR, "tenant-a")
			require.Nil(t, req)
			require.Len(t, errs, 1)
			assert.Equal(t, "resources", errs[0].Field)
			assert.Equal(t, field.ErrorTypeForbidden, errs[0].Type)
		})
	}
}

func TestTranslateGlobalHybridSearchFilters(t *testing.T) {
	dashboards := searchv0.HybridSearchResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	folders := searchv0.HybridSearchResource{Group: "folder.grafana.app", Resource: "folders"}
	for _, tc := range []struct {
		name      string
		resources []searchv0.HybridSearchResource
		filter    searchv0.HybridSearchFilter
		valid     bool
	}{
		{"multiple types uid", []searchv0.HybridSearchResource{dashboards, folders}, searchv0.HybridSearchFilter{Field: "uid", Values: []string{"a", "b"}}, true},
		{"multiple types root folder", []searchv0.HybridSearchResource{dashboards, folders}, searchv0.HybridSearchFilter{Field: "folder", Values: []string{"", "general"}}, true},
		{"multiple types datasource", []searchv0.HybridSearchResource{dashboards, folders}, searchv0.HybridSearchFilter{Field: "datasource_uid", Values: []string{"ds"}}, false},
		{"multiple types language", []searchv0.HybridSearchResource{dashboards, folders}, searchv0.HybridSearchFilter{Field: "language", Values: []string{"promql"}}, false},
		{"dashboards datasource", []searchv0.HybridSearchResource{dashboards}, searchv0.HybridSearchFilter{Field: "datasource_uid", Values: []string{"ds"}}, true},
		{"dashboards language", []searchv0.HybridSearchResource{dashboards}, searchv0.HybridSearchFilter{Field: "language", Values: []string{"promql"}}, true},
		{"folders datasource", []searchv0.HybridSearchResource{folders}, searchv0.HybridSearchFilter{Field: "datasource_uid", Values: []string{"ds"}}, false},
		{"other group dashboards language", []searchv0.HybridSearchResource{{Group: "other.grafana.app", Resource: "dashboards"}}, searchv0.HybridSearchFilter{Field: "language", Values: []string{"promql"}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := hybridQuery()
			q.Resources, q.Filters = tc.resources, []searchv0.HybridSearchFilter{tc.filter}
			req, errs := TranslateGlobalHybridSearchQuery(q, "default")
			if !tc.valid {
				require.Nil(t, req)
				require.Len(t, errs, 1)
				assert.Equal(t, "filters[0].field", errs[0].Field)
				assert.Equal(t, field.ErrorTypeNotSupported, errs[0].Type)
				return
			}
			require.Empty(t, errs)
			require.NotNil(t, req)
			assert.Equal(t, []*resourcepb.Requirement{{Key: tc.filter.Field, Operator: "in", Values: tc.filter.Values}}, req.Filters)
		})
	}
}

func TestTranslateGlobalHybridSearchOptions(t *testing.T) {
	for _, tc := range []struct {
		name      string
		limit     int64
		wantLimit int64
		skip      bool
		relevance string
	}{
		{name: "defaults", wantLimit: 50},
		{name: "one merged result", limit: 1, wantLimit: 1, skip: true},
		{name: "capped merged results", limit: 201, wantLimit: 200, relevance: "high"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q := hybridQuery()
			q.Resources = []searchv0.HybridSearchResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
				{Group: "folder.grafana.app", Resource: "folders"},
			}
			q.SemanticQuery = "What is consuming CPU?"
			q.Limit, q.SkipRerank, q.MinRelevance = tc.limit, tc.skip, tc.relevance
			req, errs := TranslateGlobalHybridSearchQuery(q, "default")
			require.Empty(t, errs)
			require.NotNil(t, req)
			assert.Equal(t, tc.wantLimit, req.Limit)
			assert.Equal(t, tc.skip, req.SkipRerank)
			assert.Equal(t, tc.relevance, req.MinRelevance)
			assert.Equal(t, q.Query, req.Query)
			assert.Equal(t, q.SemanticQuery, req.SemanticQuery)
		})
	}
}
