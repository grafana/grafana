package expr

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"bosun.org/_third_party/github.com/MiniProfiler/go/miniprofiler"
	"bosun.org/_third_party/github.com/olivere/elastic"
	"bosun.org/cmd/bosun/expr/parse"
	"bosun.org/opentsdb"
)

// This uses a global client since the elastic client handles connections
var lsClient *elastic.Client

// The following are specific functions that query an elastic instance populated by
// logstash. They are only loaded when the elastic hosts are set in the config file
var LogstashElastic = map[string]parse.Func{
	"lscount": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString},
		Return: parse.TypeSeriesSet,
		Tags:   logstashTagQuery,
		F:      LSCount,
	},
	"lsstat": {
		Args:   []parse.FuncType{parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString, parse.TypeString},
		Return: parse.TypeSeriesSet,
		Tags:   logstashTagQuery,
		F:      LSStat,
	},
}

// This is an array of Logstash hosts and exists as a type for something to attach
// methods to.  The elasticsearch library will use the listed to hosts to discover all
// of the hosts in the config
type LogstashElasticHosts []string

// InitClient sets up the elastic client. If the client has already been
// initalized it is a noop
func (e LogstashElasticHosts) InitClient() error {
	if lsClient == nil {
		var err error
		lsClient, err = elastic.NewClient(elastic.SetURL(e...), elastic.SetMaxRetries(10))
		if err != nil {
			return err
		}
	}
	return nil
}

// getService returns an elasticsearch service based on the global client
func (e *LogstashElasticHosts) getService() (*elastic.SearchService, error) {
	err := e.InitClient()
	if err != nil {
		return nil, err
	}
	return lsClient.Search(), nil
}

// Query takes a Logstash request, applies it a search service, and then queries
// elasticsearch.
func (e LogstashElasticHosts) Query(r *LogstashRequest) (*elastic.SearchResult, error) {
	s, err := e.getService()
	if err != nil {
		return nil, err
	}
	indicies, err := e.GenIndices(r)
	if err != nil {
		return nil, err
	}
	s.Indices(indicies)
	return s.SearchSource(r.Source).Do()
}

// LogstashRequest is a container for the information needed to query elasticsearch.
type LogstashRequest struct {
	IndexRoot  string // The root of all index names i.e. logstash in logstash-2014-04-25
	Start      *time.Time
	End        *time.Time
	Source     *elastic.SearchSource // This the object that we build queries in
	KeyMatches []lsKeyMatch
}

// CacheKey returns the text of the elastic query. That text is the indentifer for
// the query in the cache
func (r *LogstashRequest) CacheKey() string {
	return r.Source.Source().(string)
}

// timeLSRequest execute the elasticsearch query (which may set or hit cache) and returns
// the search results.
func timeLSRequest(e *State, T miniprofiler.Timer, req *LogstashRequest) (resp *elastic.SearchResult, err error) {
	e.logstashQueries = append(e.logstashQueries, *req.Source)
	b, _ := json.MarshalIndent(req.Source.Source(), "", "  ")
	T.StepCustomTiming("logstash", "query", string(b), func() {
		getFn := func() (interface{}, error) {
			return e.logstashHosts.Query(req)
		}
		var val interface{}
		val, err = e.cache.Get(string(b), getFn)
		resp = val.(*elastic.SearchResult)
	})
	return
}

// The regexs in keystring are applied twice. First as a regexp filter to
// elastic, and then as a go regexp to the keys of the result. This is because
// the value could be an array and you will get groups that should be filtered.
type lsKeyMatch struct {
	Key        string
	RawPattern string
	Pattern    *regexp.Regexp
}

// GenIndicies generates the indexes to hit based on the timeframe of the query.
// It assumes all
func (e *LogstashElasticHosts) GenIndices(r *LogstashRequest) (string, error) {
	err := e.InitClient()
	if err != nil {
		return "", err
	}
	// Short-circut when using concrete ES index name
	if strings.HasSuffix(r.IndexRoot, "/") {
		return r.IndexRoot[:len(r.IndexRoot)-1], nil
	}
	indices, err := lsClient.IndexNames()
	if err != nil {
		return "", err
	}
	start := r.Start.Truncate(time.Hour * 24)
	end := r.End.Truncate(time.Hour*24).AddDate(0, 0, 1)
	var selectedIndices []string
	for _, index := range indices {
		var root, date string
		if i := strings.LastIndex(index, "-"); i >= 0 {
			root = index[:i]
			date = index[i+1:]
		}
		if root != r.IndexRoot {
			continue
		}
		d, err := time.Parse("2006.01.02", date)
		if err != nil {
			continue
		}
		if !d.Before(start) && !d.After(end) {
			selectedIndices = append(selectedIndices, index)
		}
	}
	if len(selectedIndices) == 0 {
		return "", fmt.Errorf("no elastic indices available during this time range, index[%s], start/end [%s|%s]", r.IndexRoot, start.Format("2006.01.02"), end.Format("2006.01.02"))
	}
	return strings.Join(selectedIndices, ","), nil
}

