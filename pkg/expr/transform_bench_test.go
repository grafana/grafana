package expr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type benchWorkload struct {
	name            string
	build           func() data.Frames
	transformations string
	// native is an expression over "A" that computes the same result without the sidecar.
	native      string
	nativeLabel string
}

// benchPromSeries builds multi-frame series. With misaligned set, each series starts up to four
// steps later than the previous one, so the series don't share timestamps.
func benchPromSeries(series, points int, misaligned bool) data.Frames {
	frames := make(data.Frames, series)
	for s := range frames {
		offset := 0
		if misaligned {
			offset = s % 5
		}
		times := make([]time.Time, points)
		for i := range times {
			times[i] = parityStart.Add(time.Duration(i+offset) * 15 * time.Second)
		}
		values := make([]float64, points)
		for i := range values {
			values[i] = float64((s*31+i*7)%1000) / 10
		}
		frame := data.NewFrame("",
			data.NewField("time", nil, times),
			data.NewField("value", data.Labels{"pod": fmt.Sprintf("pod-%04d", s), "job": "app"}, values),
		)
		frame.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti, TypeVersion: data.FrameTypeVersion{0, 1}}
		frames[s] = frame
	}
	return frames
}

func benchLogs(rows int) data.Frames {
	levels := []string{"info", "info", "info", "warn", "error"}
	times := make([]time.Time, rows)
	level := make([]string, rows)
	line := make([]string, rows)
	for i := range rows {
		times[i] = parityStart.Add(time.Duration(i) * time.Millisecond)
		level[i] = levels[i%len(levels)]
		line[i] = fmt.Sprintf("ts=%d level=%s caller=handler.go:%d msg=\"request completed\" path=/api/v1/items/%d status=200", i, level[i], i%400, i)
	}
	return data.Frames{data.NewFrame("",
		data.NewField("time", nil, times),
		data.NewField("level", nil, level),
		data.NewField("line", nil, line),
	)}
}

func benchTable(rows, services int) data.Frames {
	service := make([]string, rows)
	latency := make([]float64, rows)
	for i := range rows {
		service[i] = fmt.Sprintf("svc-%03d", i%services)
		latency[i] = float64((i * 13) % 500)
	}
	return data.Frames{data.NewFrame("",
		data.NewField("service", nil, service),
		data.NewField("latency", nil, latency),
	)}
}

func benchWorkloads() []benchWorkload {
	return []benchWorkload{
		{
			name:            "prom-1k-series-x-1k-points-reduce",
			build:           func() data.Frames { return benchPromSeries(1000, 1000, false) },
			transformations: `[{"id":"reduce","options":{"reducers":["mean"]}}]`,
			native:          `{"type": "reduce", "expression": "A", "reducer": "mean"}`,
			nativeLabel:     "SSE reduce",
		},
		{
			name:            "prom-1k-series-x-1k-points-join-outer",
			build:           func() data.Frames { return benchPromSeries(1000, 1000, false) },
			transformations: `[{"id":"joinByField","options":{"mode":"outer"}}]`,
		},
		{
			name:            "prom-1k-misaligned-series-join-outer",
			build:           func() data.Frames { return benchPromSeries(1000, 1000, true) },
			transformations: `[{"id":"joinByField","options":{"mode":"outer"}}]`,
		},
		{
			name:            "logs-50k-filter-sort",
			build:           func() data.Frames { return benchLogs(50_000) },
			transformations: `[{"id":"filterByValue","options":{"filters":[{"fieldName":"level","config":{"id":"equal","options":{"value":"error"}}}],"type":"include","match":"any"}},{"id":"sortBy","options":{"sort":[{"field":"time","desc":true}]}}]`,
			native:          `{"type": "sql", "expression": "SELECT * FROM A WHERE level = 'error' ORDER BY time DESC"}`,
			nativeLabel:     "SQL expression",
		},
		{
			name:            "table-100k-groupby-mean",
			build:           func() data.Frames { return benchTable(100_000, 100) },
			transformations: `[{"id":"groupBy","options":{"fields":{"service":{"operation":"groupby","aggregations":[]},"latency":{"operation":"aggregate","aggregations":["mean"]}}}}]`,
			native:          `{"type": "sql", "expression": "SELECT service, AVG(latency) AS latency FROM A GROUP BY service"}`,
			nativeLabel:     "SQL expression",
		},
	}
}

type benchStages struct {
	GoEncodeMs    float64            `json:"goEncodeMs"`
	SidecarHTTPMs float64            `json:"sidecarHttpMs"`
	SidecarMs     map[string]float64 `json:"sidecarStagesMs"`
	GoDecodeMs    float64            `json:"goDecodeMs"`
	PipelineMs    float64            `json:"pipelineMs"`
	NativeMs      float64            `json:"nativeMs,omitempty"`
}

