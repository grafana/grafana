package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"

	cwapi "github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueryCloudWatchMetrics(t *testing.T) {
	grafDir, cfgPath := testinfra.CreateGrafDir(t)
	sqlStore := setUpDatabase(t, grafDir)
	addr := testinfra.StartGrafana(t, grafDir, cfgPath, sqlStore)

	origNewCWClient := cloudwatch.NewCWClient
	t.Cleanup(func() {
		cloudwatch.NewCWClient = origNewCWClient
	})
	var client cloudwatch.FakeCWClient
	cloudwatch.NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
		return client
	}

	t.Run("Custom metrics", func(t *testing.T) {
		client = cloudwatch.FakeCWClient{
			Metrics: []*cwapi.Metric{
				{
					MetricName: aws.String("Test_MetricName"),
					Dimensions: []*cwapi.Dimension{
						{
							Name: aws.String("Test_DimensionName"),
						},
					},
				},
			},
		}

		req := dtos.MetricRequest{
			Queries: []*simplejson.Json{
				simplejson.NewFromAny(map[string]interface{}{
					"type":         "metricFindQuery",
					"subtype":      "metrics",
					"region":       "us-east-1",
					"namespace":    "custom",
					"datasourceId": 1,
				}),
			},
		}
		tr := makeCWRequest(t, req, addr)

		assert.Equal(t, tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				"A": {
					RefId: "A",
					Meta: simplejson.NewFromAny(map[string]interface{}{
						"rowCount": float64(1),
					}),
					Tables: []*tsdb.Table{
						{
							Columns: []tsdb.TableColumn{
								{
									Text: "text",
								},
								{
									Text: "value",
								},
							},
							Rows: []tsdb.RowValues{
								{
									"Test_MetricName",
									"Test_MetricName",
								},
							},
						},
					},
				},
			},
		}, tr)
	})
}

func TestQueryCloudWatchLogs(t *testing.T) {
	grafDir, cfgPath := testinfra.CreateGrafDir(t)
	sqlStore := setUpDatabase(t, grafDir)
	addr := testinfra.StartGrafana(t, grafDir, cfgPath, sqlStore)

	origNewCWLogsClient := cloudwatch.NewCWLogsClient
	t.Cleanup(func() {
		cloudwatch.NewCWLogsClient = origNewCWLogsClient
	})

	var client cloudwatch.FakeCWLogsClient
	cloudwatch.NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
		return client
	}

	t.Run("Describe log groups", func(t *testing.T) {
		client = cloudwatch.FakeCWLogsClient{}

		req := dtos.MetricRequest{
			Queries: []*simplejson.Json{
				simplejson.NewFromAny(map[string]interface{}{
					"type":         "logAction",
					"subtype":      "DescribeLogGroups",
					"region":       "us-east-1",
					"datasourceId": 1,
				}),
			},
		}
		tr := makeCWRequest(t, req, addr)

		dataFrames := tsdb.NewDecodedDataFrames(data.Frames{
			&data.Frame{
				Name: "logGroups",
				Fields: []*data.Field{
					data.NewField("logGroupName", nil, []*string{}),
				},
				Meta: &data.FrameMeta{
					PreferredVisualization: "logs",
				},
			},
		})
		// Have to call this so that dataFrames.encoded is non-nil, for the comparison
		// In the future we should use gocmp instead and ignore this field
		_, err := dataFrames.Encoded()
		require.NoError(t, err)
		assert.Equal(t, tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				"A": {
					RefId:      "A",
					Dataframes: dataFrames,
				},
			},
		}, tr)
	})
}

func makeCWRequest(t *testing.T, req dtos.MetricRequest, addr string) tsdb.Response {
	t.Helper()

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(&req)
	require.NoError(t, err)
	u := fmt.Sprintf("http://%s/api/ds/query", addr)
	t.Logf("Making POST request to %s", u)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() {
		err := resp.Body.Close()
		assert.NoError(t, err)
	})

	buf = bytes.Buffer{}
	_, err = io.Copy(&buf, resp.Body)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	var tr tsdb.Response
	err = json.Unmarshal(buf.Bytes(), &tr)
	require.NoError(t, err)

	return tr
}

func setUpDatabase(t *testing.T, grafDir string) *sqlstore.SQLStore {
	t.Helper()

	sqlStore := testinfra.SetUpDatabase(t, grafDir)
	err := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(&models.DataSource{
			Id: 1,
			// This will be the ID of the main org
			OrgId:   2,
			Name:    "Test",
			Type:    "cloudwatch",
			Created: time.Now(),
			Updated: time.Now(),
		})
		return err
	})
	require.NoError(t, err)

	// Make sure changes are synced with other goroutines
	err = sqlStore.Sync()
	require.NoError(t, err)

	return sqlStore
}
