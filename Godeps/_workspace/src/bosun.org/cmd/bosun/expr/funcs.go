package expr

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"

	"bosun.org/_third_party/github.com/GaryBoone/GoStats/stats"
	"bosun.org/_third_party/github.com/MiniProfiler/go/miniprofiler"
	"bosun.org/cmd/bosun/expr/parse"
	"bosun.org/graphite"
	"bosun.org/opentsdb"
)

func logstashTagQuery(args []parse.Node) (parse.Tags, error) {
	n := args[1].(*parse.StringNode)
	t := make(parse.Tags)
	for _, s := range strings.Split(n.Text, ",") {
		t[strings.Split(s, ":")[0]] = struct{}{}
	}
	return t, nil
}

func tagQuery(args []parse.Node) (parse.Tags, error) {
	n := args[0].(*parse.StringNode)
	q, err := opentsdb.ParseQuery(n.Text)
	if q == nil && err != nil {
		return nil, err
	}
	t := make(parse.Tags)
	for k := range q.Tags {
		t[k] = struct{}{}
	}
	return t, nil
}

func tagFirst(args []parse.Node) (parse.Tags, error) {
	return args[0].Tags()
}

func tagTranspose(args []parse.Node) (parse.Tags, error) {
	tags := make(parse.Tags)
	sp := strings.Split(args[1].(*parse.StringNode).Text, ",")
	if sp[0] != "" {
		for _, t := range sp {
			tags[t] = struct{}{}
		}
	}
	if atags, err := args[0].Tags(); err != nil {
		return nil, err
	} else if !tags.Subset(atags) {
		return nil, fmt.Errorf("transpose tags (%v) must be a subset of first argument's tags (%v)", tags, atags)
	}
	return tags, nil
}

func tagRename(args []parse.Node) (parse.Tags, error) {
	tags, err := tagFirst(args)
	if err != nil {
		return nil, err
	}
	for _, section := range strings.Split(args[1].(*parse.StringNode).Text, ",") {
		kv := strings.Split(section, "=")
		if len(kv) != 2 {
			return nil, fmt.Errorf("error passing groups")
		}
		for oldTagKey := range tags {
			if kv[0] == oldTagKey {
				if _, ok := tags[kv[1]]; ok {
					return nil, fmt.Errorf("%s already in group", kv[1])
				}
				delete(tags, kv[0])
				tags[kv[1]] = struct{}{}
			}
		}
	}
	return tags, nil
}

// Graphite defines functions for use with a Graphite backend.
var Graphite = map[string]parse.Func{
	"graphiteBand": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeScalar},
		Return: parse.TypeSeriesSet,
		Tags:   graphiteTagQuery,
		F:      GraphiteBand,
	},
	"graphite": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString},
		Return: parse.TypeSeriesSet,
		Tags:   graphiteTagQuery,
		F:      GraphiteQuery,
	},
}

// TSDB defines functions for use with an OpenTSDB backend.
var TSDB = map[string]parse.Func{
	"band": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeScalar},
		Return: parse.TypeSeriesSet,
		Tags:   tagQuery,
		F:      Band,
	},
	"change": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString},
		Return: parse.TypeNumberSet,
		Tags:   tagQuery,
		F:      Change,
	},
	"count": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString},
		Return: parse.TypeScalar,
		F:      Count,
	},
	"q": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString},
		Return: parse.TypeSeriesSet,
		Tags:   tagQuery,
		F:      Query,
	},
	"window": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeScalar, parse.TypeString},
		Return: parse.TypeSeriesSet,
		Tags:   tagQuery,
		F:      Window,
		Check:  windowCheck,
	},
}

