package expr

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"bosun.org/opentsdb"
)

func TestExprSimple(t *testing.T) {
	var exprTests = []struct {
		input  string
		output Scalar
	}{
		{"!1", 0},
		{"-2", -2},
		{"1.444-010+2*3e2-4/5+0xff", 847.644},
		{"1>2", 0},
		{"3>2", 1},
		{"1==1", 1},
		{"1==2", 0},
		{"1!=01", 0},
		{"1!=2", 1},
		{"1<2", 1},
		{"2<1", 0},
		{"1||0", 1},
		{"0||0", 0},
		{"1&&0", 0},
		{"1&&2", 1},
		{"1<=0", 0},
		{"1<=1", 1},
		{"1<=2", 1},
		{"1>=0", 1},
		{"1>=1", 1},
		{"1>=2", 0},
		{"-1 > 0", 0},
		{"-1 < 0", 1},

		// NaN
		{"0 / 0", Scalar(math.NaN())},
		{"1 / 0", Scalar(math.Inf(1))},

		// short circuit
		{"0 && 0 / 0", 0},
		{"1 || 0 / 0", 1},
		{"1 && 0 / 0", Scalar(math.NaN())},
		{"0 || 0 / 0", Scalar(math.NaN())},
	}

	for _, et := range exprTests {
		e, err := New(et.input)
		if err != nil {
			t.Error(err)
			break
		}
		r, _, err := e.Execute(nil, nil, nil, nil, nil, time.Now(), 0, false, nil, nil, nil)
		if err != nil {
			t.Error(err)
			break
		} else if len(r.Results) != 1 {
			t.Error("bad r len", len(r.Results))
			break
		} else if len(r.Results[0].Group) != 0 {
			t.Error("bad group len", r.Results[0].Group)
			break
		} else if math.IsNaN(float64(et.output)) && math.IsNaN(float64(r.Results[0].Value.(Scalar))) {
			// ok
		} else if r.Results[0].Value != et.output {
			t.Errorf("expected %v, got %v: %v\nast: %v", et.output, r.Results[0].Value, et.input, e)
		}
	}
}

func TestExprParse(t *testing.T) {
	var exprTests = []struct {
		input string
		valid bool
		tags  string
	}{
		{`avg(q("test", "1m", 1))`, false, ""},
		{`avg(q("avg:m", "1m", ""))`, true, ""},
		{`avg(q("avg:m{a=*}", "1m", ""))`, true, "a"},
		{`avg(q("avg:m{a=*,b=1}", "1m", ""))`, true, "a,b"},
		{`avg(q("avg:m{a=*,b=1}", "1m", "")) + 1`, true, "a,b"},
	}

	for _, et := range exprTests {
		e, err := New(et.input, TSDB)
		if et.valid && err != nil {
			t.Error(err)
		} else if !et.valid && err == nil {
			t.Errorf("expected invalid, but no error: %v", et.input)
		} else if et.valid {
			tags, err := e.Root.Tags()
			if err != nil {
				t.Error(err)
				continue
			}
			if et.tags != tags.String() {
				t.Errorf("%v: unexpected tags: got %v, expected %v", et.input, tags, et.tags)
			}
		}
	}
}

var queryTime = time.Date(2000, 1, 1, 12, 0, 0, 0, time.UTC)

func TestQueryExpr(t *testing.T) {
	queries := map[string]opentsdb.ResponseSet{
		`q("avg:m{a=*}", "9.467241e+08", "9.467244e+08")`: {
			{
				Metric: "m",
				Tags:   opentsdb.TagSet{"a": "b"},
				DPS:    map[string]opentsdb.Point{"0": 1, "1": 2},
			},
			{
				Metric: "m",
				Tags:   opentsdb.TagSet{"a": "c"},
				DPS:    map[string]opentsdb.Point{"3": 7, "1": 8},
			},
		},
		`q("avg:m{a=*}", "9.467205e+08", "9.467208e+08")`: {
			{
				Metric: "m",
				Tags:   opentsdb.TagSet{"a": "b"},
				DPS:    map[string]opentsdb.Point{"2": 6, "3": 4},
			},
			{
				Metric: "m",
				Tags:   opentsdb.TagSet{"a": "d"},
				DPS:    map[string]opentsdb.Point{"8": 8, "9": 9},
			},
		},
	}
	d := time.Date(1970, time.January, 1, 0, 0, 0, 0, time.UTC)
	tests := map[string]map[string]map[time.Time]float64{
		`window("avg:m{a=*}", "5m", "1h", 2, "max")`: {
			"a=b": {
				d: 2,
				d.Add(time.Second * 2): 6,
			},
			"a=c": {
				d.Add(time.Second * 1): 8,
			},
			"a=d": {
				d.Add(time.Second * 8): 9,
			},
		},
		`window("avg:m{a=*}", "5m", "1h", 2, "avg")`: {
			"a=b": {
				d: 1.5,
				d.Add(time.Second * 2): 5,
			},
			"a=c": {
				d.Add(time.Second * 1): 7.5,
			},
			"a=d": {
				d.Add(time.Second * 8): 8.5,
			},
		},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req opentsdb.Request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Fatal(err)
		}
		var resp opentsdb.ResponseSet
		for _, rq := range req.Queries {
			qs := fmt.Sprintf(`q("%s", "%v", "%v")`, rq, req.Start, req.End)
			q, ok := queries[qs]
			if !ok {
				t.Errorf("unknown query: %s", qs)
				return
			}
			if q == nil {
				return // Put nil entry in map to simulate opentsdb error.
			}
			resp = append(resp, q...)
		}
		if err := json.NewEncoder(w).Encode(&resp); err != nil {
			log.Fatal(err)
		}
	}))
	defer ts.Close()
	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}

	for exprText, expected := range tests {
		e, err := New(exprText, TSDB)
		if err != nil {
			t.Fatal(err)
		}
		results, _, err := e.Execute(opentsdb.Host(u.Host), nil, nil, nil, nil, queryTime, 0, false, nil, nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range results.Results {
			tag := r.Group.Tags()
			ex := expected[tag]
			if ex == nil {
				t.Errorf("missing tag %v", tag)
				continue
			}
			val := r.Value.(Series)
			if len(val) != len(ex) {
				t.Errorf("unmatched values in %v", tag)
			}
			for k, v := range ex {
				got := val[k]
				if got != v {
					t.Errorf("%v, %v: got %v, expected %v", tag, k, got, v)
				}
			}
		}
	}
}
