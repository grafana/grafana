package parca

import (
	"bytes"
	"context"
	"testing"
	"time"

	profilestore "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/profilestore/v1alpha1"
	v1alpha1 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/query/v1alpha1"
	"connectrpc.com/connect"
	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// This is where the tests for the datasource backend live.
func Test_query(t *testing.T) {
	ds := &ParcaDatasource{
		client: &FakeClient{},
	}

	dataQuery := backend.DataQuery{
		RefID:         "A",
		QueryType:     queryTypeBoth,
		MaxDataPoints: 0,
		Interval:      0,
		TimeRange: backend.TimeRange{
			From: time.UnixMilli(10000),
			To:   time.UnixMilli(20000),
		},
		JSON: []byte(`{"profileTypeId":"foo:bar","labelSelector":"{app=\\\"baz\\\"}"}`),
	}

	t.Run("query both", func(t *testing.T) {
		resp := ds.query(context.Background(), backend.PluginContext{}, dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 2, len(resp.Frames))
		require.Equal(t, "time", resp.Frames[0].Fields[0].Name)
		require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2, 3, 4, 4}), resp.Frames[1].Fields[0])
	})

	t.Run("query profile", func(t *testing.T) {
		dataQuery.QueryType = queryTypeProfile
		resp := ds.query(context.Background(), backend.PluginContext{}, dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 1, len(resp.Frames))
		require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2, 3, 4, 4}), resp.Frames[0].Fields[0])
	})

	t.Run("query metrics", func(t *testing.T) {
		dataQuery.QueryType = queryTypeMetrics
		resp := ds.query(context.Background(), backend.PluginContext{}, dataQuery)
		require.Nil(t, resp.Error)
		require.Equal(t, 1, len(resp.Frames))
		require.Equal(t, "time", resp.Frames[0].Fields[0].Name)
	})
}

// This is where the tests for the datasource backend live.
func Test_profileToDataFrame(t *testing.T) {
	frame, err := responseToDataFrames(flamegraphResponse())
	require.NoError(t, err)
	require.Equal(t, 4, len(frame.Fields))
	require.Equal(t, data.NewField("level", nil, []int64{0, 1, 2, 3, 4, 4}), frame.Fields[0])
	values := data.NewField("value", nil, []int64{11, 11, 11, 8, 3, 5})
	values.Config = &data.FieldConfig{Unit: "ns"}
	require.Equal(t, values, frame.Fields[1])

	self := data.NewField("self", nil, []int64{0, 0, 3, 0, 3, 5})
	self.Config = &data.FieldConfig{Unit: "ns"}
	require.Equal(t, self, frame.Fields[2])

	require.Equal(t, data.NewField("label", nil, []string{"total", "[a] 1", "2", "[a] 3", "[a] 4", "[a] 5"}), frame.Fields[3])
}

func BenchmarkProfileToDataFrame(b *testing.B) {
	response := flamegraphResponse()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = responseToDataFrames(response)
	}
}

func Test_seriesToDataFrame(t *testing.T) {
	frames := seriesToDataFrame(rangeResponse, "process_cpu:samples:count:cpu:nanoseconds")
	require.Equal(t, 1, len(frames))
	require.Equal(t, 2, len(frames[0].Fields))
	require.Equal(t, data.NewField("time", nil, []time.Time{time.UnixMilli(1000 * 10).UTC(), time.UnixMilli(1000 * 20).UTC()}), frames[0].Fields[0])
	require.Equal(t, data.NewField("samples", map[string]string{"foo": "bar"}, []int64{30, 10}), frames[0].Fields[1])
}

var rangeResponse = &connect.Response[v1alpha1.QueryRangeResponse]{
	Msg: &v1alpha1.QueryRangeResponse{
		Series: []*v1alpha1.MetricsSeries{
			{
				Labelset: &profilestore.LabelSet{
					Labels: []*profilestore.Label{
						{
							Name:  "foo",
							Value: "bar",
						},
					},
				},
				Samples: []*v1alpha1.MetricsSample{
					{
						Timestamp: &timestamppb.Timestamp{
							Seconds: 10,
							Nanos:   0,
						},
						Value: 30,
					},
					{
						Timestamp: &timestamppb.Timestamp{
							Seconds: 20,
							Nanos:   0,
						},
						Value: 10,
					},
				},
				PeriodType: nil,
				SampleType: nil,
			},
		},
	},
}

