package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/dataplane/examples"
	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPassThroughDataplaneExamples(t *testing.T) {
	es, err := examples.GetExamples()
	require.NoError(t, err)

	validExamples, err := es.Filter(examples.FilterOptions{
		Version: data.FrameTypeVersion{0, 1},
		Valid:   new(true),
	})
	require.NoError(t, err)

	for _, collection := range validExamples.Collections() {
		for _, example := range collection.ExampleSlice() {
			t.Run(example.Info().ID, func(t *testing.T) {
				_, err := framesPassThroughService(t, example.Frames("A"))
				require.NoError(t, err)
			})
		}
	}
}

func framesPassThroughService(t *testing.T, frames data.Frames) (data.Frames, error) {
	me := &mockEndpoint{
		map[string]backend.DataResponse{"A": {Frames: frames}},
	}

	features := featuremgmt.WithFeatures()
	cfg := setting.NewCfg()

	s := Service{
		cfg:         cfg,
		dataService: me,
		features:    features,
		pCtxProvider: plugincontext.ProvideService(cfg, nil, &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "test"}},
			}},
			&datafakes.FakeCacheService{}, &datafakes.FakeDataSourceService{},
			nil, pluginconfig.NewFakePluginRequestConfigProvider()),
		tracer:  tracing.InitializeTracerForTest(),
		metrics: metrics.NewSSEMetrics(nil),
		converter: &ResultConverter{
			Features: features,
			Tracer:   tracing.InitializeTracerForTest(),
		},
		qsDatasourceClientBuilder: dsquerierclient.NewNullQSDatasourceClientBuilder(),
	}
	queries := []Query{{
		RefID: "A",
		DataSource: &datasources.DataSource{
			OrgID: 1,
			UID:   "test",
			Type:  "test",
		},
		JSON: json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		TimeRange: AbsoluteTimeRange{
			From: time.Time{},
			To:   time.Time{},
		},
	}}

	req := &Request{
		Queries: queries,
		User:    &user.SignedInUser{},
	}

	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	require.Contains(t, res.Responses, "A")

	return res.Responses["A"].Frames, res.Responses["A"].Error
}

func TestShouldUseDataplane(t *testing.T) {
	t.Run("zero frames returns no data and is allowed", func(t *testing.T) {
		f := data.Frames{}
		dt, use, err := shouldUseDataplane(f, log.New(""), false)
		require.NoError(t, err)
		require.True(t, use)
		require.Equal(t, data.KindUnknown, dt.Kind())
	})

	t.Run("a frame with Type and TypeVersion 0.0 will not use dataplane", func(t *testing.T) {
		f := data.Frames{(&data.Frame{}).SetMeta(
			&data.FrameMeta{
				TypeVersion: data.FrameTypeVersion{},
				Type:        data.FrameTypeTimeSeriesMulti,
			},
		)}
		_, use, err := shouldUseDataplane(f, log.New(""), false)
		require.NoError(t, err)
		require.False(t, use)
	})

	t.Run("a frame without Type and TypeVersion > 0.0 will not use dataplane", func(t *testing.T) {
		f := data.Frames{(&data.Frame{}).SetMeta(
			&data.FrameMeta{
				TypeVersion: data.FrameTypeVersion{0, 1},
			},
		)}
		_, use, err := shouldUseDataplane(f, log.New(""), false)
		require.NoError(t, err)
		require.False(t, use)
	})

	t.Run("a frame with no metadata will not use dataplane", func(t *testing.T) {
		f := data.Frames{&data.Frame{}}
		_, use, err := shouldUseDataplane(f, log.New(""), false)
		require.NoError(t, err)
		require.False(t, use)
	})

	t.Run("a newer version that supported will return a warning but still use dataplane", func(t *testing.T) {
		ty := data.FrameTypeTimeSeriesMulti
		v := data.FrameTypeVersion{999, 999}
		f := data.Frames{(&data.Frame{}).SetMeta(
			&data.FrameMeta{
				Type:        ty,
				TypeVersion: v,
			},
		)}
		dt, use, err := shouldUseDataplane(f, log.New(""), false)

		require.NoError(t, err)

		require.True(t, use)
		require.Equal(t, data.KindTimeSeries, dt.Kind())
	})

	t.Run("all valid dataplane examples should use dataplane", func(t *testing.T) {
		es, err := examples.GetExamples()
		require.NoError(t, err)

		validExamples, err := es.Filter(examples.FilterOptions{
			Version: data.FrameTypeVersion{0, 1},
			Valid:   new(true),
		})
		require.NoError(t, err)

		for _, collection := range validExamples.Collections() {
			for _, example := range collection.ExampleSlice() {
				t.Run(example.Info().ID, func(t *testing.T) {
					_, err := framesPassThroughService(t, example.Frames("A"))
					require.NoError(t, err)
				})
			}
		}
	})
}