var builtins = map[string]parse.Func{
	// Reduction functions

	"avg": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Avg,
	},
	"dev": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Dev,
	},
	"diff": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Diff,
	},
	"first": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      First,
	},
	"forecastlr": {
		Args:   []parse.FuncType{parse.TypeSeriesSet, parse.TypeScalar},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Forecast_lr,
	},
	"last": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Last,
	},
	"len": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Length,
	},
	"max": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Max,
	},
	"median": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Median,
	},
	"min": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Min,
	},
	"percentile": {
		Args:   []parse.FuncType{parse.TypeSeriesSet, parse.TypeScalar},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Percentile,
	},
	"since": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Since,
	},
	"sum": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Sum,
	},
	"streak": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Streak,
	},

	// Group functions
	"rename": {
		Args:   []parse.FuncType{parse.TypeSeriesSet, parse.TypeString},
		Return: parse.TypeSeriesSet,
		Tags:   tagRename,
		F:      Rename,
	},

	"t": {
		Args:   []parse.FuncType{parse.TypeNumberSet, parse.TypeString},
		Return: parse.TypeSeriesSet,
		Tags:   tagTranspose,
		F:      Transpose,
	},
	"ungroup": {
		Args:   []parse.FuncType{parse.TypeNumberSet},
		Return: parse.TypeScalar,
		F:      Ungroup,
	},

	// Other functions

	"abs": {
		Args:   []parse.FuncType{parse.TypeNumberSet},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Abs,
	},
	"d": {
		Args:   []parse.FuncType{parse.TypeString},
		Return: parse.TypeScalar,
		F:      Duration,
	},
	"des": {
		Args:   []parse.FuncType{parse.TypeSeriesSet, parse.TypeScalar, parse.TypeScalar},
		Return: parse.TypeSeriesSet,
		Tags:   tagFirst,
		F:      Des,
	},
	"dropge": {
		Args:   []parse.FuncType{parse.TypeSeriesSet, parse.TypeScalar},
		Return: parse.TypeSeriesSet,
		Tags:   tagFirst,
		F:      DropGe,
	},
	"drople": {
		Args:   []parse.FuncType{parse.TypeSeriesSet, parse.TypeScalar},
		Return: parse.TypeSeriesSet,
		Tags:   tagFirst,
		F:      DropLe,
	},
	"dropna": {
		Args:   []parse.FuncType{parse.TypeSeriesSet},
		Return: parse.TypeSeriesSet,
		Tags:   tagFirst,
		F:      DropNA,
	},
	"epoch": {
		Args:   []parse.FuncType{},
		Return: parse.TypeScalar,
		F:      Epoch,
	},
	"filter": {
		Args:   []parse.FuncType{parse.TypeSeriesSet, parse.TypeNumberSet},
		Return: parse.TypeSeriesSet,
		Tags:   tagFirst,
		F:      Filter,
	},
	"limit": {
		Args:   []parse.FuncType{parse.TypeNumberSet, parse.TypeScalar},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Limit,
	},
	"nv": {
		Args:   []parse.FuncType{parse.TypeNumberSet, parse.TypeScalar},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      NV,
	},
	"sort": {
		Args:   []parse.FuncType{parse.TypeNumberSet, parse.TypeString},
		Return: parse.TypeNumberSet,
		Tags:   tagFirst,
		F:      Sort,
	},
}

func Epoch(e *State, T miniprofiler.Timer) (*Results, error) {
	return &Results{
		Results: []*Result{
			{Value: Scalar(float64(e.now.Unix()))},
		},
	}, nil
}

func NV(e *State, T miniprofiler.Timer, series *Results, v float64) (results *Results, err error) {
	series.NaNValue = &v
	return series, nil
}

func Sort(e *State, T miniprofiler.Timer, series *Results, order string) (*Results, error) {
	// Sort by groupname first to make the search deterministic
	sort.Sort(ResultSliceByGroup(series.Results))
	switch order {
	case "desc":
		sort.Stable(sort.Reverse(ResultSliceByValue(series.Results)))
	case "asc":
		sort.Stable(ResultSliceByValue(series.Results))
	default:
		return nil, fmt.Errorf("second argument of order() must be asc or desc")
	}
	return series, nil
}

func Limit(e *State, T miniprofiler.Timer, series *Results, v float64) (*Results, error) {
	i := int(v)
	if len(series.Results) > i {
		series.Results = series.Results[:i]
	}
	return series, nil
}

