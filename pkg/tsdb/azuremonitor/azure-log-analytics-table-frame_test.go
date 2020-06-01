package azuremonitor

import (
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := loadLogAnalyticsTestFile(tt.testFile)
			require.NoError(t, err)
			frame, err := LogTableToFrame(&res.Tables[0])
			require.NoError(t, err)

			if diff := cmp.Diff(tt.expectedFrame, frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

		})
	}

}
