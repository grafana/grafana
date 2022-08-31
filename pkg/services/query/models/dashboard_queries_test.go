package query

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/require"
)

const (
	dashboardWithNoQueries = `
{
  "panels": [
    {
      "id": 2,
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithTargetsWithNoDatasources = `
{
  "panels": [
    {
      "id": 2,
      "datasource": {
          "type": "postgres",
          "uid": "abc123"
      },
      "targets": [
        {
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        },
        {
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithQueries = `
{
  "panels": [
    {
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "promds2"
          },
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithQueriesAndExpression = `
{
  "panels": [
    {
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        },
		{
          "datasource": {
            "name": "Expression",
            "type": "__expr__",
            "uid": "__expr__"
          },
          "expression": "$A + 1",
          "hide": false,
          "refId": "EXPRESSION",
          "type": "math"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "promds2"
          },
          "exemplar": true,
          "expr": "query2",
          "interval": "",
          "legendFormat": "",
          "refId": "B"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithMixedDatasource = `
{
  "panels": [
    {
	  "datasource": {
		"type": "datasource",
		"uid": "-- Mixed --"
	  },
      "id": 1,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "abc123"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 3,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	dashboardWithDuplicateDatasources = `
{
  "panels": [
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "abc123"
	  },
      "id": 1,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "abc123"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 2,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    },
    {
	  "datasource": {
		"type": "prometheus",
		"uid": "_yxMP8Ynk"
	  },
      "id": 3,
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "_yxMP8Ynk"
          },
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 35
}`

	oldStyleDashboard = `
{
  "panels": [
    {
	  "datasource": "_yxMP8Ynk",
      "id": 2,
      "targets": [
        {
          "exemplar": true,
          "expr": "go_goroutines{job=\"$job\"}",
          "interval": "",
          "legendFormat": "",
          "refId": "A"
        }
      ],
      "title": "Panel Title",
      "type": "timeseries"
    }
  ],
  "schemaVersion": 21
}`
)

func TestGetUniqueDashboardDatasourceUids(t *testing.T) {
	t.Run("can get unique datasource ids from dashboard", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithDuplicateDatasources))
		require.NoError(t, err)

		uids := GetUniqueDashboardDatasourceUids(json)
		require.Len(t, uids, 2)
		require.Equal(t, "abc123", uids[0])
		require.Equal(t, "_yxMP8Ynk", uids[1])
	})

	t.Run("can get unique datasource ids from dashboard with a mixed datasource", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithMixedDatasource))
		require.NoError(t, err)

		uids := GetUniqueDashboardDatasourceUids(json)
		require.Len(t, uids, 2)
		require.Equal(t, "abc123", uids[0])
		require.Equal(t, "_yxMP8Ynk", uids[1])
	})

	t.Run("can get no datasource uids from empty dashboard", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(`{"panels": {}}`))
		require.NoError(t, err)

		uids := GetUniqueDashboardDatasourceUids(json)
		require.Len(t, uids, 0)
	})
}

func TestHasExpressionQuery(t *testing.T) {
	t.Run("will return true when expression query exists", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithQueriesAndExpression))
		require.NoError(t, err)

		queries := GroupQueriesByPanelId(json)
		panelId := int64(2)
		require.True(t, HasExpressionQuery(queries[panelId]))
	})
	t.Run("will return false when no expression query exists", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithMixedDatasource))
		require.NoError(t, err)

		queries := GroupQueriesByPanelId(json)
		panelId := int64(2)
		require.False(t, HasExpressionQuery(queries[panelId]))
	})
}

func TestGroupQueriesByPanelId(t *testing.T) {
	t.Run("can extract queries from dashboard with panel datasource string that has no datasource on panel targets", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(oldStyleDashboard))
		require.NoError(t, err)
		queries := GroupQueriesByPanelId(json)

		panelId := int64(2)
		queriesByDatasource := GroupQueriesByDataSource(queries[panelId])
		require.Len(t, queriesByDatasource[0], 1)
	})
	t.Run("can extract queries from dashboard with panel json datasource that has no datasource on panel targets", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithTargetsWithNoDatasources))
		require.NoError(t, err)
		queries := GroupQueriesByPanelId(json)

		panelId := int64(2)
		queriesByDatasource := GroupQueriesByDataSource(queries[panelId])
		require.Len(t, queriesByDatasource[0], 2)
	})
	t.Run("can extract no queries from empty dashboard", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(`{"panels": {}}`))
		require.NoError(t, err)

		queries := GroupQueriesByPanelId(json)
		require.Len(t, queries, 0)
	})

	t.Run("can extract no queries from empty panel", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithNoQueries))
		require.NoError(t, err)

		queries := GroupQueriesByPanelId(json)
		require.Len(t, queries, 1)
		require.Contains(t, queries, int64(2))
		require.Len(t, queries[2], 0)
	})

	t.Run("can extract queries from panels", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(dashboardWithQueries))
		require.NoError(t, err)

		queries := GroupQueriesByPanelId(json)
		require.Len(t, queries, 1)
		require.Contains(t, queries, int64(2))
		require.Len(t, queries[2], 2)
		query, err := queries[2][0].MarshalJSON()
		require.NoError(t, err)
		require.JSONEq(t, `{
            "datasource": {
              "type": "prometheus",
              "uid": "_yxMP8Ynk"
            },
            "exemplar": true,
            "expr": "go_goroutines{job=\"$job\"}",
            "interval": "",
            "legendFormat": "",
            "refId": "A"
		}`, string(query))
		query, err = queries[2][1].MarshalJSON()
		require.NoError(t, err)
		require.JSONEq(t, `{
            "datasource": {
              "type": "prometheus",
              "uid": "promds2"
            },
            "exemplar": true,
            "expr": "query2",
            "interval": "",
            "legendFormat": "",
            "refId": "B"
		}`, string(query))
	})

	t.Run("can extract queries from old-style panels", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(oldStyleDashboard))
		require.NoError(t, err)

		queries := GroupQueriesByPanelId(json)
		require.Len(t, queries, 1)
		require.Contains(t, queries, int64(2))
		require.Len(t, queries[2], 1)
		query, err := queries[2][0].MarshalJSON()
		require.NoError(t, err)
		require.JSONEq(t, `{
            "datasource": {
				"uid": "_yxMP8Ynk",
				"type": "public-ds"
			},
            "exemplar": true,
            "expr": "go_goroutines{job=\"$job\"}",
            "interval": "",
            "legendFormat": "",
            "refId": "A"
		}`, string(query))
	})
}

func TestGroupQueriesByDataSource(t *testing.T) {
	t.Run("can divide queries by datasource", func(t *testing.T) {
		queries := []*simplejson.Json{
			simplejson.MustJson([]byte(`{
				"datasource": {
					"type": "prometheus",
					"uid": "_yxMP8Ynk"
				},
				"exemplar": true,
				"expr": "go_goroutines{job=\"$job\"}",
				"interval": "",
				"legendFormat": "",
				"refId": "A"
			}`)),
			simplejson.MustJson([]byte(`{
				"datasource": {
					"type": "prometheus",
					"uid": "promds2"
				},
				"exemplar": true,
				"expr": "query2",
				"interval": "",
				"legendFormat": "",
				"refId": "B"
			}`)),
		}

		queriesByDatasource := GroupQueriesByDataSource(queries)
		require.Len(t, queriesByDatasource, 2)
		require.Contains(t, queriesByDatasource, []*simplejson.Json{simplejson.MustJson([]byte(`{
            "datasource": {
              "type": "prometheus",
              "uid": "_yxMP8Ynk"
            },
            "exemplar": true,
            "expr": "go_goroutines{job=\"$job\"}",
            "interval": "",
            "legendFormat": "",
            "refId": "A"
		}`))})
		require.Contains(t, queriesByDatasource, []*simplejson.Json{simplejson.MustJson([]byte(`{
            "datasource": {
              "type": "prometheus",
              "uid": "promds2"
            },
            "exemplar": true,
            "expr": "query2",
            "interval": "",
            "legendFormat": "",
            "refId": "B"
		}`))})
	})
}
