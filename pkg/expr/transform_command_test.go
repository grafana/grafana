package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
)

func transformTestQueries(t *testing.T, refIDs []string, expression string) []Query {
	t.Helper()
	queries := make([]Query, 0, len(refIDs)+1)
	for _, refID := range refIDs {
		queries = append(queries, Query{
			RefID:      refID,
			DataSource: &datasources.DataSource{OrgID: 1, UID: "test", Type: "test"},
			JSON:       json.RawMessage(`{ "datasource": { "uid": "test" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange:  AbsoluteTimeRange{},
		})
	}
	return append(queries, Query{
		RefID:      "T",
		DataSource: dataSourceModel(),
		JSON:       json.RawMessage(expression),
		TimeRange:  AbsoluteTimeRange{},
	})
}

type sidecarCall struct {
	Frames          []*data.Frame     `json:"frames"`
	Transformations []json.RawMessage `json:"transformations"`
	Timezone        string            `json:"timezone"`
}

func fakeSidecar(t *testing.T, handle func(call sidecarCall) (int, any)) (*httptest.Server, *[]sidecarCall) {
	t.Helper()
	calls := []sidecarCall{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/transform", r.URL.Path)
		var call sidecarCall
		require.NoError(t, json.NewDecoder(r.Body).Decode(&call))
		calls = append(calls, call)
		status, body := handle(call)
		w.WriteHeader(status)
		require.NoError(t, json.NewEncoder(w).Encode(body))
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

func TestTransformCommand(t *testing.T) {
	labeled := func(pod string, value float64) *data.Frame {
		return data.NewFrame("",
			data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
			data.NewField("value", data.Labels{"pod": pod}, []float64{value}),
		)
	}
	responses := map[string]backend.DataResponse{
		"A": {Frames: data.Frames{labeled("a", 1), labeled("b", 2)}},
		"B": {Frames: data.Frames{labeled("c", 3)}},
	}

	t.Run("sends raw data source frames and returns the sidecar frames", func(t *testing.T) {
		out := data.NewFrame("", data.NewField("total", nil, []float64{6}))
		srv, calls := fakeSidecar(t, func(sidecarCall) (int, any) {
			return http.StatusOK, map[string]any{"frames": []*data.Frame{out}}
		})

		s, req := newMockQueryService(responses, transformTestQueries(t, []string{"A", "B"},
			`{"type": "transform", "inputs": ["B", "A"], "timezone": "Europe/Oslo",
			  "transformations": [{"id": "merge", "options": {}}, {"id": "reduce", "options": {"reducers": ["sum"]}}]}`))
		s.cfg.TransformSidecarURL = srv.URL + "/"

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)
		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.NoError(t, rsp.Responses["T"].Error)
		require.Len(t, *calls, 1)
		call := (*calls)[0]

		gotInputs := make([]string, 0, len(call.Frames))
		for _, frame := range call.Frames {
			gotInputs = append(gotInputs, fmt.Sprintf("%s/%s", frame.RefID, frame.Fields[1].Labels["pod"]))
		}
		require.Equal(t, []string{"B/c", "A/a", "A/b"}, gotInputs, "frames keep labels and follow the order of 'inputs'")
		require.JSONEq(t, `{"id": "reduce", "options": {"reducers": ["sum"]}}`, string(call.Transformations[1]))
		require.Equal(t, "Europe/Oslo", call.Timezone)

		require.Len(t, rsp.Responses["T"].Frames, 1)
		require.Equal(t, "total", rsp.Responses["T"].Frames[0].Fields[0].Name)
		require.Equal(t, "T", rsp.Responses["T"].Frames[0].RefID)
	})

	t.Run("returns the sidecar error message", func(t *testing.T) {
		srv, _ := fakeSidecar(t, func(sidecarCall) (int, any) {
			return http.StatusBadRequest, map[string]string{"error": "unsupported transformations: heatmap"}
		})
		s, req := newMockQueryService(responses, transformTestQueries(t, []string{"A"},
			`{"type": "transform", "inputs": ["A"], "transformations": [{"id": "heatmap"}]}`))
		s.cfg.TransformSidecarURL = srv.URL

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)
		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.ErrorContains(t, rsp.Responses["T"].Error, "transform sidecar returned 400: unsupported transformations: heatmap")
	})

	t.Run("returns an error instead of panicking on frames without typeInfo", func(t *testing.T) {
		srv, _ := fakeSidecar(t, func(sidecarCall) (int, any) {
			return http.StatusOK, json.RawMessage(`{"frames": [{"schema": {"fields": [{"name": "v", "type": "number"}]}, "data": {"values": [[1]]}}]}`)
		})
		s, req := newMockQueryService(responses, transformTestQueries(t, []string{"A"},
			`{"type": "transform", "inputs": ["A"], "transformations": [{"id": "merge"}]}`))
		s.cfg.TransformSidecarURL = srv.URL

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)
		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.ErrorContains(t, rsp.Responses["T"].Error, "invalid frame")
	})

	t.Run("fails when the sidecar is slower than the timeout", func(t *testing.T) {
		srv, _ := fakeSidecar(t, func(sidecarCall) (int, any) {
			time.Sleep(200 * time.Millisecond)
			return http.StatusOK, map[string]any{"frames": []any{}}
		})
		s, req := newMockQueryService(responses, transformTestQueries(t, []string{"A"},
			`{"type": "transform", "inputs": ["A"], "transformations": [{"id": "merge"}]}`))
		s.cfg.TransformSidecarURL = srv.URL
		s.cfg.TransformSidecarTimeout = 20 * time.Millisecond

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)
		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.ErrorIs(t, rsp.Responses["T"].Error, context.DeadlineExceeded)
	})

	t.Run("is rejected when no sidecar is configured", func(t *testing.T) {
		s, req := newMockQueryService(responses, transformTestQueries(t, []string{"A"},
			`{"type": "transform", "inputs": ["A"], "transformations": [{"id": "merge"}]}`))

		_, err := s.BuildPipeline(t.Context(), req)

		require.ErrorContains(t, err, "transform_sidecar_url is not set")
	})

	t.Run("is rejected without inputs or transformations", func(t *testing.T) {
		for _, expression := range []string{
			`{"type": "transform", "transformations": [{"id": "merge"}]}`,
			`{"type": "transform", "inputs": ["A"], "transformations": []}`,
		} {
			s, req := newMockQueryService(responses, transformTestQueries(t, []string{"A"}, expression))
			s.cfg.TransformSidecarURL = "http://127.0.0.1:1"

			_, err := s.BuildPipeline(t.Context(), req)

			require.Error(t, err, expression)
		}
	})

	t.Run("rejects a query that feeds both a transform and another expression", func(t *testing.T) {
		queries := transformTestQueries(t, []string{"A"},
			`{"type": "transform", "inputs": ["A"], "transformations": [{"id": "merge"}]}`)
		queries = append(queries, Query{
			RefID:      "M",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{"type": "math", "expression": "$A * 2"}`),
			TimeRange:  AbsoluteTimeRange{},
		})
		s, req := newMockQueryService(responses, queries)
		s.cfg.TransformSidecarURL = "http://127.0.0.1:1"

		_, err := s.BuildPipeline(t.Context(), req)

		require.ErrorContains(t, err, "query A is an input to a transform expression, so it can not also be an input to M")
	})
}