// Copied from github.com/parca-dev/parca/pkg/query/flamegraph_arrow_test.go
type flamegraphRow struct {
	LabelsOnly          bool
	MappingStart        uint64
	MappingLimit        uint64
	MappingOffset       uint64
	MappingFile         string
	MappingBuildID      string
	LocationAddress     uint64
	Inlined             bool
	LocationLine        uint8
	FunctionStartLine   uint8
	FunctionName        string
	FunctionSystemName  string
	FunctionFilename    string
	Labels              map[string]string
	Children            []uint32
	Cumulative          uint8
	CumulativePerSecond float64
	Flat                uint8
	FlatPerSecond       float64
	Diff                int8
}

type flamegraphColumns struct {
	labelsOnly          []bool
	mappingFiles        []string
	mappingBuildIDs     []string
	locationAddresses   []uint64
	inlined             []bool
	locationLines       []uint8
	functionStartLines  []uint8
	functionNames       []string
	functionSystemNames []string
	functionFileNames   []string
	labels              []map[string]string
	children            [][]uint32
	cumulative          []uint8
	cumulativePerSecond []float64
	flat                []uint8
	flatPerSecond       []float64
	diff                []int8
}

func rowsToColumn(rows []flamegraphRow) flamegraphColumns {
	columns := flamegraphColumns{}
	for _, row := range rows {
		columns.labelsOnly = append(columns.labelsOnly, row.LabelsOnly)
		columns.mappingFiles = append(columns.mappingFiles, row.MappingFile)
		columns.mappingBuildIDs = append(columns.mappingBuildIDs, row.MappingBuildID)
		columns.locationAddresses = append(columns.locationAddresses, row.LocationAddress)
		columns.locationLines = append(columns.locationLines, row.LocationLine)
		columns.inlined = append(columns.inlined, row.Inlined)
		columns.functionStartLines = append(columns.functionStartLines, row.FunctionStartLine)
		columns.functionNames = append(columns.functionNames, row.FunctionName)
		columns.functionSystemNames = append(columns.functionSystemNames, row.FunctionSystemName)
		columns.functionFileNames = append(columns.functionFileNames, row.FunctionFilename)
		columns.labels = append(columns.labels, row.Labels)
		columns.children = append(columns.children, row.Children)
		columns.cumulative = append(columns.cumulative, row.Cumulative)
		columns.cumulativePerSecond = append(columns.cumulativePerSecond, row.CumulativePerSecond)
		columns.flat = append(columns.flat, row.Flat)
		columns.flatPerSecond = append(columns.flatPerSecond, row.FlatPerSecond)
		columns.diff = append(columns.diff, row.Diff)
	}
	return columns
}