type benchResult struct {
	Name          string      `json:"name"`
	Format        string      `json:"format"`
	RequestBytes  int         `json:"requestBytes"`
	ResponseBytes int         `json:"responseBytes"`
	Median        benchStages `json:"median"`
	NativeLabel   string      `json:"nativeLabel,omitempty"`
	Concurrency   struct {
		Requests     int     `json:"requests"`
		P50Ms        float64 `json:"p50Ms"`
		P99Ms        float64 `json:"p99Ms"`
		MaxRSSBytes  float64 `json:"maxRssBytes"`
		ErrorsOrBusy int     `json:"errorsOrBusy"`
	} `json:"concurrency"`
}

func msSince(start time.Time) float64 {
	return float64(time.Since(start).Microseconds()) / 1000
}

func median(values []float64) float64 {
	sorted := slices.Clone(values)
	slices.Sort(sorted)
	return sorted[len(sorted)/2]
}

func percentile(values []float64, p float64) float64 {
	sorted := slices.Clone(values)
	slices.Sort(sorted)
	return sorted[min(len(sorted)-1, int(float64(len(sorted))*p))]
}

// parseServerTiming reads "stage;dur=1.23, other;dur=4.56".
func parseServerTiming(header string) map[string]float64 {
	out := map[string]float64{}
	for _, part := range strings.Split(header, ",") {
		name, dur, ok := strings.Cut(strings.TrimSpace(part), ";dur=")
		if !ok {
			continue
		}
		if v, err := strconv.ParseFloat(dur, 64); err == nil {
			out[name] = v
		}
	}
	return out
}

func postSidecar(url, contentType string, payload []byte) (*http.Response, []byte, error) {
	resp, err := http.Post(url+"/transform", contentType, bytes.NewReader(payload))
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(resp.Body)
	return resp, body, err
}

