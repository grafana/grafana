package writer

import (
	"context"
	"math"
	"math/rand/v2"
	"net/http"
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/m3db/prometheus_remote_client_golang/promremote"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/prometheus/prompb"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestValidateSettings(t *testing.T) {
	for _, tc := range []struct {
		name     string
		settings setting.RecordingRuleSettings
		err      bool
	}{
		{
			name: "invalid url",
			settings: setting.RecordingRuleSettings{
				URL: "invalid url",
			},
			err: true,
		},
		{
			name: "missing password",
			settings: setting.RecordingRuleSettings{
				URL:               "http://localhost:9090",
				BasicAuthUsername: "user",
			},
			err: true,
		},
		{
			name: "timeout is 0",
			settings: setting.RecordingRuleSettings{
				URL:               "http://localhost:9090",
				BasicAuthUsername: "user",
				BasicAuthPassword: "password",
				Timeout:           0,
			},
			err: true,
		},
		{
			name: "valid settings w/ auth",
			settings: setting.RecordingRuleSettings{
				URL:               "http://localhost:9090",
				BasicAuthUsername: "user",
				BasicAuthPassword: "password",
				Timeout:           10,
			},
			err: false,
		},
		{
			name: "valid settings w/o auth",
			settings: setting.RecordingRuleSettings{
				URL:     "http://localhost:9090",
				Timeout: 10,
			},
			err: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := validateSettings(tc.settings)
			if tc.err {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestPointsFromFrames(t *testing.T) {
	extraLabels := map[string]string{"extra": "label"}

	type testCase struct {
		name      string
		frameType data.FrameType
	}

	testCases := []testCase{
		{name: "wide", frameType: data.FrameTypeNumericWide},
		{name: "long", frameType: data.FrameTypeNumericLong},
		{name: "multi", frameType: data.FrameTypeNumericMulti},
	}

	t.Run("error when frames are empty", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				frames := data.Frames{data.NewFrame("test")}
				now := time.Now()

				_, err := PointsFromFrames("test", now, frames, extraLabels)
				require.Error(t, err)
			})
		}
	})

	t.Run("maps frames correctly", func(t *testing.T) {
		series := []map[string]string{{"foo": "1"}, {"foo": "2"}, {"foo": "3"}, {"foo": "4"}}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				frames := frameGenFromLabels(t, tc.frameType, series)
				now := time.Now()

				points, err := PointsFromFrames("test", now, frames, extraLabels)

				require.NoError(t, err)
				require.Len(t, points, len(series))
				for i, point := range points {
					v := extractValue(t, frames, series[i], tc.frameType)
					expectedLabels := map[string]string{"extra": "label"}
					for k, v := range series[i] {
						expectedLabels[k] = v
					}
					require.Equal(t, expectedLabels, point.Labels)
					require.Equal(t, "test", point.Name)
					require.Equal(t, now, point.Metric.T)
					require.Equal(t, v, point.Metric.V)
				}
			})
		}
	})
}