func flamegraphResponse() *connect.Response[v1alpha1.QueryResponse] {
	mem := memory.NewGoAllocator()

	rows := []flamegraphRow{
		{MappingStart: 0, MappingLimit: 0, MappingOffset: 0, MappingFile: array.NullValueStr, MappingBuildID: array.NullValueStr, LocationAddress: 0, LocationLine: 0, FunctionStartLine: 0, FunctionName: array.NullValueStr, FunctionSystemName: array.NullValueStr, FunctionFilename: array.NullValueStr, Cumulative: 11, CumulativePerSecond: 1.1, Flat: 0, FlatPerSecond: 0, Labels: nil, Children: []uint32{1}}, // 0
		{MappingStart: 1, MappingLimit: 1, MappingOffset: 0x1234, MappingFile: "a", MappingBuildID: "aID", LocationAddress: 0xa1, LocationLine: 1, FunctionStartLine: 1, FunctionName: "1", FunctionSystemName: "1", FunctionFilename: "1", Cumulative: 11, CumulativePerSecond: 1.1, Flat: 0, FlatPerSecond: 0, Labels: nil, Children: []uint32{2}},                                                                  // 1
		{MappingStart: 0, MappingLimit: 0, MappingOffset: 0, MappingFile: array.NullValueStr, MappingBuildID: array.NullValueStr, LocationAddress: 0x0, LocationLine: 0, FunctionStartLine: 0, FunctionName: "2", FunctionSystemName: array.NullValueStr, FunctionFilename: array.NullValueStr, Cumulative: 11, CumulativePerSecond: 1.1, Flat: 3, FlatPerSecond: 0.3, Labels: nil, Children: []uint32{3}},            // 2
		{MappingStart: 1, MappingLimit: 1, MappingOffset: 0x1234, MappingFile: "a", MappingBuildID: "aID", LocationAddress: 0xa3, LocationLine: 3, FunctionStartLine: 3, FunctionName: "3", FunctionSystemName: "3", FunctionFilename: "3", Cumulative: 8, CumulativePerSecond: 0.8, Flat: 0, FlatPerSecond: 0, Labels: nil, Children: []uint32{4, 5}},                                                                // 3
		{MappingStart: 1, MappingLimit: 1, MappingOffset: 0x1234, MappingFile: "a", MappingBuildID: "aID", LocationAddress: 0xa4, LocationLine: 4, FunctionStartLine: 4, FunctionName: "4", FunctionSystemName: "4", FunctionFilename: "4", Cumulative: 3, CumulativePerSecond: 0.3, Flat: 3, FlatPerSecond: 0.3, Labels: nil, Children: nil},                                                                         // 4
		{MappingStart: 1, MappingLimit: 1, MappingOffset: 0x1234, MappingFile: "a", MappingBuildID: "aID", LocationAddress: 0xa5, LocationLine: 5, FunctionStartLine: 5, FunctionName: "5", FunctionSystemName: "5", FunctionFilename: "5", Cumulative: 5, CumulativePerSecond: 0.5, Flat: 5, FlatPerSecond: 0.5, Labels: nil, Children: nil},                                                                         // 5
	}
	columns := rowsToColumn(rows)

	// This is a copy from Parca. A lot of fields aren't used by the Grafana datasource but are kept to make future updates easier.
	fields := []arrow.Field{
		// Location
		//{Name: FlamegraphFieldLabelsOnly, Type: arrow.FixedWidthTypes.Boolean},
		{Name: FlamegraphFieldLocationAddress, Type: arrow.PrimitiveTypes.Uint64},
		{Name: FlamegraphFieldMappingFile, Type: &arrow.DictionaryType{IndexType: arrow.PrimitiveTypes.Int32, ValueType: arrow.BinaryTypes.Binary}},
		//{Name: FlamegraphFieldMappingBuildID, Type: fb.mappingBuildID.DataType()},
		// Function
		//{Name: FlamegraphFieldLocationLine, Type: fb.trimmedLocationLine.Type()},
		//{Name: FlamegraphFieldInlined, Type: arrow.FixedWidthTypes.Boolean, Nullable: true},
		//{Name: FlamegraphFieldFunctionStartLine, Type: fb.trimmedFunctionStartLine.Type()},
		{Name: FlamegraphFieldFunctionName, Type: &arrow.DictionaryType{IndexType: arrow.PrimitiveTypes.Int32, ValueType: arrow.BinaryTypes.Binary}},
		//{Name: FlamegraphFieldFunctionSystemName, Type: fb.functionSystemName.DataType()},
		//{Name: FlamegraphFieldFunctionFileName, Type: fb.functionFilename.DataType()},
		// Values
		{Name: FlamegraphFieldChildren, Type: arrow.ListOf(arrow.PrimitiveTypes.Uint32)},
		{Name: FlamegraphFieldCumulative, Type: arrow.PrimitiveTypes.Uint8},
		//{Name: FlamegraphFieldCumulativePerSecond, Type: arrow.PrimitiveTypes.Float64},
		{Name: FlamegraphFieldFlat, Type: arrow.PrimitiveTypes.Uint8},
		//{Name: FlamegraphFieldFlatPerSecond, Type: arrow.PrimitiveTypes.Float64},
		//{Name: FlamegraphFieldDiff, Type: fb.trimmedDiff.Type()},
		//{Name: FlamegraphFieldDiffPerSecond, Type: arrow.PrimitiveTypes.Float64},
	}

	builderLocationAddress := array.NewUint64Builder(mem)
	builderMappingFile := array.NewDictionaryBuilder(mem, fields[1].Type.(*arrow.DictionaryType)).(*array.BinaryDictionaryBuilder)
	builderFunctionName := array.NewDictionaryBuilder(mem, fields[2].Type.(*arrow.DictionaryType)).(*array.BinaryDictionaryBuilder)
	builderChildren := array.NewListBuilder(mem, arrow.PrimitiveTypes.Uint32)
	builderChildrenValues := builderChildren.ValueBuilder().(*array.Uint32Builder)
	builderCumulative := array.NewUint8Builder(mem)
	builderFlat := array.NewUint8Builder(mem)

	defer func() {
		builderLocationAddress.Release()
		builderMappingFile.Release()
		builderFunctionName.Release()
		builderChildren.Release()
		builderCumulative.Release()
		builderFlat.Release()
	}()

	for i := range columns.cumulative { // iterate over all rows in one of the columns
		if columns.mappingFiles[i] == array.NullValueStr {
			builderMappingFile.AppendNull()
		} else {
			_ = builderMappingFile.AppendString(columns.mappingFiles[i])
		}
		if columns.functionNames[i] == array.NullValueStr {
			builderFunctionName.AppendNull()
		} else {
			_ = builderFunctionName.AppendString(columns.functionNames[i])
		}
		if len(columns.children[i]) == 0 {
			builderChildren.AppendNull()
		} else {
			builderChildren.Append(true)
			for _, child := range columns.children[i] {
				builderChildrenValues.Append(child)
			}
		}

		builderLocationAddress.Append(columns.locationAddresses[i])
		builderCumulative.Append(columns.cumulative[i])
		builderFlat.Append(columns.flat[i])
	}

	record := array.NewRecord(
		arrow.NewSchema(fields, nil),
		[]arrow.Array{
			builderLocationAddress.NewArray(),
			builderMappingFile.NewArray(),
			builderFunctionName.NewArray(),
			builderChildren.NewArray(),
			builderCumulative.NewArray(),
			builderFlat.NewArray(),
		},
		int64(len(rows)),
	)

	var buf bytes.Buffer
	w := ipc.NewWriter(&buf,
		ipc.WithSchema(record.Schema()),
	)
	defer func() {
		_ = w.Close()
	}()

	if err := w.Write(record); err != nil {
		return nil
	}

	return &connect.Response[v1alpha1.QueryResponse]{
		Msg: &v1alpha1.QueryResponse{
			Report: &v1alpha1.QueryResponse_FlamegraphArrow{
				FlamegraphArrow: &v1alpha1.FlamegraphArrow{
					Record:  buf.Bytes(),
					Unit:    "nanoseconds",
					Height:  2,
					Trimmed: 0,
				},
			},
		},
	}
}