func Filter(e *State, T miniprofiler.Timer, series *Results, number *Results) (*Results, error) {
	var ns ResultSlice
	for _, sr := range series.Results {
		for _, nr := range number.Results {
			if sr.Group.Subset(nr.Group) || nr.Group.Subset(sr.Group) {
				ns = append(ns, sr)
			}
		}
	}
	series.Results = ns
	return series, nil
}

func Duration(e *State, T miniprofiler.Timer, d string) (*Results, error) {
	duration, err := opentsdb.ParseDuration(d)
	if err != nil {
		return nil, err
	}
	return &Results{
		Results: []*Result{
			{Value: Scalar(duration.Seconds())},
		},
	}, nil
}

func DropValues(e *State, T miniprofiler.Timer, series *Results, threshold float64, dropFunction func(float64, float64) bool) (*Results, error) {
	for _, res := range series.Results {
		nv := make(Series)
		for k, v := range res.Value.Value().(Series) {
			if !dropFunction(float64(v), threshold) {
				//preserve values which should not be discarded
				nv[k] = v
			}
		}
		if len(nv) == 0 {
			return nil, fmt.Errorf("series %s is empty", res.Group)
		}
		res.Value = nv
	}
	return series, nil
}

func DropGe(e *State, T miniprofiler.Timer, series *Results, threshold float64) (*Results, error) {
	dropFunction := func(value float64, threshold float64) bool { return value >= threshold }
	return DropValues(e, T, series, threshold, dropFunction)
}

func DropLe(e *State, T miniprofiler.Timer, series *Results, threshold float64) (*Results, error) {
	dropFunction := func(value float64, threshold float64) bool { return value <= threshold }
	return DropValues(e, T, series, threshold, dropFunction)
}

func DropNA(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	dropFunction := func(value float64, threshold float64) bool {
		return math.IsNaN(float64(value)) || math.IsInf(float64(value), 0)
	}
	return DropValues(e, T, series, 0, dropFunction)
}

func parseGraphiteResponse(req *graphite.Request, s *graphite.Response, formatTags []string) ([]*Result, error) {
	const parseErrFmt = "graphite ParseError (%s): %s"
	if len(*s) == 0 {
		return nil, fmt.Errorf(parseErrFmt, req.URL, "empty response")
	}
	seen := make(map[string]bool)
	results := make([]*Result, 0)
	for _, res := range *s {
		// build tag set
		tags := make(opentsdb.TagSet)
		if len(formatTags) == 1 && formatTags[0] == "" {
			tags["key"] = res.Target
		} else {
			nodes := strings.Split(res.Target, ".")
			if len(nodes) < len(formatTags) {
				msg := fmt.Sprintf("returned target '%s' does not match format '%s'", res.Target, strings.Join(formatTags, ","))
				return nil, fmt.Errorf(parseErrFmt, req.URL, msg)
			}
			for i, key := range formatTags {
				if len(key) > 0 {
					tags[key] = nodes[i]
				}
			}
		}
		if ts := tags.String(); !seen[ts] {
			seen[ts] = true
		} else {
			return nil, fmt.Errorf(parseErrFmt, req.URL, fmt.Sprintf("More than 1 series identified by tagset '%v'", ts))
		}
		// build data
		dps := make(Series)
		for _, dp := range res.Datapoints {
			if len(dp) != 2 {
				return nil, fmt.Errorf(parseErrFmt, req.URL, fmt.Sprintf("Datapoint has != 2 fields: %v", dp))
			}
			if len(dp[0].String()) == 0 {
				// none value. skip this record
				continue
			}
			val, err := dp[0].Float64()
			if err != nil {
				msg := fmt.Sprintf("value '%s' cannot be decoded to Float64: %s", dp[0], err.Error())
				return nil, fmt.Errorf(parseErrFmt, req.URL, msg)
			}
			unixTS, err := dp[1].Int64()
			if err != nil {
				msg := fmt.Sprintf("timestamp '%s' cannot be decoded to Int64: %s", dp[1], err.Error())
				return nil, fmt.Errorf(parseErrFmt, req.URL, msg)
			}
			t := time.Unix(unixTS, 0)
			dps[t] = val
		}
		results = append(results, &Result{
			Value: dps,
			Group: tags,
		})
	}
	return results, nil
}