func TestHandleDataplaneNumeric(t *testing.T) {
	t.Run("no data", func(t *testing.T) {
		es, err := examples.GetExamples()
		require.NoError(t, err)

		validNoDataNumericExamples, err := es.Filter(examples.FilterOptions{
			Version: data.FrameTypeVersion{0, 1},
			Valid:   new(true),
			Kind:    data.KindNumeric,
			NoData:  new(true),
		})
		require.NoError(t, err)

		for _, example := range validNoDataNumericExamples.AsSlice() {
			t.Run(example.Info().ID, func(t *testing.T) {
				res, err := handleDataplaneNumeric(example.Frames("A"), false)
				require.NoError(t, err)
				require.Len(t, res.Values, 1)
			})
		}
	})

	t.Run("should read correct number of items from examples", func(t *testing.T) {
		es, err := examples.GetExamples()
		require.NoError(t, err)

		numericExamples, err := es.Filter(examples.FilterOptions{
			Version: data.FrameTypeVersion{0, 1},
			Valid:   new(true),
			Kind:    data.KindNumeric,
			NoData:  new(false),
		})
		require.NoError(t, err)

		for _, example := range numericExamples.AsSlice() {
			t.Run(example.Info().ID, func(t *testing.T) {
				res, err := handleDataplaneNumeric(example.Frames("A"), false)
				require.NoError(t, err)
				require.Len(t, res.Values, example.Info().ItemCount)
			})
		}
	})
}

func TestHandleDataplaneTS(t *testing.T) {
	t.Run("no data", func(t *testing.T) {
		es, err := examples.GetExamples()
		require.NoError(t, err)

		validNoDataTSExamples, err := es.Filter(examples.FilterOptions{
			Version: data.FrameTypeVersion{0, 1},
			Valid:   new(true),
			Kind:    data.KindTimeSeries,
			NoData:  new(true),
		})
		require.NoError(t, err)

		for _, example := range validNoDataTSExamples.AsSlice() {
			t.Run(example.Info().ID, func(t *testing.T) {
				res, err := handleDataplaneTimeseries(example.Frames("A"))
				require.NoError(t, err)
				require.Len(t, res.Values, 1)
			})
		}
	})
	t.Run("should read correct number of items from examples", func(t *testing.T) {
		es, err := examples.GetExamples()
		require.NoError(t, err)

		tsExamples, err := es.Filter(examples.FilterOptions{
			Version: data.FrameTypeVersion{0, 1},
			Valid:   new(true),
			Kind:    data.KindTimeSeries,
			NoData:  new(false),
		})
		require.NoError(t, err)

		for _, example := range tsExamples.AsSlice() {
			t.Run(example.Info().ID, func(t *testing.T) {
				res, err := handleDataplaneTimeseries(example.Frames("A"))
				require.NoError(t, err)
				require.Len(t, res.Values, example.Info().ItemCount)
			})
		}
	})
}

