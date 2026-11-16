package graphite

import (
	"bytes"
	"encoding/json"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"runtime/metrics"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/iotest"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type renderPoint struct {
	ts    int64
	value *float64
}

func pt(ts int64, v float64) renderPoint { return renderPoint{ts: ts, value: &v} }

func nullPt(ts int64) renderPoint { return renderPoint{ts: ts} }

func renderFrame(target string, labels data.Labels, points ...renderPoint) *data.Frame {
	times := make([]time.Time, len(points))
	values := make([]*float64, len(points))
	for i, p := range points {
		times[i] = time.Unix(p.ts, 0).UTC()
		values[i] = p.value
	}
	frame := data.NewFrame("",
		data.NewField("time", nil, times),
		data.NewField("value", labels, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: target})).SetMeta(
		&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})
	frame.RefID = "A"
	return frame
}

// diffFrames compares frames field by field, telling -0 from 0 and nil labels from empty ones.
func diffFrames(want, got data.Frames) string {
	if len(want) != len(got) {
		return fmt.Sprintf("got %d frames, want %d", len(got), len(want))
	}
	for i := range want {
		w, g := want[i], got[i]
		if w.Name != g.Name || w.RefID != g.RefID {
			return fmt.Sprintf("frame %d: got name %q refID %q, want %q %q", i, g.Name, g.RefID, w.Name, w.RefID)
		}
		if !reflect.DeepEqual(w.Meta, g.Meta) {
			return fmt.Sprintf("frame %d: got meta %+v, want %+v", i, g.Meta, w.Meta)
		}
		if len(w.Fields) != len(g.Fields) {
			return fmt.Sprintf("frame %d: got %d fields, want %d", i, len(g.Fields), len(w.Fields))
		}
		for j := range w.Fields {
			wf, gf := w.Fields[j], g.Fields[j]
			if wf.Name != gf.Name || wf.Type() != gf.Type() || wf.Len() != gf.Len() {
				return fmt.Sprintf("frame %d field %d: got %q %s len %d, want %q %s len %d", i, j, gf.Name, gf.Type(), gf.Len(), wf.Name, wf.Type(), wf.Len())
			}
			if !reflect.DeepEqual(wf.Labels, gf.Labels) {
				return fmt.Sprintf("frame %d field %q: got labels %#v, want %#v", i, wf.Name, gf.Labels, wf.Labels)
			}
			if !reflect.DeepEqual(wf.Config, gf.Config) {
				return fmt.Sprintf("frame %d field %q: got config %+v, want %+v", i, wf.Name, gf.Config, wf.Config)
			}
			for k := range wf.Len() {
				if !sameRenderValue(wf.At(k), gf.At(k)) {
					return fmt.Sprintf("frame %d field %q row %d: got %s, want %s", i, wf.Name, k, renderValueString(gf.At(k)), renderValueString(wf.At(k)))
				}
			}
		}
	}
	return ""
}

func sameRenderValue(want, got any) bool {
	switch w := want.(type) {
	case *float64:
		g := got.(*float64)
		if w == nil || g == nil {
			return w == nil && g == nil
		}
		return math.Float64bits(*w) == math.Float64bits(*g)
	case time.Time:
		g := got.(time.Time)
		return w.Equal(g) && w.Location() == g.Location()
	}
	return reflect.DeepEqual(want, got)
}

func renderValueString(v any) string {
	if p, ok := v.(*float64); ok {
		if p == nil {
			return "null"
		}
		return strconv.FormatFloat(*p, 'g', -1, 64)
	}
	return fmt.Sprint(v)
}

func requireFramesEqual(t *testing.T, want, got data.Frames) {
	t.Helper()
	if d := diffFrames(want, got); d != "" {
		t.Fatal(d)
	}
}

func errorSource(err error) backend.ErrorSource {
	return backend.ErrorResponseWithErrorSource(err).ErrorSource
}