func GraphiteBand(e *State, T miniprofiler.Timer, query, duration, period, format string, num float64) (r *Results, err error) {
	r = new(Results)
	r.IgnoreOtherUnjoined = true
	r.IgnoreUnjoined = true
	T.Step("graphiteBand", func(T miniprofiler.Timer) {
		var d, p opentsdb.Duration
		d, err = opentsdb.ParseDuration(duration)
		if err != nil {
			return
		}
		p, err = opentsdb.ParseDuration(period)
		if err != nil {
			return
		}
		if num < 1 || num > 100 {
			err = fmt.Errorf("expr: Band: num out of bounds")
		}
		req := &graphite.Request{
			Targets: []string{query},
		}
		now := e.now
		req.End = &now
		st := e.now.Add(-time.Duration(d))
		req.Start = &st
		for i := 0; i < int(num); i++ {
			now = now.Add(time.Duration(-p))
			req.End = &now
			st := now.Add(time.Duration(-d))
			req.Start = &st
			var s graphite.Response
			s, err = timeGraphiteRequest(e, T, req)
			if err != nil {
				return
			}
			formatTags := strings.Split(format, ".")
			var results []*Result
			results, err = parseGraphiteResponse(req, &s, formatTags)
			if err != nil {
				return
			}
			if i == 0 {
				r.Results = results
			} else {
				// different graphite requests might return series with different id's.
				// i.e. a different set of tagsets.  merge the data of corresponding tagsets
				for _, result := range results {
					updateKey := -1
					for j, existing := range r.Results {
						if result.Group.Equal(existing.Group) {
							updateKey = j
							break
						}
					}
					if updateKey == -1 {
						// result tagset is new
						r.Results = append(r.Results, result)
						updateKey = len(r.Results) - 1
					}
					for k, v := range result.Value.(Series) {
						r.Results[updateKey].Value.(Series)[k] = v
					}
				}
			}
		}
	})
	if err != nil {
		return nil, fmt.Errorf("graphiteBand: %v", err)
	}
	return
}

func bandTSDB(e *State, T miniprofiler.Timer, query, duration, period string, num float64, rfunc func(*Results, *opentsdb.Response) error) (r *Results, err error) {
	r = new(Results)
	r.IgnoreOtherUnjoined = true
	r.IgnoreUnjoined = true
	T.Step("band", func(T miniprofiler.Timer) {
		var d, p opentsdb.Duration
		d, err = opentsdb.ParseDuration(duration)
		if err != nil {
			return
		}
		p, err = opentsdb.ParseDuration(period)
		if err != nil {
			return
		}
		if num < 1 || num > 100 {
			err = fmt.Errorf("num out of bounds")
		}
		var q *opentsdb.Query
		q, err = opentsdb.ParseQuery(query)
		if err != nil {
			return
		}
		if err = e.Search.Expand(q); err != nil {
			return
		}
		req := opentsdb.Request{
			Queries: []*opentsdb.Query{q},
		}
		now := e.now
		req.End = now.Unix()
		req.Start = now.Add(time.Duration(-d)).Unix()
		if err = req.SetTime(e.now); err != nil {
			return
		}
		for i := 0; i < int(num); i++ {
			now = now.Add(time.Duration(-p))
			req.End = now.Unix()
			req.Start = now.Add(time.Duration(-d)).Unix()
			var s opentsdb.ResponseSet
			s, err = timeTSDBRequest(e, T, &req)
			if err != nil {
				return
			}
			for _, res := range s {
				if e.squelched(res.Tags) {
					continue
				}
				if err = rfunc(r, res); err != nil {
					return
				}
			}
		}
	})
	return
}