func TestSortNumericMetricRefsMatchesDataplane(t *testing.T) {
	tests := []struct {
		name   string
		fields []*data.Field
	}{
		{name: "by metric name", fields: []*data.Field{
			data.NewField("b", data.Labels{"host": "a"}, []float64{1}),
			data.NewField("a", nil, []float64{1}),
			data.NewField("c", data.Labels{"host": "a"}, []float64{1}),
		}},
		{name: "by label string", fields: []*data.Field{
			data.NewField("value", data.Labels{"host": "b"}, []float64{1}),
			data.NewField("value", data.Labels{"host": "a", "env": "prod"}, []float64{1}),
			data.NewField("value", data.Labels{"host": "a"}, []float64{1}),
		}},
		{name: "nil, empty and set labels", fields: []*data.Field{
			data.NewField("value", data.Labels{"host": "a"}, []float64{1}),
			data.NewField("value", nil, []float64{1}),
			data.NewField("value", data.Labels{}, []float64{1}),
			data.NewField("value", nil, []float64{1}),
		}},
		{name: "missing value field", fields: []*data.Field{
			data.NewField("value", data.Labels{"host": "a"}, []float64{1}),
			nil,
			data.NewField("", nil, []float64{1}),
		}},
		{name: "different labels with the same string", fields: []*data.Field{
			data.NewField("value", data.Labels{"a": "b, c=d"}, []float64{1}),
			data.NewField("value", data.Labels{"a": "a"}, []float64{1}),
			data.NewField("value", data.Labels{"a": "b", "c": "d"}, []float64{1}),
		}},
		{name: "equal keys", fields: []*data.Field{
			data.NewField("value", data.Labels{"host": "a"}, []float64{1}),
			data.NewField("value", data.Labels{"host": "a"}, []float64{2}),
			data.NewField("value", data.Labels{"host": "a"}, []float64{3}),
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requireSameOrderAsDataplane(t, tt.fields)
		})
	}
	t.Run("random inputs", func(t *testing.T) {
		rng := rand.New(rand.NewPCG(1, 2))
		for range 500 {
			requireSameOrderAsDataplane(t, randomNumericFields(rng, 1+rng.IntN(300)))
		}
	})
}

func TestSortNumericMetricRefsBuildsEachKeyOnce(t *testing.T) {
	fields := randomNumericFields(rand.New(rand.NewPCG(1, 2)), 500)
	refs := make([]numeric.MetricRef, len(fields))
	for i, f := range fields {
		refs[i] = numeric.MetricRef{ValueField: f}
	}
	keyLen := 0
	keyAllocs := testing.AllocsPerRun(10, func() {
		for _, r := range refs {
			if l := r.GetLabels(); l != nil {
				keyLen += len(l.String())
			}
		}
	})
	buf := make([]numeric.MetricRef, len(refs))
	sortAllocs := testing.AllocsPerRun(10, func() {
		copy(buf, refs)
		sortNumericMetricRefs(buf)
	})
	require.Positive(t, keyLen)
	require.LessOrEqual(t, sortAllocs, keyAllocs+10)
}

func BenchmarkSortNumericMetricRefs(b *testing.B) {
	fields := randomNumericFields(rand.New(rand.NewPCG(1, 2)), 500)
	refs := make([]numeric.MetricRef, len(fields))
	for i, f := range fields {
		refs[i] = numeric.MetricRef{ValueField: f}
	}
	sorts := []struct {
		name string
		sort func([]numeric.MetricRef)
	}{
		{name: "dataplane", sort: numeric.SortNumericMetricRef},
		{name: "precomputed keys", sort: sortNumericMetricRefs},
	}
	buf := make([]numeric.MetricRef, len(refs))
	for _, s := range sorts {
		b.Run(s.name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				copy(buf, refs)
				s.sort(buf)
			}
		})
	}
}

func requireSameOrderAsDataplane(t *testing.T, fields []*data.Field) {
	t.Helper()
	want := make([]numeric.MetricRef, len(fields))
	for i, f := range fields {
		want[i] = numeric.MetricRef{ValueField: f}
	}
	got := slices.Clone(want)
	numeric.SortNumericMetricRef(want)
	sortNumericMetricRefs(got)
	for i := range want {
		require.Same(t, want[i].ValueField, got[i].ValueField, "index %d", i)
	}
}

func randomNumericFields(rng *rand.Rand, n int) []*data.Field {
	names := []string{"value", "value", "cpu", "mem"}
	fields := make([]*data.Field, n)
	for i := range fields {
		var labels data.Labels
		switch rng.IntN(10) {
		case 0:
		case 1:
			labels = data.Labels{}
		default:
			labels = data.Labels{}
			for k := range 1 + rng.IntN(4) {
				labels[fmt.Sprintf("k%d", k)] = fmt.Sprintf("v%d", rng.IntN(20))
			}
		}
		fields[i] = data.NewField(names[rng.IntN(len(names))], labels, []float64{float64(i)})
	}
	return fields
}