// TestTransformSidecarBenchmark measures each stage of a transform expression on large
// workloads, and compares the full pipeline with a Go-native expression where one exists. It
// writes <name>.input.json and <name>.output.json for the browser baseline in
// scripts/transform-sidecar/bench, plus results.json. Run it with scripts/transform-sidecar/bench/run.sh.
func TestTransformSidecarBenchmark(t *testing.T) {
	url := os.Getenv("TRANSFORM_SIDECAR_URL")
	outDir := os.Getenv("TRANSFORM_BENCH_OUT")
	if url == "" || outDir == "" {
		t.Skip("TRANSFORM_SIDECAR_URL and TRANSFORM_BENCH_OUT are not set")
	}
	iterations := 5
	if v, err := strconv.Atoi(os.Getenv("TRANSFORM_BENCH_ITERATIONS")); err == nil && v > 0 {
		iterations = v
	}
	require.NoError(t, os.MkdirAll(outDir, 0o750))
	formats := []string{TransformWireFormatJSON, TransformWireFormatArrow}
	if v := os.Getenv("TRANSFORM_BENCH_FORMATS"); v != "" {
		formats = strings.Split(v, ",")
	}

	results := []benchResult{}
	for _, w := range benchWorkloads() {
		frames := w.build()
		for _, f := range frames {
			f.RefID = "A"
		}

		var transformations []json.RawMessage
		require.NoError(t, json.Unmarshal([]byte(w.transformations), &transformations))

		inputJSON, err := json.Marshal(frames)
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(filepath.Join(outDir, w.name+".input.json"),
			[]byte(fmt.Sprintf(`{"transformations": %s, "input": %s}`, w.transformations, inputJSON)), 0o600))

		runPipeline := func(expression, wireFormat string, sql bool) (*backend.QueryDataResponse, float64) {
			s, req := newMockQueryService(map[string]backend.DataResponse{"A": {Frames: frames}}, transformTestQueries(t, []string{"A"}, expression))
			s.cfg.TransformSidecarURL = url
			s.cfg.TransformSidecarTimeout = time.Minute
			s.cfg.TransformSidecarFormat = wireFormat
			s.cfg.SQLExpressionCellLimit = 0
			s.cfg.SQLExpressionOutputCellLimit = 0
			s.cfg.SQLExpressionTimeout = time.Minute
			if sql {
				s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)
			}
			start := time.Now()
			pl, err := s.BuildPipeline(t.Context(), req)
			require.NoError(t, err)
			rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
			require.NoError(t, err)
			require.NoError(t, rsp.Responses["T"].Error)
			return rsp, msSince(start)
		}
		transformExpression := fmt.Sprintf(`{"type": "transform", "inputs": ["A"], "transformations": %s}`, w.transformations)

		for _, wireFormat := range formats {
			result := benchResult{Name: w.name, Format: wireFormat, NativeLabel: w.nativeLabel}
			tc := &TransformCommand{transformations: transformations, wireFormat: wireFormat}
			payload, contentType, err := tc.encodeRequest(frames)
			require.NoError(t, err)
			result.RequestBytes = len(payload)
			// For iterating on the sidecar's decoders without Go in the loop (bench/decode.ts).
			require.NoError(t, os.WriteFile(filepath.Join(outDir, w.name+".request."+wireFormat), payload, 0o600))

			var stages []benchStages
			for i := range iterations + 1 {
				var st benchStages

				start := time.Now()
				body, _, err := tc.encodeRequest(frames)
				require.NoError(t, err)
				st.GoEncodeMs = msSince(start)

				start = time.Now()
				resp, raw, err := postSidecar(url, contentType, body)
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, resp.StatusCode, string(raw))
				st.SidecarHTTPMs = msSince(start)
				st.SidecarMs = parseServerTiming(resp.Header.Get("Server-Timing"))
				result.ResponseBytes = len(raw)

				start = time.Now()
				_, err = decodeSidecarResponse(resp.Header.Get("Content-Type"), raw)
				require.NoError(t, err)
				st.GoDecodeMs = msSince(start)

				rsp, pipelineMs := runPipeline(transformExpression, wireFormat, false)
				st.PipelineMs = pipelineMs
				if i == 0 && wireFormat == formats[0] {
					outputJSON, err := json.Marshal(rsp.Responses["T"].Frames)
					require.NoError(t, err)
					require.NoError(t, os.WriteFile(filepath.Join(outDir, w.name+".output.json"), outputJSON, 0o600))
				}

				if w.native != "" {
					_, st.NativeMs = runPipeline(w.native, wireFormat, w.nativeLabel == "SQL expression")
				}
				if i > 0 { // the first run warms up both sides
					stages = append(stages, st)
				}
			}

			pick := func(get func(benchStages) float64) float64 {
				values := make([]float64, len(stages))
				for i, st := range stages {
					values[i] = get(st)
				}
				return median(values)
			}
			result.Median = benchStages{
				GoEncodeMs:    pick(func(s benchStages) float64 { return s.GoEncodeMs }),
				SidecarHTTPMs: pick(func(s benchStages) float64 { return s.SidecarHTTPMs }),
				GoDecodeMs:    pick(func(s benchStages) float64 { return s.GoDecodeMs }),
				PipelineMs:    pick(func(s benchStages) float64 { return s.PipelineMs }),
				NativeMs:      pick(func(s benchStages) float64 { return s.NativeMs }),
				SidecarMs:     map[string]float64{},
			}
			for stage := range stages[0].SidecarMs {
				result.Median.SidecarMs[stage] = pick(func(s benchStages) float64 { return s.SidecarMs[stage] })
			}

			result.Concurrency.Requests, result.Concurrency.P50Ms, result.Concurrency.P99Ms, result.Concurrency.MaxRSSBytes, result.Concurrency.ErrorsOrBusy =
				benchConcurrency(url, contentType, payload, 10, 3)

			t.Logf("%s (%s): %+v", w.name, wireFormat, result)
			results = append(results, result)
		}
	}

	raw, err := json.MarshalIndent(results, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(outDir, "results.json"), raw, 0o600))
}

// benchConcurrency sends rounds of parallel requests and samples the sidecar's memory meanwhile.
func benchConcurrency(url, contentType string, payload []byte, parallel, rounds int) (requests int, p50, p99, maxRSS float64, failed int) {
	stop := make(chan struct{})
	rssDone := make(chan float64)
	go func() {
		peak := 0.0
		for {
			select {
			case <-stop:
				rssDone <- peak
				return
			case <-time.After(50 * time.Millisecond):
				resp, err := http.Get(url + "/health")
				if err != nil {
					continue
				}
				var health struct {
					Memory struct {
						RSS float64 `json:"rss"`
					} `json:"memory"`
				}
				_ = json.NewDecoder(resp.Body).Decode(&health)
				_ = resp.Body.Close()
				peak = max(peak, health.Memory.RSS)
			}
		}
	}()

	var mu sync.Mutex
	latencies := []float64{}
	for range rounds {
		var wg sync.WaitGroup
		for range parallel {
			wg.Go(func() {
				start := time.Now()
				resp, _, err := postSidecar(url, contentType, payload)
				mu.Lock()
				defer mu.Unlock()
				if err != nil || resp.StatusCode != http.StatusOK {
					failed++
					return
				}
				latencies = append(latencies, msSince(start))
			})
		}
		wg.Wait()
	}
	close(stop)
	maxRSS = <-rssDone

	if len(latencies) == 0 {
		return parallel * rounds, 0, 0, maxRSS, failed
	}
	return parallel * rounds, percentile(latencies, 0.5), percentile(latencies, 0.99), maxRSS, failed
}