func Window(e *State, T miniprofiler.Timer, query, duration, period string, num float64, rfunc string) (*Results, error) {
	fn, ok := e.GetFunction(rfunc)
	if !ok {
		return nil, fmt.Errorf("expr: Window: no %v function", rfunc)
	}
	windowFn := reflect.ValueOf(fn.F)
	bandFn := func(results *Results, resp *opentsdb.Response) error {
		values := make(Series)
		min := int64(math.MaxInt64)
		for k, v := range resp.DPS {
			i, e := strconv.ParseInt(k, 10, 64)
			if e != nil {
				return e
			}
			if i < min {
				min = i
			}
			values[time.Unix(i, 0).UTC()] = float64(v)
		}
		if len(values) == 0 {
			return nil
		}
		callResult := &Results{
			Results: ResultSlice{
				&Result{
					Group: resp.Tags,
					Value: values,
				},
			},
		}
		fnResult := windowFn.Call([]reflect.Value{reflect.ValueOf(e), reflect.ValueOf(T), reflect.ValueOf(callResult)})
		if !fnResult[1].IsNil() {
			if err := fnResult[1].Interface().(error); err != nil {
				return err
			}
		}
		minTime := time.Unix(min, 0).UTC()
		fres := float64(fnResult[0].Interface().(*Results).Results[0].Value.(Number))
		found := false
		for _, result := range results.Results {
			if result.Group.Equal(resp.Tags) {
				found = true
				v := result.Value.(Series)
				v[minTime] = fres
				break
			}
		}
		if !found {
			results.Results = append(results.Results, &Result{
				Group: resp.Tags,
				Value: Series{
					minTime: fres,
				},
			})
		}
		return nil
	}
	r, err := bandTSDB(e, T, query, duration, period, num, bandFn)
	if err != nil {
		err = fmt.Errorf("expr: Window: %v", err)
	}
	return r, err
}

func windowCheck(t *parse.Tree, f *parse.FuncNode) error {
	name := f.Args[4].(*parse.StringNode).Text
	v, ok := t.GetFunction(name)
	if !ok {
		return fmt.Errorf("expr: Window: unknown function %v", name)
	}
	if len(v.Args) != 1 || v.Args[0] != parse.TypeSeriesSet || v.Return != parse.TypeNumberSet {
		return fmt.Errorf("expr: Window: %v is not a reduction function", name)
	}
	return nil
}

func Band(e *State, T miniprofiler.Timer, query, duration, period string, num float64) (r *Results, err error) {
	r, err = bandTSDB(e, T, query, duration, period, num, func(r *Results, res *opentsdb.Response) error {
		newarr := true
		for _, a := range r.Results {
			if !a.Group.Equal(res.Tags) {
				continue
			}
			newarr = false
			values := a.Value.(Series)
			for k, v := range res.DPS {
				i, e := strconv.ParseInt(k, 10, 64)
				if e != nil {
					return e
				}
				values[time.Unix(i, 0).UTC()] = float64(v)
			}
		}
		if newarr {
			values := make(Series)
			a := &Result{Group: res.Tags}
			for k, v := range res.DPS {
				i, e := strconv.ParseInt(k, 10, 64)
				if e != nil {
					return e
				}
				values[time.Unix(i, 0).UTC()] = float64(v)
			}
			a.Value = values
			r.Results = append(r.Results, a)
		}
		return nil
	})
	if err != nil {
		err = fmt.Errorf("expr: Band: %v", err)
	}
	return
}

func GraphiteQuery(e *State, T miniprofiler.Timer, query string, sduration, eduration, format string) (r *Results, err error) {
	sd, err := opentsdb.ParseDuration(sduration)
	if err != nil {
		return
	}
	ed := opentsdb.Duration(0)
	if eduration != "" {
		ed, err = opentsdb.ParseDuration(eduration)
		if err != nil {
			return
		}
	}
	st := e.now.Add(-time.Duration(sd))
	et := e.now.Add(-time.Duration(ed))
	req := &graphite.Request{
		Targets: []string{query},
		Start:   &st,
		End:     &et,
	}
	s, err := timeGraphiteRequest(e, T, req)
	if err != nil {
		return nil, err
	}
	formatTags := strings.Split(format, ".")
	r = new(Results)
	results, err := parseGraphiteResponse(req, &s, formatTags)
	if err != nil {
		return nil, err
	}
	r.Results = results

	return
}