// TestTransformCommandWithSidecar runs against a real sidecar:
//
//	node scripts/transform-sidecar/build.mjs && node scripts/transform-sidecar/dist/server.cjs
//	TRANSFORM_SIDECAR_URL=http://127.0.0.1:8095 go test ./pkg/expr -run TestTransformCommandWithSidecar
func TestTransformCommandWithSidecar(t *testing.T) {
	url := os.Getenv("TRANSFORM_SIDECAR_URL")
	if url == "" {
		t.Skip("TRANSFORM_SIDECAR_URL is not set")
	}

	responses := map[string]backend.DataResponse{
		"A": {Frames: data.Frames{data.NewFrame("",
			data.NewField("service", nil, []string{"api", "api", "worker", "idle"}),
			data.NewField("latency", nil, []*float64{new(100.0), new(260.0), new(40.0), nil}),
		)}},
	}
	s, req := newMockQueryService(responses, transformTestQueries(t, []string{"A"}, `{
		"type": "transform",
		"inputs": ["A"],
		"transformations": [{"id": "groupBy", "options": {"fields": {
			"service": {"operation": "groupby", "aggregations": []},
			"latency": {"operation": "aggregate", "aggregations": ["mean"]}
		}}}]
	}`))
	s.cfg.TransformSidecarURL = url

	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)
	rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)
	require.NoError(t, rsp.Responses["T"].Error)

	require.Len(t, rsp.Responses["T"].Frames, 1)
	frame := rsp.Responses["T"].Frames[0]
	require.Equal(t, "latency (mean)", frame.Fields[1].Name)

	means := map[string]*float64{}
	for i := 0; i < frame.Rows(); i++ {
		svc, _ := frame.Fields[0].ConcreteAt(i)
		v, _ := frame.Fields[1].NullableFloatAt(i)
		means[svc.(string)] = v
	}
	require.Equal(t, 180.0, *means["api"])
	require.Equal(t, 40.0, *means["worker"])
	require.Contains(t, means, "idle")
}
