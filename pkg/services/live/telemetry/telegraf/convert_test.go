package telegraf

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func loadTestData(tb testing.TB, file string) []byte {
	tb.Helper()
	// Safe to disable, this is a test.
	// nolint:gosec
	content, err := os.ReadFile(filepath.Join("testdata", file+".txt"))
	require.NoError(tb, err, "expected to be able to read file")
	require.True(tb, len(content) > 0)
	return content
}

func checkTestData(t *testing.T, file string) *backend.DataResponse {
	t.Helper()
	// Safe to disable, this is a test.
	// nolint:gosec
	content, err := os.ReadFile(filepath.Join("testdata", file+".txt"))
	require.NoError(t, err, "expected to be able to read file")
	require.True(t, len(content) > 0)

	converter := NewConverter(WithUseLabelsColumn(true))
	frameWrappers, err := converter.Convert(content)
	require.NoError(t, err)

	dr := &backend.DataResponse{}
	for _, w := range frameWrappers {
		dr.Frames = append(dr.Frames, w.Frame())
	}

	experimental.CheckGoldenJSONResponse(t, "testdata", file, dr, false)
	return dr
}

func TestNewConverter(t *testing.T) {
	c := NewConverter(WithUseLabelsColumn(true))
	require.True(t, c.useLabelsColumn)
}

func TestConverter_Convert(t *testing.T) {
	testCases := []struct {
		Name        string
		NumFields   int
		FieldLength int
		NumFrames   int
	}{
		{Name: "single_metric", NumFields: 6, FieldLength: 1, NumFrames: 1},
		{Name: "same_metrics_same_labels_different_time", NumFields: 6, FieldLength: 1, NumFrames: 3},
		{Name: "same_metrics_different_labels_different_time", NumFields: 6, FieldLength: 1, NumFrames: 2},
		{Name: "same_metrics_different_labels_same_time", NumFields: 131, FieldLength: 1, NumFrames: 1},
	}

	for _, tt := range testCases {
		t.Run(tt.Name, func(t *testing.T) {
			testData := loadTestData(t, tt.Name)
			converter := NewConverter()
			frameWrappers, err := converter.Convert(testData)
			require.NoError(t, err)
			require.Len(t, frameWrappers, tt.NumFrames)
			for _, fw := range frameWrappers {
				frame := fw.Frame()
				require.Len(t, frame.Fields, tt.NumFields)
				require.Equal(t, tt.FieldLength, frame.Fields[0].Len())
				_, err := data.FrameToJSON(frame, data.IncludeAll)
				require.NoError(t, err)
			}
		})
	}
}

func TestConverter_Convert_LabelsColumn(t *testing.T) {
	testCases := []struct {
		Name        string
		NumFields   int
		FieldLength int
		NumFrames   int
	}{
		{Name: "single_metric", NumFields: 7, FieldLength: 1, NumFrames: 1},
		{Name: "same_metrics_same_labels_different_time", NumFields: 7, FieldLength: 3, NumFrames: 1},
		{Name: "same_metrics_different_labels_different_time", NumFields: 7, FieldLength: 2, NumFrames: 1},
		{Name: "same_metrics_different_labels_same_time", NumFields: 12, FieldLength: 13, NumFrames: 1},
		{Name: "incomplete_fields", NumFields: 4, FieldLength: 4, NumFrames: 1},
		{Name: "incomplete_fields_2", NumFields: 4, FieldLength: 5, NumFrames: 1},
		{Name: "incomplete_fields_full", NumFrames: 5},
	}

	for _, tt := range testCases {
		t.Run(tt.Name, func(t *testing.T) {
			testData := loadTestData(t, tt.Name)
			if *pprint {
				fmt.Println(string(testData))
			}
			converter := NewConverter(WithUseLabelsColumn(true))
			frameWrappers, err := converter.Convert(testData)
			require.NoError(t, err)
			require.Len(t, frameWrappers, tt.NumFrames)
			for _, fw := range frameWrappers {
				frame := fw.Frame()
				if tt.NumFrames == 1 {
					require.Len(t, frame.Fields, tt.NumFields)
					require.Equal(t, tt.FieldLength, frame.Fields[0].Len())
				}
				_, err := data.FrameToJSON(frame, data.IncludeAll)
				require.NoError(t, err)
				if *pprint {
					s, err := frame.StringTable(100, 100)
					require.NoError(t, err)
					fmt.Println(s)
				}
			}
		})
	}
}

var update = flag.Bool("update", false, "update golden files")
var pprint = flag.Bool("pprint", false, "pretty print test case")