func graphiteTagQuery(args []parse.Node) (parse.Tags, error) {
	t := make(parse.Tags)
	n := args[3].(*parse.StringNode)
	for _, s := range strings.Split(n.Text, ".") {
		if s != "" {
			t[s] = struct{}{}
		}
	}
	return t, nil
}

func Query(e *State, T miniprofiler.Timer, query, sduration, eduration string) (r *Results, err error) {
	r = new(Results)
	q, err := opentsdb.ParseQuery(query)
	if q == nil && err != nil {
		return
	}
	if err = e.Search.Expand(q); err != nil {
		return
	}
	sd, err := opentsdb.ParseDuration(sduration)
	if err != nil {
		return
	}
	req := opentsdb.Request{
		Queries: []*opentsdb.Query{q},
		Start:   fmt.Sprintf("%s-ago", sd),
	}
	if eduration != "" {
		var ed opentsdb.Duration
		ed, err = opentsdb.ParseDuration(eduration)
		if err != nil {
			return
		}
		req.End = fmt.Sprintf("%s-ago", ed)
	}
	var s opentsdb.ResponseSet
	if err = req.SetTime(e.now); err != nil {
		return
	}
	s, err = timeTSDBRequest(e, T, &req)
	if err != nil {
		return
	}
	for _, res := range s {
		if e.squelched(res.Tags) {
			continue
		}
		values := make(Series)
		for k, v := range res.DPS {
			i, err := strconv.ParseInt(k, 10, 64)
			if err != nil {
				return nil, err
			}
			values[time.Unix(i, 0).UTC()] = float64(v)
		}
		r.Results = append(r.Results, &Result{
			Value: values,
			Group: res.Tags,
		})
	}
	return
}

func timeGraphiteRequest(e *State, T miniprofiler.Timer, req *graphite.Request) (resp graphite.Response, err error) {
	e.graphiteQueries = append(e.graphiteQueries, *req)
	b, _ := json.MarshalIndent(req, "", "  ")
	T.StepCustomTiming("graphite", "query", string(b), func() {
		key := req.CacheKey()
		getFn := func() (interface{}, error) {
			return e.graphiteContext.Query(req)
		}
		var val interface{}
		val, err = e.cache.Get(key, getFn)
		resp = val.(graphite.Response)
	})
	return
}

func timeTSDBRequest(e *State, T miniprofiler.Timer, req *opentsdb.Request) (s opentsdb.ResponseSet, err error) {
	e.tsdbQueries = append(e.tsdbQueries, *req)
	if e.autods > 0 {
		if err := req.AutoDownsample(e.autods); err != nil {
			return nil, err
		}
	}
	b, _ := json.MarshalIndent(req, "", "  ")
	T.StepCustomTiming("tsdb", "query", string(b), func() {
		getFn := func() (interface{}, error) {
			return e.tsdbContext.Query(req)
		}
		var val interface{}
		val, err = e.cache.Get(string(b), getFn)
		s = val.(opentsdb.ResponseSet).Copy()
	})
	return
}

func Change(e *State, T miniprofiler.Timer, query, sduration, eduration string) (r *Results, err error) {
	r = new(Results)
	sd, err := opentsdb.ParseDuration(sduration)
	if err != nil {
		return
	}
	var ed opentsdb.Duration
	if eduration != "" {
		ed, err = opentsdb.ParseDuration(eduration)
		if err != nil {
			return
		}
	}
	r, err = Query(e, T, query, sduration, eduration)
	if err != nil {
		return
	}
	r, err = reduce(e, T, r, change, (sd - ed).Seconds())
	return
}

func change(dps Series, args ...float64) float64 {
	return avg(dps) * args[0]
}

func reduce(e *State, T miniprofiler.Timer, series *Results, F func(Series, ...float64) float64, args ...float64) (*Results, error) {
	res := *series
	res.Results = nil
	for _, s := range series.Results {
		switch t := s.Value.(type) {
		case Series:
			if len(t) == 0 {
				continue
			}
			s.Value = Number(F(t, args...))
			res.Results = append(res.Results, s)
		default:
			panic(fmt.Errorf("expr: expected a series"))
		}
	}
	return &res, nil
}