// LScount takes 6 arguments and returns the per second for matching documents.
// index_root is the root name of the index to hit, the format is expected to be
// fmt.Sprintf("%s-%s", index_root, d.Format("2006.01.02")).
// keystring creates groups (like tagsets) and can also filter those groups. It
// is the format of "field:regex,field:regex..." The :regex can be ommited.
// filter is an Elastic regexp query that can be applied to any field. It is in
// the same format as the keystring argument.
// interval is in the format of an opentsdb time duration, and tells elastic
// what the bucket size should be. The result will be normalized to a per second
// rate regardless of what this is set to.
// sduration and end duration are the time bounds for the query and are in
// opentsdb's relative time format:
// http://opentsdb.net/docs/build/html/user_guide/query/dates.html
// Caveats:
// 1) There is currently no escaping in the keystring, so if you regex needs to
// have a comma or double quote you are out of luck.
// 2) If the type of the field value in Elastic (aka the mapping) is a number
// then the regexes won't act as a regex. The only thing you can do is an exact
// match on the number, ie "eventlogid:1234". It is recommended that anything
// that is a identifer should be stored as a string since they are not numbers
// even if they are made up entirely of numerals.
func LSCount(e *State, T miniprofiler.Timer, index_root, keystring, filter, interval, sduration, eduration string) (r *Results, err error) {
	return LSDateHistogram(e, T, index_root, keystring, filter, interval, sduration, eduration, "", "", 0)
}

// LSStat returns a bucketed statistical reduction for the specified field.
// The arguments are the same LSCount with the addition of the following:
// The field is the field to generate stats for - this must be a number type in
// elastic.
// rstat is the reduction function to use per bucket and can be one of the
// following: avg, min, max, sum, sum_of_squares, variance, std_deviation
func LSStat(e *State, T miniprofiler.Timer, index_root, keystring, filter, field, rstat, interval, sduration, eduration string) (r *Results, err error) {
	return LSDateHistogram(e, T, index_root, keystring, filter, interval, sduration, eduration, field, rstat, 0)
}

// LSDateHistorgram builds the aggregation query using subaggregations. The result is a grouped timer series
// that Bosun can understand
func LSDateHistogram(e *State, T miniprofiler.Timer, index_root, keystring, filter, interval, sduration, eduration, stat_field, rstat string, size int) (r *Results, err error) {
	r = new(Results)
	req, err := LSBaseQuery(e.now, index_root, e.logstashHosts, keystring, filter, sduration, eduration, size)
	if err != nil {
		return nil, err
	}
	ts := elastic.NewDateHistogramAggregation().Field("@timestamp").Interval(strings.Replace(interval, "M", "n", -1)).MinDocCount(0)
	ds, err := opentsdb.ParseDuration(interval)
	if err != nil {
		return nil, err
	}
	if stat_field != "" {
		ts = ts.SubAggregation("stats", elastic.NewExtendedStatsAggregation().Field(stat_field))
		switch rstat {
		case "avg", "min", "max", "sum", "sum_of_squares", "variance", "std_deviation":
		default:
			return r, fmt.Errorf("stat function %v not a valid option", rstat)
		}
	}
	if keystring == "" {
		req.Source = req.Source.Aggregation("ts", ts)
		result, err := timeLSRequest(e, T, req)
		if err != nil {
			return nil, err
		}
		ts, found := result.Aggregations.DateHistogram("ts")
		if !found {
			return nil, fmt.Errorf("expected time series not found in elastic reply")
		}
		series := make(Series)
		for _, v := range ts.Buckets {
			val := processBucketItem(v, rstat, ds)
			if val != nil {
				series[time.Unix(v.Key/1000, 0).UTC()] = *val
			}
		}
		if len(series) == 0 {
			return r, nil
		}
		r.Results = append(r.Results, &Result{
			Value: series,
			Group: make(opentsdb.TagSet),
		})
		return r, nil
	}
	keys := req.KeyMatches
	aggregation := elastic.NewTermsAggregation().Field(keys[len(keys)-1].Key).Size(0)
	aggregation = aggregation.SubAggregation("ts", ts)
	for i := len(keys) - 2; i > -1; i-- {
		aggregation = elastic.NewTermsAggregation().Field(keys[i].Key).Size(0).SubAggregation("g_"+keys[i+1].Key, aggregation)
	}
	req.Source = req.Source.Aggregation("g_"+keys[0].Key, aggregation)
	result, err := timeLSRequest(e, T, req)
	if err != nil {
		return nil, err
	}
	top, ok := result.Aggregations.Terms("g_" + keys[0].Key)
	if !ok {
		return nil, fmt.Errorf("top key g_%v not found in result", keys[0].Key)
	}
	var desc func(*elastic.AggregationBucketKeyItem, opentsdb.TagSet, []lsKeyMatch) error
	desc = func(b *elastic.AggregationBucketKeyItem, tags opentsdb.TagSet, keys []lsKeyMatch) error {
		if ts, found := b.DateHistogram("ts"); found {
			if e.squelched(tags) {
				return nil
			}
			series := make(Series)
			for _, v := range ts.Buckets {
				val := processBucketItem(v, rstat, ds)
				if val != nil {
					series[time.Unix(v.Key/1000, 0).UTC()] = *val
				}
			}
			if len(series) == 0 {
				return nil
			}
			r.Results = append(r.Results, &Result{
				Value: series,
				Group: tags.Copy(),
			})
			return nil
		}
		if len(keys) < 1 {
			return nil
		}
		n, _ := b.Aggregations.Terms("g_" + keys[0].Key)
		for _, item := range n.Buckets {
			key := fmt.Sprint(item.Key)
			if keys[0].Pattern != nil && !keys[0].Pattern.MatchString(key) {
				continue
			}
			tags[keys[0].Key] = key
			if err := desc(item, tags.Copy(), keys[1:]); err != nil {
				return err
			}
		}
		return nil
	}
	for _, b := range top.Buckets {
		tags := make(opentsdb.TagSet)
		key := fmt.Sprint(b.Key)
		if keys[0].Pattern != nil && !keys[0].Pattern.MatchString(key) {
			continue
		}
		tags[keys[0].Key] = key
		if err := desc(b, tags, keys[1:]); err != nil {
			return nil, err
		}
	}
	return r, nil
}

