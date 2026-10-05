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

	t.Run("v2 dashboard without annotations yields an empty list", func(t *testing.T) {
		sj, err := simplejson.NewJson([]byte(`{"elements": {}, "annotations": []}`))
		require.NoError(t, err)

		dto, err := UnmarshalDashboardAnnotations(sj)
		require.NoError(t, err)
		assert.Empty(t, dto.Annotations.List)
	})
}