func Abs(e *State, T miniprofiler.Timer, series *Results) *Results {
	for _, s := range series.Results {
		s.Value = Number(math.Abs(float64(s.Value.Value().(Number))))
	}
	return series
}

func Diff(e *State, T miniprofiler.Timer, series *Results) (r *Results, err error) {
	return reduce(e, T, series, diff)
}

func diff(dps Series, args ...float64) float64 {
	return last(dps) - first(dps)
}

func Avg(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, avg)
}

// avg returns the mean of x.
func avg(dps Series, args ...float64) (a float64) {
	for _, v := range dps {
		a += float64(v)
	}
	a /= float64(len(dps))
	return
}

func Count(e *State, T miniprofiler.Timer, query, sduration, eduration string) (r *Results, err error) {
	r, err = Query(e, T, query, sduration, eduration)
	if err != nil {
		return
	}
	return &Results{
		Results: []*Result{
			{Value: Scalar(len(r.Results))},
		},
	}, nil
}

func Sum(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, sum)
}

func sum(dps Series, args ...float64) (a float64) {
	for _, v := range dps {
		a += float64(v)
	}
	return
}

func Des(e *State, T miniprofiler.Timer, series *Results, alpha float64, beta float64) *Results {
	for _, res := range series.Results {
		sorted := NewSortedSeries(res.Value.Value().(Series))
		if len(sorted) < 2 {
			continue
		}
		des := make(Series)
		s := make([]float64, len(sorted))
		b := make([]float64, len(sorted))
		s[0] = sorted[0].V
		for i := 1; i < len(sorted); i++ {
			s[i] = alpha*sorted[i].V + (1-alpha)*(s[i-1]+b[i-1])
			b[i] = beta*(s[i]-s[i-1]) + (1-beta)*b[i-1]
			des[sorted[i].T] = s[i]
		}
		res.Value = des
	}
	return series
}

func Streak(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, streak)
}

func streak(dps Series, args ...float64) (a float64) {
	max := func(a, b int) int {
		if a > b {
			return a
		}
		return b
	}

	series := NewSortedSeries(dps)

	current := 0
	longest := 0
	for _, p := range series {
		if p.V != 0 {
			current++
		} else {
			longest = max(current, longest)
			current = 0
		}
	}
	longest = max(current, longest)
	return float64(longest)
}

func Dev(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, dev)
}

// dev returns the sample standard deviation of x.
func dev(dps Series, args ...float64) (d float64) {
	if len(dps) == 1 {
		return 0
	}
	a := avg(dps)
	for _, v := range dps {
		d += math.Pow(float64(v)-a, 2)
	}
	d /= float64(len(dps) - 1)
	return math.Sqrt(d)
}

func Length(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, length)
}

func length(dps Series, args ...float64) (a float64) {
	return float64(len(dps))
}

func Last(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, last)
}

func last(dps Series, args ...float64) (a float64) {
	var last time.Time
	for k, v := range dps {
		if k.After(last) {
			a = v
			last = k
		}
	}
	return
}

func First(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, first)
}

func first(dps Series, args ...float64) (a float64) {
	var first time.Time
	for k, v := range dps {
		if k.Before(first) || first.IsZero() {
			a = v
			first = k
		}
	}
	return
}

func Since(e *State, T miniprofiler.Timer, series *Results) (*Results, error) {
	return reduce(e, T, series, e.since)
}

func (e *State) since(dps Series, args ...float64) (a float64) {
	var last time.Time
	for k, v := range dps {
		if k.After(last) {
			a = v
			last = k
		}
	}
	s := e.now.Sub(last)
	return s.Seconds()
}

func Forecast_lr(e *State, T miniprofiler.Timer, series *Results, y float64) (r *Results, err error) {
	return reduce(e, T, series, e.forecast_lr, y)
}

