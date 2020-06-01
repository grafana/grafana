package azuremonitor

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
)

func TestLogTableToFrame(t *testing.T) {
	tests := []struct {
		name          string
		testFile      string
		expectedFrame *data.Frame
	}{
		{
			name:     "single series",
			testFile: "loganalytics/1-log-analytics-response-metrics-single-series.json",
			expectedFrame: data.NewFrame("",
				data.NewField("TimeGenerated", nil, []*time.Time{
					pointer.Time(time.Date(2020, 4, 19, 19, 16, 6, 5e8, time.UTC)),
					pointer.Time(time.Date(2020, 4, 19, 19, 16, 16, 5e8, time.UTC)),
					pointer.Time(time.Date(2020, 4, 19, 19, 16, 26, 5e8, time.UTC)),
				}),
				data.NewField("Computer", nil, []*string{
					pointer.String("grafana-vm"),
					pointer.String("grafana-vm"),
					pointer.String("grafana-vm"),
				}),
				data.NewField("avg_CounterValue", nil, []*float64{
					pointer.Float64(1.1),
					pointer.Float64(2.2),
					pointer.Float64(3.3),
				}),
			),
		},
		{
			name:     "all types",
			testFile: "loganalytics/7-log-analytics-all-types-table.json",
			expectedFrame: data.NewFrame("",
				data.NewField("XBool", nil, []*bool{pointer.Bool(true)}),
				data.NewField("XString", nil, []*string{pointer.String("Grafana")}),
				data.NewField("XDateTime", nil, []*time.Time{pointer.Time(time.Date(2006, 1, 2, 22, 4, 5, 1*1e8, time.UTC))}),
				data.NewField("XDynamic", nil, []*string{pointer.String(`[{"person":"Daniel"},{"cats":23},{"diagnosis":"cat problem"}]`)}),
				data.NewField("XGuid", nil, []*string{pointer.String("74be27de-1e4e-49d9-b579-fe0b331d3642")}),
				data.NewField("XInt", nil, []*int32{pointer.Int32(2147483647)}),
				data.NewField("XLong", nil, []*int64{pointer.Int64(9223372036854775807)}),
				data.NewField("XReal", nil, []*float64{pointer.Float64(1.797693134862315708145274237317043567981e+308)}),
				data.NewField("XTimeSpan", nil, []*string{pointer.String("00:00:00.0000001")}),
			),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := loadLogAnalyticsTestFileWithNumber(tt.testFile)
			require.NoError(t, err)
			frame, err := LogTableToFrame(&res.Tables[0])
			require.NoError(t, err)

			if diff := cmp.Diff(tt.expectedFrame, frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

		})
	}

}

func loadLogAnalyticsTestFileWithNumber(name string) (AzureLogAnalyticsResponse, error) {
	var data AzureLogAnalyticsResponse

	path := filepath.Join("testdata", name)
	f, err := os.Open(path)
	if err != nil {
		return data, err
	}
	defer f.Close()
	d := json.NewDecoder(f)
	d.UseNumber()
	err = d.Decode(&data)
	return data, err
}
