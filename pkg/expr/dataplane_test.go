package expr

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/dataplane/examples"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
)

func TestPassThroughDataplaneExamples(t *testing.T) {
	es, err := examples.GetExamples()
	require.NoError(t, err)

	validExamples, err := es.Filter(examples.FilterOptions{
		Version: data.FrameTypeVersion{0, 1},
		Valid:   util.Pointer(true),
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
		Frames: frames,
	}

	cfg := setting.NewCfg()

	s := Service{
		cfg:         cfg,
		dataService: me,
		features:    &featuremgmt.FeatureManager{},
		pCtxProvider: plugincontext.ProvideService(nil, &plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{
				{JSONData: plugins.JSONData{ID: "test"}},
			}},
			&datafakes.FakeDataSourceService{}, nil),
		metrics: newMetrics(nil),
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

	pl, err := s.BuildPipeline(req)
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
			Valid:   util.Pointer(true),
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
			Valid:   util.Pointer(true),
			Kind:    data.KindNumeric,
			NoData:  util.Pointer(true),
		})
		require.NoError(t, err)

		for _, example := range validNoDataNumericExamples.AsSlice() {
			t.Run(example.Info().ID, func(t *testing.T) {
				res, err := handleDataplaneNumeric(example.Frames("A"))
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
			Valid:   util.Pointer(true),
			Kind:    data.KindNumeric,
			NoData:  util.Pointer(false),
		})
		require.NoError(t, err)

		for _, example := range numericExamples.AsSlice() {
			t.Run(example.Info().ID, func(t *testing.T) {
				res, err := handleDataplaneNumeric(example.Frames("A"))
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
			Valid:   util.Pointer(true),
			Kind:    data.KindTimeSeries,
			NoData:  util.Pointer(true),
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
			Valid:   util.Pointer(true),
			Kind:    data.KindTimeSeries,
			NoData:  util.Pointer(false),
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