// forecast_lr returns the number of seconds a linear regression predicts the
// series will take to reach y_val.
func (e *State) forecast_lr(dps Series, args ...float64) float64 {
	const tenYears = time.Hour * 24 * 365 * 10
	yVal := args[0]
	var x []float64
	var y []float64
	for k, v := range dps {
		x = append(x, float64(k.Unix()))
		y = append(y, v)
	}
	var slope, intercept, _, _, _, _ = stats.LinearRegression(x, y)
	it := (yVal - intercept) / slope
	var i64 int64
	if it < math.MinInt64 {
		i64 = math.MinInt64
	} else if it > math.MaxInt64 {
		i64 = math.MaxInt64
	} else if math.IsNaN(it) {
		i64 = e.now.Unix()
	} else {
		i64 = int64(it)
	}
	t := time.Unix(i64, 0)
	s := -e.now.Sub(t)
	if s < -tenYears {
		s = -tenYears
	} else if s > tenYears {
		s = tenYears
	}
	return s.Seconds()
}

func Percentile(e *State, T miniprofiler.Timer, series *Results, p float64) (r *Results, err error) {
	return reduce(e, T, series, percentile, p)
}

func Min(e *State, T miniprofiler.Timer, series *Results) (r *Results, err error) {
	return reduce(e, T, series, percentile, 0)
}

func Median(e *State, T miniprofiler.Timer, series *Results) (r *Results, err error) {
	return reduce(e, T, series, percentile, .5)
}

func Max(e *State, T miniprofiler.Timer, series *Results) (r *Results, err error) {
	return reduce(e, T, series, percentile, 1)
}

// percentile returns the value at the corresponding percentile between 0 and 1.
// Min and Max can be simulated using p <= 0 and p >= 1, respectively.
func percentile(dps Series, args ...float64) (a float64) {
	p := args[0]
	var x []float64
	for _, v := range dps {
		x = append(x, float64(v))
	}
	sort.Float64s(x)
	if p <= 0 {
		return x[0]
	}
	if p >= 1 {
		return x[len(x)-1]
	}
	i := p * float64(len(x)-1)
	i = math.Ceil(i)
	return x[int(i)]
}

func Rename(e *State, T miniprofiler.Timer, series *Results, s string) (*Results, error) {
	for _, section := range strings.Split(s, ",") {
		kv := strings.Split(section, "=")
		if len(kv) != 2 {
			return nil, fmt.Errorf("error passing groups")
		}
		oldKey, newKey := kv[0], kv[1]
		for _, res := range series.Results {
			for tag, v := range res.Group {
				if oldKey == tag {
					if _, ok := res.Group[newKey]; ok {
						return nil, fmt.Errorf("%s already in group", newKey)
					}
					delete(res.Group, oldKey)
					res.Group[newKey] = v
				}

			}
		}
	}
	return series, nil
}

func Ungroup(e *State, T miniprofiler.Timer, d *Results) (*Results, error) {
	if len(d.Results) != 1 {
		return nil, fmt.Errorf("ungroup: requires exactly one group")
	}
	d.Results[0].Group = nil
	return d, nil
}

func Transpose(e *State, T miniprofiler.Timer, d *Results, gp string) (*Results, error) {
	gps := strings.Split(gp, ",")
	m := make(map[string]*Result)
	for _, v := range d.Results {
		ts := make(opentsdb.TagSet)
		for k, v := range v.Group {
			for _, b := range gps {
				if k == b {
					ts[k] = v
				}
			}
		}
		if _, ok := m[ts.String()]; !ok {
			m[ts.String()] = &Result{
				Group: ts,
				Value: make(Series),
			}
		}
		switch t := v.Value.(type) {
		case Number:
			r := m[ts.String()]
			i := int64(len(r.Value.(Series)))
			r.Value.(Series)[time.Unix(i, 0).UTC()] = float64(t)
			r.Computations = append(r.Computations, v.Computations...)
		default:
			panic(fmt.Errorf("expr: expected a number"))
		}
	}
	var r Results
	for _, res := range m {
		r.Results = append(r.Results, res)
	}
	return &r, nil
}
