package flux

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/xorcare/pointer"

	influxdb2 "github.com/influxdata/influxdb-client-go"
	"github.com/influxdata/influxdb-client-go/api"
)

//--------------------------------------------------------------
// TestData -- reads result from saved files
//--------------------------------------------------------------

// MockRunner reads local file path for testdata.
type MockRunner struct {
	testDataPath string
}

func (r *MockRunner) runQuery(ctx context.Context, q string) (*api.QueryTableResult, error) {
	bytes, err := ioutil.ReadFile("./testdata/" + r.testDataPath)
	if err != nil {
		return nil, err
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		if r.Method == http.MethodPost {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(bytes)
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := influxdb2.NewClient(server.URL, "a")
	return client.QueryApi("x").Query(ctx, q)
}

func verifyGoldenResponse(name string) (*backend.DataResponse, error) {
	runner := &MockRunner{
		testDataPath: name + ".csv",
	}

	dr := ExecuteQuery(context.Background(), QueryModel{MaxDataPoints: 100}, runner, 50)
	err := experimental.CheckGoldenDataResponse("./testdata/"+name+".golden.txt", &dr, true)
	return &dr, err
}

func TestExecuteSimple(t *testing.T) {
	ctx := context.Background()

	t.Run("Simple Test", func(t *testing.T) {
		runner := &MockRunner{
			testDataPath: "simple.csv",
		}

		dr := ExecuteQuery(ctx, QueryModel{MaxDataPoints: 100}, runner, 50)

		if dr.Error != nil {
			t.Fatal(dr.Error)
		}

		if len(dr.Frames) != 1 {
			t.Fatalf("Expected 1 frame, received [%d] frames", len(dr.Frames))
		}

		if !strings.Contains(dr.Frames[0].Name, "test") {
			t.Fatalf("Frame must match _measurement column. Expected [%s] Got [%s]", "test", dr.Frames[0].Name)
		}

		if len(dr.Frames[0].Fields[1].Labels) != 2 {
			t.Fatalf("Error parsing labels. Expected [%d] Got [%d]", 2, len(dr.Frames[0].Fields[1].Labels))
		}

		if dr.Frames[0].Fields[0].Name != "Time" {
			t.Fatalf("Error parsing fields. Field 1 should always be time. Got name [%s]", dr.Frames[0].Fields[0].Name)
		}

		st, _ := dr.Frames[0].StringTable(-1, -1)
		fmt.Println(st)
		fmt.Println("----------------------")
	})
}

func TestExecuteMultiple(t *testing.T) {
	ctx := context.Background()

	t.Run("Multiple Test", func(t *testing.T) {
		runner := &MockRunner{
			testDataPath: "multiple.csv",
		}

		dr := ExecuteQuery(ctx, QueryModel{MaxDataPoints: 100}, runner, 50)

		if dr.Error != nil {
			t.Fatal(dr.Error)
		}

		if len(dr.Frames) != 4 {
			t.Fatalf("Expected 4 frames, received [%d] frames", len(dr.Frames))
		}

		if !strings.Contains(dr.Frames[0].Name, "test") {
			t.Fatalf("Frame must include _measurement column. Expected [%s] Got [%s]", "test", dr.Frames[0].Name)
		}

		if len(dr.Frames[0].Fields[1].Labels) != 2 {
			t.Fatalf("Error parsing labels. Expected [%d] Got [%d]", 2, len(dr.Frames[0].Fields[1].Labels))
		}

		if dr.Frames[0].Fields[0].Name != "Time" {
			t.Fatalf("Error parsing fields. Field 1 should always be time. Got name [%s]", dr.Frames[0].Fields[0].Name)
		}

		st, _ := dr.Frames[0].StringTable(-1, -1)
		fmt.Println(st)
		fmt.Println("----------------------")
	})
}

func TestExecuteGrouping(t *testing.T) {
	ctx := context.Background()

	t.Run("Grouping Test", func(t *testing.T) {
		runner := &MockRunner{
			testDataPath: "grouping.csv",
		}

		dr := ExecuteQuery(ctx, QueryModel{MaxDataPoints: 100}, runner, 50)

		if dr.Error != nil {
			t.Fatal(dr.Error)
		}

		if len(dr.Frames) != 3 {
			t.Fatalf("Expected 3 frames, received [%d] frames", len(dr.Frames))
		}

		if !strings.Contains(dr.Frames[0].Name, "system") {
			t.Fatalf("Frame must match _measurement column. Expected [%s] Got [%s]", "test", dr.Frames[0].Name)
		}

		if len(dr.Frames[0].Fields[1].Labels) != 1 {
			t.Fatalf("Error parsing labels. Expected [%d] Got [%d]", 1, len(dr.Frames[0].Fields[1].Labels))
		}

		if dr.Frames[0].Fields[0].Name != "Time" {
			t.Fatalf("Error parsing fields. Field 1 should always be time. Got name [%s]", dr.Frames[0].Fields[0].Name)
		}

		st, _ := dr.Frames[0].StringTable(-1, -1)
		fmt.Println(st)
		fmt.Println("----------------------")
	})
}

func TestAggregateGrouping(t *testing.T) {
	ctx := context.Background()

	t.Run("Grouping Test", func(t *testing.T) {
		runner := &MockRunner{
			testDataPath: "aggregate.csv",
		}

		dr := ExecuteQuery(ctx, QueryModel{MaxDataPoints: 100}, runner, 50)
		if dr.Error != nil {
			t.Fatal(dr.Error)
		}

		if len(dr.Frames) != 1 {
			t.Fatal("Expected one frame")
		}

		str, _ := dr.Frames[0].StringTable(-1, -1)
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

		if diff := cmp.Diff(expectedFrame, dr.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestNonStandardTimeColumn(t *testing.T) {
	ctx := context.Background()

	t.Run("Time Column", func(t *testing.T) {
		runner := &MockRunner{
			testDataPath: "non_standard_time_column.csv",
		}

		dr := ExecuteQuery(ctx, QueryModel{MaxDataPoints: 100}, runner, 50)
		if dr.Error != nil {
			t.Fatal(dr.Error)
		}

		if len(dr.Frames) != 1 {
			t.Fatal("Expected one frame")
		}

		str, _ := dr.Frames[0].StringTable(-1, -1)
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

		if diff := cmp.Diff(expectedFrame, dr.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestBuckets(t *testing.T) {
	ctx := context.Background()

	t.Run("Buckes", func(t *testing.T) {
		runner := &MockRunner{
			testDataPath: "buckets.csv",
		}

		dr := ExecuteQuery(ctx, QueryModel{MaxDataPoints: 100}, runner, 50)

		if dr.Error != nil {
			t.Fatal(dr.Error)
		}

		st, _ := dr.Frames[0].StringTable(-1, -1)
		fmt.Println(st)
		fmt.Println("----------------------")
	})
}

func TestGoldenFiles(t *testing.T) {
	t.Run("Renamed", func(t *testing.T) {
		_, err := verifyGoldenResponse("renamed")
		if err != nil {
			t.Fatal(err.Error())
		}
	})
}
