package flux

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/grafana/grafana/pkg/util"
)

//--------------------------------------------------------------
// TestData -- reads result from saved files
//--------------------------------------------------------------

// MockRunner reads local file path for testdata.
type MockRunner struct {
	testDataPath string
}

func (r *MockRunner) runQuery(ctx context.Context, q string) (*api.QueryTableResult, error) {
	bytes, err := os.ReadFile(filepath.Join("testdata", r.testDataPath))
	if err != nil {
		return nil, err
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		if r.Method == http.MethodPost {
			w.WriteHeader(http.StatusOK)
			_, err := w.Write(bytes)
			if err != nil {
				panic(fmt.Sprintf("Failed to write response: %s", err))
			}
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := influxdb2.NewClient(server.URL, "a")
	return client.QueryAPI("x").Query(ctx, q)
}

func executeMockedQuery(t *testing.T, name string, query queryModel) *backend.DataResponse {
	runner := &MockRunner{
		testDataPath: name + ".csv",
	}

	dr := executeQuery(context.Background(), glog, query, runner, 50)
	return &dr
}

func verifyGoldenResponse(t *testing.T, name string) *backend.DataResponse {
	dr := executeMockedQuery(t, name, queryModel{MaxDataPoints: 100})

	experimental.CheckGoldenJSONResponse(t, "testdata", name+".golden", dr, true)
	require.NoError(t, dr.Error)

	return dr
}

func TestExecuteSimple(t *testing.T) {
	dr := verifyGoldenResponse(t, "simple")
	require.Len(t, dr.Frames, 1)
	require.Contains(t, dr.Frames[0].Name, "test")
	require.Len(t, dr.Frames[0].Fields[1].Labels, 2)
	require.Equal(t, "Time", dr.Frames[0].Fields[0].Name)

	st, err := dr.Frames[0].StringTable(-1, -1)
	require.NoError(t, err)
	fmt.Println(st)
	fmt.Println("----------------------")
}

func TestExecuteSingle(t *testing.T) {
	dr := verifyGoldenResponse(t, "single")
	require.Len(t, dr.Frames, 1)
}

func TestExecuteMultiple(t *testing.T) {
	dr := verifyGoldenResponse(t, "multiple")
	require.Len(t, dr.Frames, 3)
	require.Contains(t, dr.Frames[0].Name, "test")
	require.Len(t, dr.Frames[0].Fields[1].Labels, 2)
	require.Equal(t, "Time", dr.Frames[0].Fields[0].Name)

	st, err := dr.Frames[0].StringTable(-1, -1)
	require.NoError(t, err)
	fmt.Println(st)
	fmt.Println("----------------------")
}

func TestExecuteColumnNamedTable(t *testing.T) {
	dr := verifyGoldenResponse(t, "table")
	require.Len(t, dr.Frames, 1)
}

func TestExecuteGrouping(t *testing.T) {
	dr := verifyGoldenResponse(t, "grouping")
	require.Len(t, dr.Frames, 3)
	require.Contains(t, dr.Frames[0].Name, "system")
	require.Len(t, dr.Frames[0].Fields[1].Labels, 1)
	require.Equal(t, "Time", dr.Frames[0].Fields[0].Name)

	st, err := dr.Frames[0].StringTable(-1, -1)
	require.NoError(t, err)
	fmt.Println(st)
	fmt.Println("----------------------")
}

func TestAggregateGrouping(t *testing.T) {
	dr := verifyGoldenResponse(t, "aggregate")
	require.Len(t, dr.Frames, 1)

	str, err := dr.Frames[0].StringTable(-1, -1)
	require.NoError(t, err)
	fmt.Println(str)

	// 	 `Name:
	// Dimensions: 2 Fields by 3 Rows
	// +-------------------------------+--------------------------+
	// | Name: Time                    | Name: Value              |
	// | Labels:                       | Labels: host=hostname.ru |
	// | Type: []*time.Time            | Type: []*float64         |
	// +-------------------------------+--------------------------+
	// | 2020-06-05 12:06:00 +0000 UTC | 8.291                    |
	// | 2020-06-05 12:07:00 +0000 UTC | 0.534                    |
	// | 2020-06-05 12:08:00 +0000 UTC | 0.667                    |
	// +-------------------------------+--------------------------+
	// `

	t1 := time.Date(2020, 6, 5, 12, 6, 0, 0, time.UTC)
	t2 := time.Date(2020, 6, 5, 12, 7, 0, 0, time.UTC)
	t3 := time.Date(2020, 6, 5, 12, 8, 0, 0, time.UTC)

	expectedFrame := data.NewFrame("",
		data.NewField("Time", nil, []*time.Time{&t1, &t2, &t3}),
		data.NewField("Value", map[string]string{"host": "hostname.ru"}, []*float64{
			util.Pointer(8.291),
			util.Pointer(0.534),
			util.Pointer(0.667),
		}),
	)
	expectedFrame.Meta = &data.FrameMeta{}

	diff := cmp.Diff(expectedFrame, dr.Frames[0], data.FrameTestCompareOptions()...)
	assert.Empty(t, diff)
}

func TestNonStandardTimeColumn(t *testing.T) {
	dr := verifyGoldenResponse(t, "non_standard_time_column")
	require.Len(t, dr.Frames, 1)

	str, err := dr.Frames[0].StringTable(-1, -1)
	require.NoError(t, err)
	fmt.Println(str)

	// Dimensions: 3 Fields by 1 Rows
	// +-----------------------------------------+-----------------------------------------+------------------+
	// | Name: _start_water                      | Name: _stop_water                       | Name: _value     |
	// | Labels: st=1                            | Labels: st=1                            | Labels: st=1     |
	// | Type: []*time.Time                      | Type: []*time.Time                      | Type: []*float64 |
	// +-----------------------------------------+-----------------------------------------+------------------+
	// | 2020-06-28 17:50:13.012584046 +0000 UTC | 2020-06-29 17:50:13.012584046 +0000 UTC | 156.304          |
	// +-----------------------------------------+-----------------------------------------+------------------+

	t1 := time.Date(2020, 6, 28, 17, 50, 13, 12584046, time.UTC)
	t2 := time.Date(2020, 6, 29, 17, 50, 13, 12584046, time.UTC)

	expectedFrame := data.NewFrame("",
		data.NewField("_start_water", map[string]string{"st": "1"}, []*time.Time{&t1}),
		data.NewField("_stop_water", map[string]string{"st": "1"}, []*time.Time{&t2}),
		data.NewField("_value", map[string]string{"st": "1"}, []*float64{
			util.Pointer(156.304),
		}),
	)
	expectedFrame.Meta = &data.FrameMeta{}

	diff := cmp.Diff(expectedFrame, dr.Frames[0], data.FrameTestCompareOptions()...)
	assert.Empty(t, diff)
}

func TestBuckets(t *testing.T) {
	verifyGoldenResponse(t, "buckets")
}

func TestBooleanTagGrouping(t *testing.T) {
	verifyGoldenResponse(t, "boolean_tag")
}

func TestBooleanData(t *testing.T) {
	verifyGoldenResponse(t, "boolean_data")
}

func TestGoldenFiles(t *testing.T) {
	verifyGoldenResponse(t, "renamed")
}

func TestRealQuery(t *testing.T) {
	t.Skip() // this is used for local testing

	t.Run("Check buckets() query on localhost", func(t *testing.T) {
		json := simplejson.New()
		json.Set("organization", "test-org")

		dsInfo := &models.DatasourceInfo{
			URL: "http://localhost:9999", // NOTE! no api/v2
		}

		runner, err := runnerFromDataSource(dsInfo)
		require.NoError(t, err)

		dr := executeQuery(context.Background(), glog, queryModel{
			MaxDataPoints: 100,
			RawQuery:      "buckets()",
		}, runner, 50)
		experimental.CheckGoldenJSONResponse(t, "testdata", "buckets-real.golden", &dr, true)
	})
}

func assertDataResponseDimensions(t *testing.T, dr *backend.DataResponse, rows int, columns int) {
	require.Len(t, dr.Frames, 1)
	fields := dr.Frames[0].Fields
	require.Len(t, fields, rows)
	require.Equal(t, fields[0].Len(), columns)
	require.Equal(t, fields[1].Len(), columns)
}

func TestMaxDataPointsExceededNoAggregate(t *testing.T) {
	// unfortunately the golden-response style tests do not support
	// responses that contain errors, so we can only do manual checks
	// on the DataResponse
	dr := executeMockedQuery(t, "max_data_points_exceeded", queryModel{MaxDataPoints: 2})

	// it should contain the error-message
	require.EqualError(t, dr.Error, "A query returned too many datapoints and the results have been truncated at 21 points to prevent memory issues. At the current graph size, Grafana can only draw 2. Try using the aggregateWindow() function in your query to reduce the number of points returned.")
	assertDataResponseDimensions(t, dr, 2, 21)
}

func TestMaxDataPointsExceededWithAggregate(t *testing.T) {
	// unfortunately the golden-response style tests do not support
	// responses that contain errors, so we can only do manual checks
	// on the DataResponse
	dr := executeMockedQuery(t, "max_data_points_exceeded", queryModel{RawQuery: "aggregateWindow()", MaxDataPoints: 2})

	// it should contain the error-message
	require.EqualError(t, dr.Error, "A query returned too many datapoints and the results have been truncated at 21 points to prevent memory issues. At the current graph size, Grafana can only draw 2.")
	assertDataResponseDimensions(t, dr, 2, 21)
}

func TestMultivalue(t *testing.T) {
	// we await a non-labeled _time column
	// and two value-columns named _value and _value2
	dr := verifyGoldenResponse(t, "multivalue")
	require.Len(t, dr.Frames, 4)
	frame := dr.Frames[0]
	require.Len(t, frame.Fields, 3)
	require.Equal(t, frame.Fields[0].Name, "_time")
	require.Equal(t, frame.Fields[0].Len(), 2)
	require.Len(t, frame.Fields[0].Labels, 0)
	require.Equal(t, frame.Fields[1].Name, "_value")
	require.Len(t, frame.Fields[1].Labels, 5)
	require.Equal(t, frame.Fields[2].Name, "_value2")
	require.Len(t, frame.Fields[2].Labels, 5)
}

func TestMultiTime(t *testing.T) {
	// we await three columns, _time, _time2, _value
	// all have all labels
	dr := verifyGoldenResponse(t, "multitime")
	require.Len(t, dr.Frames, 4)
	frame := dr.Frames[0]
	require.Len(t, frame.Fields, 3)
	require.Equal(t, frame.Fields[0].Name, "_time")
	require.Equal(t, frame.Fields[0].Len(), 1)
	require.Len(t, frame.Fields[0].Labels, 5)
	require.Equal(t, frame.Fields[1].Name, "_time2")
	require.Len(t, frame.Fields[1].Labels, 5)
	require.Equal(t, frame.Fields[2].Name, "_value")
	require.Len(t, frame.Fields[2].Labels, 5)
}

func TestTimestampFirst(t *testing.T) {
	dr := verifyGoldenResponse(t, "time_first")
	require.Len(t, dr.Frames, 1)
	// we make sure the timestamp-column is the first column
	// in the dataframe, even if it was not the first column
	// in the csv.
	require.Equal(t, "Time", dr.Frames[0].Fields[0].Name)
	require.Equal(t, "Value", dr.Frames[0].Fields[1].Name)
}
