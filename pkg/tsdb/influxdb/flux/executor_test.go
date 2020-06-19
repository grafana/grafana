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

		str, _ := dr.Frames[0].StringTable(-1, -1)
		fmt.Println(str)

		expect := `Name: 
Dimensions: 2 Fields by 3 Rows
+-------------------------------+--------------------------+
| Name: Time                    | Name:                    |
| Labels:                       | Labels: host=hostname.ru |
| Type: []time.Time             | Type: []*float64         |
+-------------------------------+--------------------------+
| 2020-06-05 12:06:00 +0000 UTC | 8.291381590647958        |
| 2020-06-05 12:07:00 +0000 UTC | 0.5341565263056448       |
| 2020-06-05 12:08:00 +0000 UTC | 0.6676119389260387       |
+-------------------------------+--------------------------+
`

		if diff := cmp.Diff(str, expect); diff != "" {
			t.Fatalf("mismatch %s (-want +got):\n%s", "aggregate.csv", diff)
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
