package flux

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

//--------------------------------------------------------------
// TestData -- reads result from saved files
//--------------------------------------------------------------

// MockRunner reads local file path for testdata.
type MockRunner struct {
	testDataPath string
}

func (r *MockRunner) runQuery(ctx context.Context, q string) (*api.QueryTableResult, error) {
	bytes, err := ioutil.ReadFile(filepath.Join("testdata", r.testDataPath))
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

func verifyGoldenResponse(t *testing.T, name string) *backend.DataResponse {
	runner := &MockRunner{
		testDataPath: name + ".csv",
	}

	dr := executeQuery(context.Background(), queryModel{MaxDataPoints: 100}, runner, 50)
	err := experimental.CheckGoldenDataResponse(filepath.Join("testdata", fmt.Sprintf("%s.golden.txt", name)),
		&dr, true)
	require.NoError(t, err)
	require.NoError(t, dr.Error)

	return &dr
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
	// | Name: Time                    | Name:                    |
	// | Labels:                       | Labels: host=hostname.ru |
	// | Type: []time.Time             | Type: []*float64         |
	// +-------------------------------+--------------------------+
	// | 2020-06-05 12:06:00 +0000 UTC | 8.291                    |
	// | 2020-06-05 12:07:00 +0000 UTC | 0.534                    |
	// | 2020-06-05 12:08:00 +0000 UTC | 0.667                    |
	// +-------------------------------+--------------------------+
	// `

	expectedFrame := data.NewFrame("",
		data.NewField("Time", nil, []time.Time{
			time.Date(2020, 6, 5, 12, 6, 0, 0, time.UTC),
			time.Date(2020, 6, 5, 12, 7, 0, 0, time.UTC),
			time.Date(2020, 6, 5, 12, 8, 0, 0, time.UTC),
		}),
		data.NewField("", map[string]string{"host": "hostname.ru"}, []*float64{
			pointer.Float64(8.291),
			pointer.Float64(0.534),
			pointer.Float64(0.667),
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

	// Dimensions: 2 Fields by 1 Rows
	// +-----------------------------------------+------------------+
	// | Name: _start_water                      | Name:            |
	// | Labels:                                 | Labels: st=1     |
	// | Type: []time.Time                       | Type: []*float64 |
	// +-----------------------------------------+------------------+
	// | 2020-06-28 17:50:13.012584046 +0000 UTC | 156.304          |
	// +-----------------------------------------+------------------+

	expectedFrame := data.NewFrame("",
		data.NewField("_start_water", nil, []time.Time{
			time.Date(2020, 6, 28, 17, 50, 13, 12584046, time.UTC),
		}),
		data.NewField("", map[string]string{"st": "1"}, []*float64{
			pointer.Float64(156.304),
		}),
	)
	expectedFrame.Meta = &data.FrameMeta{}

	diff := cmp.Diff(expectedFrame, dr.Frames[0], data.FrameTestCompareOptions()...)
	assert.Empty(t, diff)
}

func TestBuckets(t *testing.T) {
	verifyGoldenResponse(t, "buckets")
}

func TestBooleanGrouping(t *testing.T) {
	verifyGoldenResponse(t, "boolean")
}

func TestGoldenFiles(t *testing.T) {
	verifyGoldenResponse(t, "renamed")
}

func TestRealQuery(t *testing.T) {
	t.Skip() // this is used for local testing

	t.Run("Check buckets() query on localhost", func(t *testing.T) {
		json := simplejson.New()
		json.Set("organization", "test-org")

		dsInfo := &models.DataSource{
			Url:      "http://localhost:9999", // NOTE! no api/v2
			JsonData: json,
			SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{
				"token": "PjSEcM5oWhqg2eI6IXcqYJFe5UbMM_xt-UNlAL0BRYJqLeVpcdMWidiPfWxGhu4Xrh6wioRR-CiadCg-ady68Q==",
			}),
		}

		runner, err := runnerFromDataSource(dsInfo)
		require.NoError(t, err)

		dr := executeQuery(context.Background(), queryModel{
			MaxDataPoints: 100,
			RawQuery:      "buckets()",
		}, runner, 50)
		err = experimental.CheckGoldenDataResponse(filepath.Join("testdata", "buckets-real.golden.txt"), &dr, true)
		require.NoError(t, err)
	})
}