func processBucketItem(b *elastic.AggregationBucketHistogramItem, rstat string, ds opentsdb.Duration) *float64 {
	if stats, found := b.ExtendedStats("stats"); found {
		var val *float64
		switch rstat {
		case "avg":
			val = stats.Avg
		case "min":
			val = stats.Min
		case "max":
			val = stats.Max
		case "sum":
			val = stats.Sum
		case "sum_of_squares":
			val = stats.SumOfSquares
		case "variance":
			val = stats.Variance
		case "std_deviation":
			val = stats.StdDeviation
		}
		return val
	}
	v := float64(b.DocCount) / ds.Seconds()
	return &v
}

// LSBaseQuery builds the base query that both LSCount and LSStat share
func LSBaseQuery(now time.Time, indexRoot string, l LogstashElasticHosts, keystring string, filter, sduration, eduration string, size int) (*LogstashRequest, error) {
	start, err := opentsdb.ParseDuration(sduration)
	if err != nil {
		return nil, err
	}
	var end opentsdb.Duration
	if eduration != "" {
		end, err = opentsdb.ParseDuration(eduration)
		if err != nil {
			return nil, err
		}
	}
	st := now.Add(time.Duration(-start))
	en := now.Add(time.Duration(-end))
	r := LogstashRequest{
		IndexRoot: indexRoot,
		Start:     &st,
		End:       &en,
		Source:    elastic.NewSearchSource().Size(size),
	}
	tf := elastic.NewRangeFilter("@timestamp").Gte(st).Lte(en)
	filtered := elastic.NewFilteredQuery(tf)
	r.KeyMatches, err = ProcessLSKeys(keystring, filter, &filtered)
	if err != nil {
		return nil, err
	}
	r.Source = r.Source.Query(filtered)
	return &r, nil
}

// This creates the elastic filter porition of a query
func ProcessLSKeys(keystring, filter string, filtered *elastic.FilteredQuery) ([]lsKeyMatch, error) {
	var keys []lsKeyMatch
	var filters []elastic.Filter
	for _, section := range strings.Split(keystring, ",") {
		sp := strings.SplitN(section, ":", 2)
		k := lsKeyMatch{Key: sp[0]}
		if len(sp) == 2 {
			k.RawPattern = sp[1]
			var err error
			k.Pattern, err = regexp.Compile(k.RawPattern)
			if err != nil {
				return nil, err
			}
			re := elastic.NewRegexpFilter(k.Key, k.RawPattern)
			filters = append(filters, re)
		}
		keys = append(keys, k)
	}
	if filter != "" {
		for _, section := range strings.Split(filter, ",") {
			sp := strings.SplitN(section, ":", 2)
			if len(sp) != 2 {
				return nil, fmt.Errorf("error parsing filter string")
			}
			re := elastic.NewRegexpFilter(sp[0], sp[1])
			filters = append(filters, re)
		}
	}
	if len(filters) > 0 {
		and := elastic.NewAndFilter(filters...)
		*filtered = filtered.Filter(and)
	}
	return keys, nil
}