func TestConverter_Convert_NumFrameFields(t *testing.T) {
	testData := loadTestData(t, "same_metrics_different_labels_same_time")
	converter := NewConverter()
	frameWrappers, err := converter.Convert(testData)
	require.NoError(t, err)
	require.Len(t, frameWrappers, 1)
	frameWrapper := frameWrappers[0]

	goldenFile := filepath.Join("testdata", "golden_wide.json")

	frame := frameWrapper.Frame()
	require.Len(t, frame.Fields, 131) // 10 measurements across 13 metrics + time field.
	frameJSON, err := json.MarshalIndent(frame, "", "  ")
	require.NoError(t, err)
	if *update {
		if err := os.WriteFile(goldenFile, frameJSON, 0600); err != nil {
			t.Fatal(err)
		}
	}
	// Safe to disable, this is a test.
	// nolint:gosec
	want, err := os.ReadFile(goldenFile)
	if err != nil {
		t.Fatal(err)
	}
	require.JSONEqf(t, string(frameJSON), string(want), "not matched with golden file")
}

func TestConverter_Convert_ChangingTypes(t *testing.T) {
	dr := checkTestData(t, "changing_types_NaN")
	require.NotNil(t, dr)
}

func TestConverter_Convert_FieldOrder(t *testing.T) {
	converter := NewConverter()

	testData := loadTestData(t, "single_metric")
	frameWrappers, err := converter.Convert(testData)
	require.NoError(t, err)

	require.Len(t, frameWrappers, 1)
	frameJSON1, err := data.FrameToJSON(frameWrappers[0].Frame(), data.IncludeAll)
	require.NoError(t, err)

	testDataDifferentOrder := loadTestData(t, "single_metric_different_field_order")
	frameWrappers, err = converter.Convert(testDataDifferentOrder)
	require.NoError(t, err)
	require.Len(t, frameWrappers, 1)
	frameJSON2, err := data.FrameToJSON(frameWrappers[0].Frame(), data.IncludeAll)
	require.NoError(t, err)

	require.JSONEqf(t, string(frameJSON1), string(frameJSON2), "frames must match")
}

func BenchmarkConverter_Convert_Wide(b *testing.B) {
	testData := loadTestData(b, "same_metrics_different_labels_same_time")
	converter := NewConverter()
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := converter.Convert(testData)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkConverter_Convert_LabelsColumn(b *testing.B) {
	testData := loadTestData(b, "same_metrics_different_labels_same_time")
	converter := NewConverter(WithUseLabelsColumn(true))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := converter.Convert(testData)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestConverter_Convert_NumFrameFields_LabelsColumn(t *testing.T) {
	testData := loadTestData(t, "same_metrics_different_labels_same_time")
	converter := NewConverter(WithUseLabelsColumn(true))
	frameWrappers, err := converter.Convert(testData)
	require.NoError(t, err)
	require.Len(t, frameWrappers, 1)
	frameWrapper := frameWrappers[0]

	goldenFile := filepath.Join("testdata", "golden_labels_column.json")

	frame := frameWrapper.Frame()
	require.Len(t, frame.Fields, 12)
	frameJSON, err := json.MarshalIndent(frame, "", "  ")
	require.NoError(t, err)
	if *update {
		if err := os.WriteFile(goldenFile, frameJSON, 0600); err != nil {
			t.Fatal(err)
		}
	}
	// Safe to disable, this is a test.
	// nolint:gosec
	want, err := os.ReadFile(goldenFile)
	if err != nil {
		t.Fatal(err)
	}
	require.JSONEqf(t, string(frameJSON), string(want), "not matched with golden file")
}

func TestConverter_Convert_MixedNumberTypes_OK(t *testing.T) {
	testData := loadTestData(t, "mixed_number_types")
	converter := NewConverter(WithFloat64Numbers(true))
	frameWrappers, err := converter.Convert(testData)
	require.NoError(t, err)
	require.Len(t, frameWrappers, 2)
}

func TestConverter_Convert_MixedNumberTypes_OK_LabelsColumn(t *testing.T) {
	testData := loadTestData(t, "mixed_number_types")
	converter := NewConverter(WithUseLabelsColumn(true), WithFloat64Numbers(true))
	frameWrappers, err := converter.Convert(testData)
	require.NoError(t, err)
	require.Len(t, frameWrappers, 1)
}

func TestConverter_Convert_PartInput(t *testing.T) {
	testData := loadTestData(t, "part_metrics_different_labels_different_time")
	converter := NewConverter()
	frameWrappers, err := converter.Convert(testData)
	require.NoError(t, err)
	require.Len(t, frameWrappers, 2)
}

func TestConverter_Convert_PartInput_LabelsColumn(t *testing.T) {
	testData := loadTestData(t, "part_metrics_different_labels_different_time")
	converter := NewConverter(WithUseLabelsColumn(true))
	frameWrappers, err := converter.Convert(testData)
	require.NoError(t, err)
	require.Len(t, frameWrappers, 1)
}