func decodeRenderBuffered(body []byte) (data.Frames, error) {
	s := &Service{logger: log.NewNullLogger()}
	return s.toDataFrames(&http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(body))}, "A")
}

var renderReaders = []struct {
	name string
	wrap func(io.Reader) io.Reader
}{
	{"whole", func(r io.Reader) io.Reader { return r }},
	{"one byte", iotest.OneByteReader},
	{"half", iotest.HalfReader},
	{"data with EOF", iotest.DataErrReader},
}

func TestDecodeRender(t *testing.T) {
	inf, ninf := math.Inf(1), math.Inf(-1)
	digits302 := "1" + strings.Repeat("0", 301)
	digits310 := "1" + strings.Repeat("0", 309)

	tests := []renderTestCase{
		{
			name: "legacy form with meta at both levels",
			body: `{"version":"v0.1","meta":{"stats":{"executeplan.resolve-series.ms":1},"x":[1,{"y":null}]},"series":[{"target":"a","meta":[{"schema-name":"default","count":1}],"tags":{"name":"a"},"datapoints":[[1,100]]}]}`,
			want: data.Frames{renderFrame("a", data.Labels{"name": "a"}, pt(100, 1))},
		},
		{
			name: "legacy form with series first",
			body: `{"series":[{"target":"a","datapoints":[[1,100]]}],"meta":{"stats":{}},"version":"v0.1"}`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1))},
		},
		{
			name: "legacy form without series",
			body: `{"version":"v0.1","meta":{}}`,
			want: data.Frames{},
		},
		{
			name: "legacy series null",
			body: `{"series":null}`,
			want: data.Frames{},
		},
		{
			name:    "legacy series not an array",
			body:    `{"series":{}}`,
			wantErr: "series", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "string, numeric and bool tags",
			body: `[{"target":"a","tags":{"s":"v","i":5,"f":3.25,"big":1e21,"neg":-0,"b":true,"z":null,"o":{"k":"v"},"l":[1]},"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{"s": "v", "i": "5", "f": "3.25", "big": "1000000000000000000000", "neg": "-0"}, pt(100, 1))},
		},
		{
			name: "name tag keeps the target up to the first semicolon",
			body: `[{"target":"cpu.usage;env=prod;host=web01","tags":{"name":"cpu.usage;env=prod;host=web01","env":"prod"},"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("cpu.usage;env=prod;host=web01", data.Labels{"name": "cpu.usage", "env": "prod"}, pt(100, 1))},
		},
		{
			name: "name tag of any type takes the target",
			body: `[{"tags":{"name":true},"datapoints":[[1,100]],"target":"alias(x, 'y')"}]`,
			want: data.Frames{renderFrame("alias(x, 'y')", data.Labels{"name": "alias(x, 'y')"}, pt(100, 1))},
		},
		{
			name: "duplicate tag key keeps the last value",
			body: `[{"target":"a","tags":{"k":"1","k":"2","d":"x","d":false},"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{"k": "2"}, pt(100, 1))},
		},
		{
			name: "duplicate tags objects merge",
			body: `[{"target":"a","tags":{"x":"1","y":"1"},"tags":{"y":"2"},"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{"x": "1", "y": "2"}, pt(100, 1))},
		},
		{
			name: "tags null clears earlier tags",
			body: `[{"target":"a","tags":{"name":"a","x":"1"},"tags":null,"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1))},
		},
		{
			name:    "tags not an object",
			body:    `[{"target":"a","tags":[],"datapoints":[[1,100]]}]`,
			wantErr: "tags", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "null and numeric values",
			body: `[{"target":"a","datapoints":[[null,100],[7,160],[-2.5,220],[1e-400,280]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, nullPt(100), pt(160, 7), pt(220, -2.5), pt(280, 0))},
		},
		{
			name: "negative zero",
			body: `[{"target":"a","datapoints":[[-0,100],[0,160]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, math.Copysign(0, -1)), pt(160, 0))},
		},
		{
			name: "1e9999 and -1e9999 values",
			body: `[{"target":"a","datapoints":[[1e9999,100],[-1e9999,160]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, inf), pt(160, ninf))},
		},
		{
			name: "bare +Inf and -Inf values",
			body: `[{"target":"a","datapoints":[[+Inf,100],[-Inf,160],[ -Inf ,220]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, inf), pt(160, ninf), pt(220, ninf))},
		},
		{
			name: "bare Infinity and -Infinity values",
			body: "[{\"target\":\"a\",\"datapoints\":[[Infinity,100],[-Infinity,160],[\n-Infinity\n,220]]}]",
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, inf), pt(160, ninf), pt(220, ninf))},
		},
		{
			name: "non-finite tags",
			body: `[{"target":"scale(a,1e400)","tags":{"p":+Inf,"n":-Inf,"q":Infinity,"r":-Infinity,"s":1e9999,"t":-1e9999,"u":"Infinity"},"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("scale(a,1e400)", data.Labels{"p": "+Inf", "n": "-Inf", "q": "+Inf", "r": "-Inf", "s": "+Inf", "t": "-Inf", "u": "Infinity"}, pt(100, 1))},
		},
		{
			name: "Infinity inside strings is kept",
			body: `[{"target":"scale(a,Infinity) \"-Inf\" \\","tags":{"Infinity":"+Inf"},"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame(`scale(a,Infinity) "-Inf" \`, data.Labels{"Infinity": "+Inf"}, pt(100, 1))},
		},
		{
			name: "302 and 310 digit numbers",
			body: `[{"target":"a","tags":{"d":` + digits302 + `},"datapoints":[[` + digits302 + `,100],[` + digits310 + `,160]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{"d": digits302}, pt(100, 1e301), pt(160, inf))},
		},
		{
			name:    "bare NaN stays an error",
			body:    `[{"target":"a","datapoints":[[NaN,100]]}]`,
			wantErr: "invalid character", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "non-finite forms outside a value position stay an error",
			body:    `[{"target":"a","datapoints":[[1Infinity,100]]}]`,
			wantErr: "invalid character", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "float timestamps are truncated",
			body: `[{"target":"a","datapoints":[[1,100.9],[2,-1.5]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1), pt(-1, 2))},
		},
		{
			name:    "null timestamp",
			body:    `[{"target":"a","datapoints":[[1,100],[2,null]]}]`,
			wantErr: "failed to parse data point timestamp",
		},
		{
			name:    "missing timestamp",
			body:    `[{"target":"a","datapoints":[[1]]}]`,
			wantErr: "failed to parse data point timestamp",
		},
		{
			name:    "empty point",
			body:    `[{"target":"a","datapoints":[[]]}]`,
			wantErr: "failed to parse data point timestamp",
		},
		{
			name:    "null point",
			body:    `[{"target":"a","datapoints":[null]}]`,
			wantErr: "failed to parse data point timestamp",
		},
		{
			name:    "out-of-range timestamp",
			body:    `[{"target":"a","datapoints":[[1,1e9999]]}]`,
			wantErr: "out of range", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "timestamp error is reported after a later syntax error",
			body:    `[{"target":"a","datapoints":[[1,null]]},x]`,
			wantErr: "invalid character", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "extra point elements are ignored",
			body: `[{"target":"a","datapoints":[[1,100,"x",[1e9999],{}]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1))},
		},
		{
			name: "object point elements decode through Float",
			body: `[{"target":"a","datapoints":[[{"Float64":5,"Valid":false},{"float64":100}],[{},160]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 5), pt(160, 0))},
		},
		{
			name:    "string value",
			body:    `[{"target":"a","datapoints":[["1.5",100]]}]`,
			wantErr: "cannot unmarshal", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "point not an array",
			body:    `[{"target":"a","datapoints":[{"Float64":1}]}]`,
			wantErr: "datapoint", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "datapoints null",
			body: `[{"target":"a","datapoints":null}]`,
			want: data.Frames{renderFrame("a", data.Labels{})},
		},
		{
			name: "datapoints missing",
			body: `[{"target":"a","tags":{"k":"v"}}]`,
			want: data.Frames{renderFrame("a", data.Labels{"k": "v"})},
		},
		{
			name:    "datapoints not an array",
			body:    `[{"target":"a","datapoints":"x"}]`,
			wantErr: "datapoints", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "duplicate datapoints: the last array wins",
			body: `[{"target":"a","datapoints":[[1,100],[2,200]],"datapoints":[[3,300]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(300, 3))},
		},
		{
			name: "duplicate datapoints: null points keep earlier points",
			body: `[{"target":"a","datapoints":[[1,100],[2,200]],"datapoints":[null,[3,300]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1), pt(300, 3))},
		},
		{
			name:    "duplicate datapoints: null clears earlier points",
			body:    `[{"target":"a","datapoints":[[1,100]],"datapoints":null,"datapoints":[null]}]`,
			wantErr: "failed to parse data point timestamp",
		},
		{
			name: "duplicate target: the last string wins and null is ignored",
			body: `[{"target":"a","TARGET":"b","target":null,"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("b", data.Labels{}, pt(100, 1))},
		},
		{
			name:    "target not a string",
			body:    `[{"target":5,"datapoints":[[1,100]]}]`,
			wantErr: "target", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "key matching ignores case",
			body: "[{\"Target\":\"a\",\"TAGS\":{\"k\":\"v\"},\"DataPointſ\":[[1,100]],\"tar_get\":\"b\"}]",
			want: data.Frames{renderFrame("a", data.Labels{"k": "v"}, pt(100, 1))},
		},
		{
			name: "escaped key names",
			body: `[{"target":"a","datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1))},
		},
		{
			name: "invalid UTF-8 is replaced",
			body: "[{\"target\":\"a\xff\",\"tags\":{\"k\xfe\":\"v\\ud800\"},\"datapoints\":[[1,100]]}]",
			want: data.Frames{renderFrame("a�", data.Labels{"k�": "v�"}, pt(100, 1))},
		},
		{
			name: "extra keys are skipped",
			body: `[{"target":"a","pathExpression":"a","step":60,"meta":[{"x":1e9999}],"datapoints":[[1,100]]}]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1))},
		},
		{
			name: "null series element",
			body: `[{"target":"a","datapoints":[[1,100]]},null]`,
			want: data.Frames{renderFrame("a", data.Labels{}, pt(100, 1)), renderFrame("", data.Labels{})},
		},
		{
			name:    "series element not an object",
			body:    `[5]`,
			wantErr: "series", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name: "empty array",
			body: " \n[ ]\n",
			want: data.Frames{},
		},
		{
			name: "null top level",
			body: `null`,
			want: data.Frames{},
		},
		{
			name: "other top-level object",
			body: `{"metrics":[{"name":"a","values":[1]}]}`,
			want: data.Frames{},
		},
		{
			name:    "string top level",
			body:    `"oops"`,
			wantErr: "top-level", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "number top level",
			body:    `5`,
			wantErr: "top-level", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "empty body",
			body:    ``,
			wantErr: "EOF", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "whitespace only",
			body:    " \n",
			wantErr: "EOF", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "trailing data",
			body:    `[] x`,
			wantErr: "invalid character", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "two top-level values",
			body:    `[][]`,
			wantErr: "trailing", wantSource: backend.ErrorSourcePlugin,
		},
		{
			name:    "syntax error",
			body:    `[{invalid json}]`,
			wantErr: "invalid character", wantSource: backend.ErrorSourcePlugin,
		},
	}

	for _, tt := range slices.Concat(tests, keyOrderCases()) {
		for _, rd := range renderReaders {
			t.Run(tt.name+"/"+rd.name, func(t *testing.T) {
				frames, err := decodeRender(rd.wrap(strings.NewReader(tt.body)), defaultRenderResponseMaxBytes, "A", 2)
				if tt.wantErr != "" {
					require.Error(t, err)
					assert.Contains(t, err.Error(), tt.wantErr)
					assert.Equal(t, tt.wantSource, errorSource(err))
					assert.Nil(t, frames)
					return
				}
				require.NoError(t, err)
				require.NotNil(t, frames)
				requireFramesEqual(t, tt.want, frames)
			})
		}
	}
}

type renderTestCase struct {
	name       string
	body       string
	want       data.Frames
	wantErr    string
	wantSource backend.ErrorSource
}

func keyOrderCases() []renderTestCase {
	keyOrders := [][]string{
		{"target", "tags", "datapoints"},
		{"target", "datapoints", "tags"},
		{"tags", "target", "datapoints"},
		{"tags", "datapoints", "target"},
		{"datapoints", "target", "tags"},
		{"datapoints", "tags", "target"},
	}
	members := map[string]string{
		"target":     `"target":"web.cpu;env=prod"`,
		"tags":       `"tags":{"name":"web.cpu;env=prod","env":"prod","n":3}`,
		"datapoints": `"datapoints":[[1.5,100],[null,160],[2,220]]`,
	}
	cases := make([]renderTestCase, 0, len(keyOrders))
	for _, order := range keyOrders {
		parts := make([]string, len(order))
		for i, k := range order {
			parts[i] = members[k]
		}
		cases = append(cases, renderTestCase{
			name: "key order " + strings.Join(order, ", "),
			body: "[{" + strings.Join(parts, ",") + "}]",
			want: data.Frames{renderFrame("web.cpu;env=prod", data.Labels{"name": "web.cpu", "env": "prod", "n": "3"}, pt(100, 1.5), nullPt(160), pt(220, 2))},
		})
	}
	return cases
}

func TestDecodeRenderCap(t *testing.T) {
	body := `[{"target":"a","datapoints":[` + strings.Repeat(`[1.5,1700000000],`, 2000) + `[1,1]]}]`
	size := int64(len(body))

	tests := []struct {
		name     string
		body     string
		maxBytes int64
		wantErr  bool
	}{
		{name: "body at the cap", body: body, maxBytes: size},
		{name: "body under the 5 GiB ceiling", body: body, maxBytes: capMaxBytes},
		{name: "cap trips mid-series", body: body, maxBytes: size / 2, wantErr: true},
		{name: "cap trips on the closing bracket", body: body, maxBytes: size - 1, wantErr: true},
		{name: "cap trips on the last byte after the value is complete", body: body + "\n", maxBytes: size, wantErr: true},
	}
	for _, tt := range tests {
		for _, rd := range renderReaders {
			t.Run(tt.name+"/"+rd.name, func(t *testing.T) {
				frames, err := decodeRender(rd.wrap(strings.NewReader(tt.body)), tt.maxBytes, "A", 0)
				if !tt.wantErr {
					require.NoError(t, err)
					require.Len(t, frames, 1)
					assert.Equal(t, 2001, frames[0].Rows())
					return
				}
				require.Error(t, err)
				assert.Nil(t, frames)
				assert.Equal(t, fmt.Sprintf("response from Graphite /render exceeded %d bytes", tt.maxBytes), err.Error())
				assert.Equal(t, backend.ErrorSourceDownstream, errorSource(err))
			})
		}
	}
}

func TestDecodeRenderCapNeverReadsPastOneExtraByte(t *testing.T) {
	r := &countingReader{r: strings.NewReader(strings.Repeat(" ", 1<<20))}
	_, err := decodeRender(r, 1<<10, "A", 0)
	require.Error(t, err)
	assert.LessOrEqual(t, r.n, int64(1<<10+1))
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}

func TestDecodeRenderReadError(t *testing.T) {
	body := `[{"target":"a","datapoints":[[1,100]]}]`
	_, err := decodeRender(iotest.TimeoutReader(strings.NewReader(body)), defaultRenderResponseMaxBytes, "A", 0)
	require.ErrorIs(t, err, iotest.ErrTimeout)
	assert.Equal(t, backend.ErrorSourceDownstream, errorSource(err))
}

func TestDecodeRenderRefIDAndSizeHint(t *testing.T) {
	body := `[{"target":"a","datapoints":[[1,100],[2,160]]},{"target":"b","datapoints":[[3,100]]}]`
	for _, hint := range []int{-1, 0, 1, 1 << 40, math.MaxInt} {
		t.Run(strconv.Itoa(hint), func(t *testing.T) {
			frames, err := decodeRender(strings.NewReader(body), defaultRenderResponseMaxBytes, "B", hint)
			require.NoError(t, err)
			want := data.Frames{renderFrame("a", data.Labels{}, pt(100, 1), pt(160, 2)), renderFrame("b", data.Labels{}, pt(100, 3))}
			for _, f := range want {
				f.RefID = "B"
			}
			requireFramesEqual(t, want, frames)
		})
	}
}

// renderNonFiniteFixtures fail in the buffered decoder only because of
// ±1e9999, +Inf, -Inf, Infinity or -Infinity, and decode in the streaming one.
var renderNonFiniteFixtures = map[string]bool{
	"edgecases/04-value_1e9999_graphite_web_Inf_.json":                     true,
	"edgecases/05-value_1e9999_graphite_web_Inf_.json":                     true,
	"edgecases/07-value_Inf_literal_metrictank_.json":                      true,
	"edgecases/08-value_Infinity_literal.json":                             true,
	"edgecases/09-tag_Infinity_literal_graphite_web_1_1_7_scale_x_1e.json": true,
	"edgecases/53-legacy_with_bad_series_element.json":                     true,
}

func renderFixtures(t testing.TB) map[string][]byte {
	t.Helper()
	paths, err := filepath.Glob(filepath.Join("testdata", "render", "*", "*.json"))
	require.NoError(t, err)
	require.NotEmpty(t, paths)
	out := make(map[string][]byte, len(paths))
	for _, p := range paths {
		// nolint:gosec
		b, err := os.ReadFile(p)
		require.NoError(t, err)
		rel, err := filepath.Rel(filepath.Join("testdata", "render"), p)
		require.NoError(t, err)
		out[filepath.ToSlash(rel)] = b
	}
	return out
}

func TestDecodeRenderMatchesBufferedDecoder(t *testing.T) {
	for name, body := range renderFixtures(t) {
		t.Run(name, func(t *testing.T) {
			want, wantErr := decodeRenderBuffered(body)
			for _, rd := range renderReaders {
				got, err := decodeRender(rd.wrap(bytes.NewReader(body)), defaultRenderResponseMaxBytes, "A", 0)
				switch {
				case wantErr == nil:
					require.NoError(t, err, rd.name)
					requireFramesEqual(t, want, got)
				case renderNonFiniteFixtures[name] || strings.HasPrefix(name, "captures/"):
					require.NoError(t, err, "%s: buffered decoder failed with %v", rd.name, wantErr)
					assert.True(t, hasNonFinite(got), "%s: want a ±Inf value or tag", rd.name)
				default:
					require.Error(t, err, "%s: buffered decoder failed with %v", rd.name, wantErr)
					assert.Equal(t, errorSource(wantErr), errorSource(err), rd.name)
				}
			}
		})
	}
}

func hasNonFinite(frames data.Frames) bool {
	for _, f := range frames {
		values := f.Fields[1]
		for _, v := range values.Labels {
			if v == "+Inf" || v == "-Inf" {
				return true
			}
		}
		for i := range values.Len() {
			if p := values.At(i).(*float64); p != nil && math.IsInf(*p, 0) {
				return true
			}
		}
	}
	return false
}

func FuzzDecodeRender(f *testing.F) {
	for _, body := range renderFixtures(f) {
		f.Add(body)
	}
	for _, body := range []string{
		`[{"target":"a","datapoints":[[1,100]],"datapoints":[null,[{},2]]}]`,
		`[{"target":"a","tags":{"x":"1"},"Tags":{"y":-Infinity},"datapoints":[[+Inf,100]]}]`,
		`{"series":[{"target":"a","datapoints":[[1,100]]}],"meta":{"x":1}}`,
	} {
		f.Add([]byte(body))
	}

	f.Fuzz(func(t *testing.T, body []byte) {
		got, err := decodeRender(bytes.NewReader(body), defaultRenderResponseMaxBytes, "A", 4)
		gotOneByte, errOneByte := decodeRender(iotest.OneByteReader(bytes.NewReader(body)), defaultRenderResponseMaxBytes, "A", 0)
		require.Equal(t, err == nil, errOneByte == nil, "whole: %v, one byte: %v", err, errOneByte)
		require.Empty(t, diffFrames(got, gotOneByte))

		if json.Valid(body) {
			lexed, err := io.ReadAll(newNonFiniteReader(iotest.OneByteReader(bytes.NewReader(body))))
			require.NoError(t, err)
			require.Equal(t, string(body), string(lexed), "the pre-lexer must not change valid JSON")
		}

		want, wantErr := decodeRenderBuffered(body)
		if wantErr == nil {
			if hasDuplicateLegacySeries(body) {
				return
			}
			require.NoError(t, err, "buffered decoder succeeded")
			require.Empty(t, diffFrames(want, got))
			return
		}
		if acceptsMoreThanBuffered(body) {
			return
		}
		require.Error(t, err, "buffered decoder failed with %v", wantErr)
		require.Equal(t, errorSource(wantErr), errorSource(err), "buffered: %v, streaming: %v", wantErr, err)
	})
}

// acceptsMoreThanBuffered reports whether body has a form that the buffered
// decoder rejects and the streaming decoder can accept: a non-finite number,
// a legacy version or meta of another type, or a repeated legacy series key.
func acceptsMoreThanBuffered(body []byte) bool {
	lexed, err := io.ReadAll(newNonFiniteReader(bytes.NewReader(body)))
	if err != nil || !bytes.Equal(lexed, body) {
		return true
	}
	if hasDuplicateLegacySeries(body) {
		return true
	}
	dec := jsontext.NewDecoder(bytes.NewReader(body), jsontext.AllowDuplicateNames(true), jsontext.AllowInvalidUTF8(true))
	for {
		tok, err := dec.ReadToken()
		if err != nil {
			return false
		}
		switch tok.Kind() {
		case '0':
			if _, err := tok.Float(); errors.Is(err, strconv.ErrRange) {
				return true
			}
		case '"':
			if dec.StackDepth() != 1 {
				continue
			}
			if kind, _ := dec.StackIndex(1); kind != '{' || !isObjectName(dec) {
				continue
			}
			name := tok.String()
			kind := dec.PeekKind()
			if strings.EqualFold(name, "version") && kind != '"' && kind != 'n' {
				return true
			}
			if strings.EqualFold(name, "meta") && kind != '{' && kind != 'n' {
				return true
			}
		default:
		}
	}
}

func isObjectName(dec *jsontext.Decoder) bool {
	_, n := dec.StackIndex(dec.StackDepth())
	return n%2 == 1
}

// hasDuplicateLegacySeries reports whether a top-level object repeats its
// series key, which the buffered decoder merges element by element and the
// streaming decoder replaces.
func hasDuplicateLegacySeries(body []byte) bool {
	dec := jsontext.NewDecoder(bytes.NewReader(body), jsontext.AllowDuplicateNames(true), jsontext.AllowInvalidUTF8(true))
	if dec.PeekKind() != '{' {
		return false
	}
	seen := 0
	for {
		tok, err := dec.ReadToken()
		if err != nil {
			return false
		}
		if tok.Kind() == '"' && dec.StackDepth() == 1 && isObjectName(dec) && strings.EqualFold(tok.String(), "series") {
			seen++
			if seen > 1 {
				return true
			}
		}
	}
}

// renderBody writes a carbonapi-style /render body with 10% null values.
func renderBody(series, points int) []byte {
	rng := rand.New(rand.NewPCG(1, 2))
	var b bytes.Buffer
	b.WriteByte('[')
	for s := range series {
		if s > 0 {
			b.WriteByte(',')
		}
		name := fmt.Sprintf("servers.web-%04d.cpu.user;env=prod;dc=eu", s)
		fmt.Fprintf(&b, `{"target":%q,"datapoints":[`, name)
		ts := int64(1700000000)
		for p := range points {
			if p > 0 {
				b.WriteByte(',')
			}
			b.WriteByte('[')
			if rng.Float64() < 0.1 {
				b.WriteString("null")
			} else {
				b.WriteString(strconv.FormatFloat(float64(rng.IntN(10_000_000))/1000, 'f', -1, 64))
			}
			b.WriteByte(',')
			b.WriteString(strconv.FormatInt(ts, 10))
			b.WriteByte(']')
			ts += 10
		}
		fmt.Fprintf(&b, `],"tags":{"dc":"eu","env":"prod","name":%q}}`, name)
	}
	b.WriteByte(']')
	return b.Bytes()
}

var heapObjectsSample = []metrics.Sample{{Name: "/memory/classes/heap/objects:bytes"}}

func heapObjectBytes() uint64 {
	metrics.Read(heapObjectsSample)
	return heapObjectsSample[0].Value.Uint64()
}

// BenchmarkDecodeRender reports peak-heap-MiB, the largest heap object size
// sampled during one decode, less the heap before it.
func BenchmarkDecodeRender(b *testing.B) {
	shapes := []struct {
		name           string
		series, points int
	}{
		{"4000x1k", 4000, 1000},
		{"100x40k", 100, 40000},
	}
	decoders := []struct {
		name   string
		decode func([]byte) (data.Frames, error)
	}{
		{"buffered", decodeRenderBuffered},
		{"streaming", func(body []byte) (data.Frames, error) {
			return decodeRender(bytes.NewReader(body), capMaxBytes, "A", 1000)
		}},
	}
	for _, shape := range shapes {
		body := renderBody(shape.series, shape.points)
		for _, dec := range decoders {
			b.Run(shape.name+"/"+dec.name, func(b *testing.B) {
				b.ReportAllocs()
				b.SetBytes(int64(len(body)))
				var peak uint64
				for range b.N {
					b.StopTimer()
					runtime.GC()
					base := heapObjectBytes()
					var (
						high atomic.Uint64
						wg   sync.WaitGroup
						stop = make(chan struct{})
					)
					sample := func() {
						if h := heapObjectBytes(); h > base && h-base > high.Load() {
							high.Store(h - base)
						}
					}
					wg.Go(func() {
						tick := time.NewTicker(100 * time.Microsecond)
						defer tick.Stop()
						for {
							select {
							case <-stop:
								return
							case <-tick.C:
								sample()
							}
						}
					})
					b.StartTimer()
					frames, err := dec.decode(body)
					b.StopTimer()
					close(stop)
					wg.Wait()
					sample()
					if err != nil {
						b.Fatal(err)
					}
					runtime.KeepAlive(frames)
					peak = max(peak, high.Load())
					b.StartTimer()
				}
				b.ReportMetric(float64(peak)/(1<<20), "peak-heap-MiB")
				b.ReportMetric(float64(len(body))/(1<<20), "body-MiB")
			})
		}
	}
}
