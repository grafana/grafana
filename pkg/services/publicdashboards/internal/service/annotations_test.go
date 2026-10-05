package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestUnmarshalDashboardAnnotations(t *testing.T) {
	t.Run("v1 and v2 panel filters keep IDs above 255", func(t *testing.T) {
		tests := []struct {
			name string
			data string
		}{
			{
				name: "v1",
				data: `{"annotations": {"list": [
					{"name": "a", "enable": true, "iconColor": "red", "datasource": {"uid": "grafana", "type": "grafana"},
						"filter": {"exclude": true, "ids": [3, 300, 70000]}}
				]}}`,
			},
			{
				name: "v2beta1",
				data: `{"elements": {}, "annotations": [
					{"kind": "AnnotationQuery", "spec": {"name": "a", "enable": true, "iconColor": "red",
						"filter": {"exclude": true, "ids": [3, 300, 70000]},
						"query": {"kind": "DataQuery", "group": "grafana", "datasource": {"name": "grafana"}, "spec": {}}}}
				]}`,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				sj, err := simplejson.NewJson([]byte(tt.data))
				require.NoError(t, err)

				dto, err := UnmarshalDashboardAnnotations(sj)
				require.NoError(t, err)
				require.Len(t, dto.Annotations.List, 1)

				anno := dto.Annotations.List[0]
				assert.Equal(t, "a", anno.Name)
				assert.Equal(t, "grafana", *anno.Datasource.Uid)
				assert.Equal(t, "grafana", *anno.Datasource.Type)
				require.NotNil(t, anno.Filter)
				assert.True(t, *anno.Filter.Exclude)
				assert.Equal(t, []int64{3, 300, 70000}, anno.Filter.Ids)
			})
		}
	})

	t.Run("v2 built-in annotation without a datasource reference resolves to the grafana datasource", func(t *testing.T) {
		sj, err := simplejson.NewJson([]byte(`{"elements": {}, "annotations": [
			{"kind": "AnnotationQuery", "spec": {"name": "built-in", "enable": true, "iconColor": "red", "builtIn": true,
				"query": {"kind": "DataQuery", "group": "grafana", "spec": {"limit": 7, "type": "dashboard"}}}}
		]}`))
		require.NoError(t, err)

		dto, err := UnmarshalDashboardAnnotations(sj)
		require.NoError(t, err)
		require.Len(t, dto.Annotations.List, 1)
		anno := dto.Annotations.List[0]
		assert.Equal(t, "grafana", *anno.Datasource.Uid)
		assert.Equal(t, "grafana", *anno.Datasource.Type)
		require.NotNil(t, anno.Target)
		assert.Equal(t, int64(7), anno.Target.Limit)
	})

	t.Run("v2 grafana annotation with an invalid query is skipped and the rest are kept", func(t *testing.T) {
		sj, err := simplejson.NewJson([]byte(`{"elements": {}, "annotations": [
			{"kind": "AnnotationQuery", "spec": {"name": "bad", "enable": true, "iconColor": "red",
				"query": {"kind": "DataQuery", "group": "grafana", "datasource": {"name": "grafana"}, "spec": {"limit": "ten", "tags": "x"}}}},
			{"kind": "AnnotationQuery", "spec": {"name": "good", "enable": true, "iconColor": "red",
				"query": {"kind": "DataQuery", "group": "grafana", "datasource": {"name": "grafana"}, "spec": {"limit": 10, "type": "tags", "tags": ["a"]}}}}
		]}`))
		require.NoError(t, err)

		dto, err := UnmarshalDashboardAnnotations(sj)
		require.NoError(t, err)
		require.Len(t, dto.Annotations.List, 1)
		assert.Equal(t, "good", dto.Annotations.List[0].Name)
		assert.Equal(t, []string{"a"}, dto.Annotations.List[0].Target.Tags)
	})

	t.Run("dashboard without an annotations key yields an empty list", func(t *testing.T) {
		sj, err := simplejson.NewJson([]byte(`{"title": "no annotations", "panels": []}`))
		require.NoError(t, err)

		dto, err := UnmarshalDashboardAnnotations(sj)
		require.NoError(t, err)
		assert.Empty(t, dto.Annotations.List)
	})

	t.Run("v2 dashboard without annotations yields an empty list", func(t *testing.T) {
		sj, err := simplejson.NewJson([]byte(`{"elements": {}, "annotations": []}`))
		require.NoError(t, err)

		dto, err := UnmarshalDashboardAnnotations(sj)
		require.NoError(t, err)
		assert.Empty(t, dto.Annotations.List)
	})
}
