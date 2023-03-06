package querylibrary_tests

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/querylibrary"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
)

func TestIntegrationCreateAndDelete(t *testing.T) {
	if true {
		// TODO: re-enable after fixing its flakiness
		t.Skip()
	}

	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()

	testCtx := createTestContext(t)

	err := testCtx.client.update(ctx, &querylibrary.Query{
		UID:         "",
		Title:       "first query",
		Tags:        []string{},
		Description: "",
		Time: querylibrary.Time{
			From: "now-15m",
			To:   "now-30m",
		},
		Queries: []*simplejson.Json{
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]string{
					"uid":  grafanads.DatasourceUID,
					"type": "datasource",
				},
				"queryType": "randomWalk",
				"refId":     "A",
			}),
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]string{
					"uid":  grafanads.DatasourceUID,
					"type": "datasource",
				},
				"queryType": "list",
				"path":      "img",
				"refId":     "B",
			}),
		},
		Variables: []*simplejson.Json{},
	})
	require.NoError(t, err)

	search, err := testCtx.client.search(ctx, querylibrary.QuerySearchOptions{
		Query: "",
	})
	require.NoError(t, err)
	require.Len(t, search, 1)

	info := search[0]
	require.Equal(t, "query", info.kind)
	require.Equal(t, "first query", info.name)
	require.Equal(t, "General", info.location)
	require.Equal(t, []string{grafanads.DatasourceUID, grafanads.DatasourceUID}, info.dsUIDs)

	err = testCtx.client.delete(ctx, info.uid)
	require.NoError(t, err)

	search, err = testCtx.client.search(ctx, querylibrary.QuerySearchOptions{
		Query: "",
	})
	require.NoError(t, err)
	require.Len(t, search, 0)

	query, err := testCtx.client.get(ctx, info.uid)
	require.NoError(t, err)
	require.Nil(t, query)
}

func createQuery(t *testing.T, ctx context.Context, testCtx testContext) string {
	t.Helper()

	err := testCtx.client.update(ctx, &querylibrary.Query{
		UID:         "",
		Title:       "first query",
		Tags:        []string{},
		Description: "",
		Time: querylibrary.Time{
			From: "now-15m",
			To:   "now-30m",
		},
		Queries: []*simplejson.Json{
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]string{
					"uid":  grafanads.DatasourceUID,
					"type": "datasource",
				},
				"queryType": "randomWalk",
				"refId":     "A",
			}),
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]string{
					"uid":  grafanads.DatasourceUID,
					"type": "datasource",
				},
				"queryType": "list",
				"path":      "img",
				"refId":     "B",
			}),
		},
		Variables: []*simplejson.Json{},
	})
	require.NoError(t, err)

	search, err := testCtx.client.search(ctx, querylibrary.QuerySearchOptions{
		Query: "",
	})
	require.NoError(t, err)
	require.Len(t, search, 1)
	return search[0].uid
}

func TestIntegrationDashboardGetWithLatestSavedQueries(t *testing.T) {
	if true {
		// TODO: re-enable after fixing its flakiness
		t.Skip()
	}

	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()

	testCtx := createTestContext(t)

	queryUID := createQuery(t, ctx, testCtx)

	dashUID, err := testCtx.client.createDashboard(ctx, simplejson.NewFromAny(map[string]interface{}{
		"dashboard": map[string]interface{}{
			"title": "my-new-dashboard",
			"panels": []interface{}{
				map[string]interface{}{
					"id": int64(1),
					"gridPos": map[string]interface{}{
						"h": 6,
						"w": 6,
						"x": 0,
						"y": 0,
					},
				},
				map[string]interface{}{
					"id": int64(2),
					"gridPos": map[string]interface{}{
						"h": 6,
						"w": 6,
						"x": 6,
						"y": 0,
					},
					"savedQueryLink": map[string]interface{}{
						"ref": map[string]string{
							"uid": queryUID,
						},
					},
				},
			},
		},
		"folderId":  0,
		"message":   "",
		"overwrite": true,
	}))
	require.NoError(t, err)

	dashboard, err := testCtx.client.getDashboard(ctx, dashUID)
	require.NoError(t, err)

	panelsAsArray, err := dashboard.Dashboard.Get("panels").Array()
	require.NoError(t, err)

	require.Len(t, panelsAsArray, 2)

	secondPanel := simplejson.NewFromAny(panelsAsArray[1])
	require.Equal(t, []interface{}{
		map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid":  grafanads.DatasourceUID,
				"type": "datasource",
			},
			"queryType": "randomWalk",
			"refId":     "A",
		},
		map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid":  grafanads.DatasourceUID,
				"type": "datasource",
			},
			"queryType": "list",
			"path":      "img",
			"refId":     "B",
		},
	}, secondPanel.Get("targets").MustArray())
	require.Equal(t, map[string]interface{}{
		"uid":  grafanads.DatasourceUID,
		"type": "datasource",
	}, secondPanel.Get("datasource").MustMap())

	// update, expect changes when getting dashboards
	err = testCtx.client.update(ctx, &querylibrary.Query{
		UID:         queryUID,
		Title:       "first query",
		Tags:        []string{},
		Description: "",
		Time: querylibrary.Time{
			From: "now-15m",
			To:   "now-30m",
		},
		Queries: []*simplejson.Json{
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid":  grafanads.DatasourceUID,
					"type": "datasource",
				},
				"queryType": "randomWalk",
				"refId":     "A",
			}),
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid":  "different-datasource-uid",
					"type": "datasource",
				},
				"queryType": "randomWalk",
				"path":      "img",
				"refId":     "B",
			}),
			simplejson.NewFromAny(map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid":  "different-datasource-uid-2",
					"type": "datasource",
				},
				"queryType": "randomWalk",
				"path":      "img",
				"refId":     "C",
			}),
		},
		Variables: []*simplejson.Json{},
	})
	require.NoError(t, err)

	dashboard, err = testCtx.client.getDashboard(ctx, dashUID)
	require.NoError(t, err)

	panelsAsArray, err = dashboard.Dashboard.Get("panels").Array()
	require.NoError(t, err)

	require.Len(t, panelsAsArray, 2)

	secondPanel = simplejson.NewFromAny(panelsAsArray[1])
	require.Equal(t, []interface{}{
		map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid":  grafanads.DatasourceUID,
				"type": "datasource",
			},
			"queryType": "randomWalk",
			"refId":     "A",
		},
		map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid":  "different-datasource-uid",
				"type": "datasource",
			},
			"queryType": "randomWalk",
			"path":      "img",
			"refId":     "B",
		},
		map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid":  "different-datasource-uid-2",
				"type": "datasource",
			},
			"queryType": "randomWalk",
			"path":      "img",
			"refId":     "C",
		},
	}, secondPanel.Get("targets").MustArray())
	require.Equal(t, map[string]interface{}{
		"uid":  "-- Mixed --",
		"type": "datasource",
	}, secondPanel.Get("datasource").MustMap())
}