func TestPrometheusWriter_Write(t *testing.T) {
	client := &testClient{}
	writer := &PrometheusWriter{
		client:  client,
		clock:   clock.New(),
		logger:  log.New("test"),
		metrics: metrics.NewRemoteWriterMetrics(prometheus.NewRegistry()),
	}
	now := time.Now()
	series := []map[string]string{{"foo": "1"}, {"foo": "2"}, {"foo": "3"}, {"foo": "4"}}
	frames := frameGenFromLabels(t, data.FrameTypeNumericWide, series)
	emptyFrames := data.Frames{data.NewFrame("test")}

	ctx := ngmodels.WithRuleKey(context.Background(), ngmodels.GenerateRuleKey(1))

	t.Run("error when frames are empty", func(t *testing.T) {
		err := writer.Write(ctx, "test", now, emptyFrames, 1, map[string]string{})
		require.Error(t, err)
	})

	t.Run("include client error when client fails", func(t *testing.T) {
		clientErr := testClientWriteError{statusCode: http.StatusInternalServerError}
		client.writeSeriesFunc = func(ctx context.Context, ts promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError) {
			return promremote.WriteResult{}, clientErr
		}

		err := writer.Write(ctx, "test", now, frames, 1, map[string]string{})
		require.Error(t, err)
		require.ErrorIs(t, err, clientErr)
		require.ErrorIs(t, err, ErrUnexpectedWriteFailure)
	})

	t.Run("writes expected points", func(t *testing.T) {
		client.writeSeriesFunc = func(ctx context.Context, tslist promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError) {
			require.Len(t, tslist, len(series))
			for i, ts := range tslist {
				expectedLabels := []promremote.Label{
					{Name: "__name__", Value: "test"},
					{Name: "extra", Value: "label"},
					{Name: "foo", Value: series[i]["foo"]},
				}
				require.ElementsMatch(t, expectedLabels, ts.Labels)
				require.Equal(t, now, ts.Datapoint.Timestamp)
				require.Equal(t, extractValue(t, frames, series[i], data.FrameTypeNumericWide), ts.Datapoint.Value)
			}
			return promremote.WriteResult{}, nil
		}

		err := writer.Write(ctx, "test", now, frames, 1, map[string]string{"extra": "label"})
		require.NoError(t, err)
	})

	t.Run("ignores client error when status code is 400 and message contains duplicate timestamp error", func(t *testing.T) {
		for _, msg := range DuplicateTimestampErrors {
			t.Run(msg, func(t *testing.T) {
				clientErr := testClientWriteError{
					statusCode: http.StatusBadRequest,
					msg:        &msg,
				}
				client.writeSeriesFunc = func(ctx context.Context, ts promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError) {
					return promremote.WriteResult{}, clientErr
				}

				err := writer.Write(ctx, "test", now, frames, 1, map[string]string{"extra": "label"})
				require.NoError(t, err)
			})
		}
	})

	t.Run("bad labels fit under the client error category", func(t *testing.T) {
		msg := MimirInvalidLabelError
		clientErr := testClientWriteError{
			statusCode: http.StatusBadRequest,
			msg:        &msg,
		}
		client.writeSeriesFunc = func(ctx context.Context, ts promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError) {
			return promremote.WriteResult{}, clientErr
		}

		err := writer.Write(ctx, "test", now, frames, 1, map[string]string{"extra": "label"})

		require.Error(t, err)
		require.ErrorIs(t, err, ErrRejectedWrite)
	})

	t.Run("max series limit fit under the client error category ", func(t *testing.T) {
		msg := "send data to ingesters: failed pushing to ingester ingester-1: user=1: per-user series limit of 10 exceeded (err-mimir-max-series-per-user). To adjust the related per-tenant limit, configure -ingester.max-global-series-per-user, or contact your service administrator."
		clientErr := testClientWriteError{
			statusCode: http.StatusBadRequest,
			msg:        &msg,
		}
		client.writeSeriesFunc = func(ctx context.Context, ts promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError) {
			return promremote.WriteResult{}, clientErr
		}

		err := writer.Write(ctx, "test", now, frames, 1, map[string]string{"extra": "label"})

		require.Error(t, err)
		require.ErrorIs(t, err, ErrRejectedWrite)
	})

	t.Run("too long labels fit under the client error category", func(t *testing.T) {
		msg := "received a series whose label value length exceeds the limit, label: 'label-1', value: 'value-1' (truncated) series: 'some_series' (err-mimir-label-value-too-long). To adjust the related per-tenant limit, configure -validation.max-length-label-value, or contact your service administrator."
		clientErr := testClientWriteError{
			statusCode: http.StatusBadRequest,
			msg:        &msg,
		}
		client.writeSeriesFunc = func(ctx context.Context, ts promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError) {
			return promremote.WriteResult{}, clientErr
		}

		err := writer.Write(ctx, "test", now, frames, 1, map[string]string{"extra": "label"})

		require.Error(t, err)
		require.ErrorIs(t, err, ErrRejectedWrite)
	})

	t.Run("too many labels fit under the client error category", func(t *testing.T) {
		msg := "received a series whose number of labels exceeds the limit (actual: 50, limit: 40) series: 'some_series' (err-mimir-max-label-names-per-series). To adjust the related per-tenant limit, configure -validation.max-label-names-per-series, or contact your service administrator."
		clientErr := testClientWriteError{
			statusCode: http.StatusBadRequest,
			msg:        &msg,
		}
		client.writeSeriesFunc = func(ctx context.Context, ts promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError) {
			return promremote.WriteResult{}, clientErr
		}

		err := writer.Write(ctx, "test", now, frames, 1, map[string]string{"extra": "label"})

		require.Error(t, err)
		require.ErrorIs(t, err, ErrRejectedWrite)
	})
}

func extractValue(t *testing.T, frames data.Frames, labels map[string]string, frameType data.FrameType) float64 {
	t.Helper()

	var f func(*testing.T, data.Frames, map[string]string) float64

	switch frames[0].Meta.Type {
	case data.FrameTypeNumericWide:
		f = extractValueWide
	case data.FrameTypeNumericLong:
		f = extractValueLong
	case data.FrameTypeNumericMulti:
		f = extractValueMulti
	default:
		t.Fatalf("unsupported frame type %q", frameType)
	}

	return f(t, frames, labels)
}

func extractValueWide(t *testing.T, frames data.Frames, labels map[string]string) float64 {
	t.Helper()

	frame := frames[0]
	for _, field := range frame.Fields {
		if reflect.DeepEqual(field.Labels, data.Labels(labels)) {
			return field.At(0).(float64)
		}
	}

	t.Fatalf("could not find value for labels %v", labels)
	return math.NaN()
}