type FakeClient struct {
	Req *connect.Request[v1alpha1.QueryRequest]
}

func (f *FakeClient) QueryRange(ctx context.Context, c *connect.Request[v1alpha1.QueryRangeRequest]) (*connect.Response[v1alpha1.QueryRangeResponse], error) {
	return rangeResponse, nil
}

func (f *FakeClient) Query(ctx context.Context, c *connect.Request[v1alpha1.QueryRequest]) (*connect.Response[v1alpha1.QueryResponse], error) {
	f.Req = c
	return flamegraphResponse(), nil
}

func (f *FakeClient) Series(ctx context.Context, c *connect.Request[v1alpha1.SeriesRequest]) (*connect.Response[v1alpha1.SeriesResponse], error) {
	// TODO implement me
	panic("implement me")
}

func (f *FakeClient) ProfileTypes(ctx context.Context, c *connect.Request[v1alpha1.ProfileTypesRequest]) (*connect.Response[v1alpha1.ProfileTypesResponse], error) {
	// TODO implement me
	panic("implement me")
}

func (f *FakeClient) Labels(ctx context.Context, c *connect.Request[v1alpha1.LabelsRequest]) (*connect.Response[v1alpha1.LabelsResponse], error) {
	return &connect.Response[v1alpha1.LabelsResponse]{
		Msg: &v1alpha1.LabelsResponse{
			LabelNames: []string{"instance", "job"},
			Warnings:   nil,
		},
	}, nil
}

func (f *FakeClient) Values(ctx context.Context, c *connect.Request[v1alpha1.ValuesRequest]) (*connect.Response[v1alpha1.ValuesResponse], error) {
	return &connect.Response[v1alpha1.ValuesResponse]{
		Msg: &v1alpha1.ValuesResponse{
			LabelValues: []string{"foo", "bar"},
			Warnings:    nil,
		},
	}, nil
}

func (f *FakeClient) ShareProfile(ctx context.Context, c *connect.Request[v1alpha1.ShareProfileRequest]) (*connect.Response[v1alpha1.ShareProfileResponse], error) {
	// TODO implement me
	panic("implement me")
}