func extractValueLong(t *testing.T, frames data.Frames, labels map[string]string) float64 {
	t.Helper()

	frame := frames[0]
	foundLabels := make(map[string]string)

	l := frame.Fields[0].Len()
	for i := 0; i < l; i++ {
		for _, field := range frame.Fields[1 : len(frame.Fields)-1] {
			foundLabels[field.Name] = field.At(i).(string)
		}
		if reflect.DeepEqual(foundLabels, labels) {
			return frame.Fields[len(frame.Fields)-1].At(i).(float64)
		}
	}

	t.Fatalf("could not find value for labels %v", labels)
	return math.NaN()
}

func extractValueMulti(t *testing.T, frames data.Frames, labels map[string]string) float64 {
	t.Helper()

	for _, frame := range frames {
		if reflect.DeepEqual(frame.Fields[1].Labels, data.Labels(labels)) {
			return frame.Fields[1].At(0).(float64)
		}
	}

	t.Fatalf("could not find value for labels %v", labels)
	return math.NaN()
}

func frameGenFromLabels(t *testing.T, frameType data.FrameType, labelSet []map[string]string) data.Frames {
	var f func(*testing.T, []map[string]string) data.Frames

	switch frameType {
	case data.FrameTypeNumericWide:
		f = frameGenWide
	case data.FrameTypeNumericLong:
		f = frameGenLong
	case data.FrameTypeNumericMulti:
		f = frameGenMulti
	default:
		return nil
	}

	return f(t, labelSet)
}

func frameGenWide(t *testing.T, labelMaps []map[string]string) data.Frames {
	t.Helper()

	frame := data.NewFrame("test", fieldGenWide(t, time.Now(), labelMaps)...)
	frame.SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeNumericWide,
		TypeVersion: data.FrameTypeVersion{0, 1},
	})
	return data.Frames{frame}
}

func fieldGenWide(t *testing.T, tt time.Time, labelSet []map[string]string) []*data.Field {
	t.Helper()

	fields := make([]*data.Field, 1, len(labelSet)+1)
	fields[0] = data.NewField("T", nil, []time.Time{tt})
	for _, labels := range labelSet {
		field := data.NewField("value", data.Labels(labels), []float64{rand.Float64() * (100 - 0)}) // arbitrary range
		fields = append(fields, field)
	}
	return fields
}

func frameGenLong(t *testing.T, labelSet []map[string]string) data.Frames {
	t.Helper()

	frame := data.NewFrame("test", fieldGenLong(time.Now(), labelSet)...)
	frame.SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeNumericLong,
		TypeVersion: data.FrameTypeVersion{0, 1},
	})

	return data.Frames{frame}
}

func fieldGenLong(t time.Time, labelSet []map[string]string) []*data.Field {
	fields := make([]*data.Field, 1, len(labelSet)+1)
	times := make([]time.Time, 0, len(labelSet))
	labelFields := make(map[string][]string)
	values := make([]float64, 0, len(labelSet))

	for _, labels := range labelSet {
		times = append(times, t)
		for k, v := range labels {
			if !slices.Contains(labelFields[k], v) {
				labelFields[k] = append(labelFields[k], v)
			}
		}
		values = append(values, rand.Float64()*(100-0)) // arbitrary range
	}
	fields[0] = data.NewField("T", nil, times)
	for k, v := range labelFields {
		fields = append(fields, data.NewField(k, nil, v))
	}
	fields = append(fields, data.NewField("value", nil, values))

	return fields
}

func frameGenMulti(t *testing.T, labelSet []map[string]string) data.Frames {
	t.Helper()

	frames := make(data.Frames, 0, len(labelSet))
	now := time.Now()
	for _, labels := range labelSet {
		frame := data.NewFrame("test",
			data.NewField("T", nil, []time.Time{now}),
			data.NewField("value", data.Labels(labels), []float64{rand.Float64() * (100 - 0)}),
		)
		frame.SetMeta(&data.FrameMeta{
			Type:        data.FrameTypeNumericMulti,
			TypeVersion: data.FrameTypeVersion{0, 1},
		})
		frames = append(frames, frame)
	}

	return frames
}

type testClient struct {
	writeSeriesFunc func(ctx context.Context, ts promremote.TSList, opts promremote.WriteOptions) (promremote.WriteResult, promremote.WriteError)
}

func (c *testClient) WriteProto(
	ctx context.Context,
	req *prompb.WriteRequest,
	opts promremote.WriteOptions,
) (promremote.WriteResult, promremote.WriteError) {
	return promremote.WriteResult{}, nil
}

func (c *testClient) WriteTimeSeries(
	ctx context.Context,
	ts promremote.TSList,
	opts promremote.WriteOptions,
) (promremote.WriteResult, promremote.WriteError) {
	if c.writeSeriesFunc != nil {
		return c.writeSeriesFunc(ctx, ts, opts)
	}

	return promremote.WriteResult{}, nil
}

type testClientWriteError struct {
	statusCode int
	msg        *string
}

func (e testClientWriteError) StatusCode() int {
	return e.statusCode
}

func (e testClientWriteError) Error() string {
	if e.msg == nil {
		return "test error"
	}
	return *e.msg
}
