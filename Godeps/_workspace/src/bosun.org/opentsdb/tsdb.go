// Package opentsdb defines structures for interacting with an OpenTSDB server.
package opentsdb

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// ResponseSet is a Multi-Set Response:
// http://opentsdb.net/docs/build/html/api_http/query/index.html#example-multi-set-response.
type ResponseSet []*Response

func (r ResponseSet) Copy() ResponseSet {
	newSet := make(ResponseSet, len(r))
	for i, resp := range r {
		newSet[i] = resp.Copy()
	}
	return newSet
}

// Point is the Response data point type.
type Point float64

// Response is a query response:
// http://opentsdb.net/docs/build/html/api_http/query/index.html#response.
type Response struct {
	Metric        string           `json:"metric"`
	Tags          TagSet           `json:"tags"`
	AggregateTags []string         `json:"aggregateTags"`
	DPS           map[string]Point `json:"dps"`
}

func (r *Response) Copy() *Response {
	newR := Response{}
	newR.Metric = r.Metric
	newR.Tags = r.Tags.Copy()
	copy(newR.AggregateTags, r.AggregateTags)
	newR.DPS = map[string]Point{}
	for k, v := range r.DPS {
		newR.DPS[k] = v
	}
	return &newR
}

// DataPoint is a data point for the /api/put route:
// http://opentsdb.net/docs/build/html/api_http/put.html#example-single-data-point-put.
type DataPoint struct {
	Metric    string      `json:"metric"`
	Timestamp int64       `json:"timestamp"`
	Value     interface{} `json:"value"`
	Tags      TagSet      `json:"tags"`
}

// MarshalJSON verifies d is valid and converts it to JSON.
func (d *DataPoint) MarshalJSON() ([]byte, error) {
	if err := d.clean(); err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		Metric    string      `json:"metric"`
		Timestamp int64       `json:"timestamp"`
		Value     interface{} `json:"value"`
		Tags      TagSet      `json:"tags"`
	}{
		d.Metric,
		d.Timestamp,
		d.Value,
		d.Tags,
	})
}

// Valid returns whether d contains valid data (populated fields, valid tags)
// for submission to OpenTSDB.
func (d *DataPoint) Valid() bool {
	if d.Metric == "" || d.Timestamp == 0 || d.Value == nil || !d.Tags.Valid() {
		return false
	}
	if _, err := strconv.ParseFloat(fmt.Sprint(d.Value), 64); err != nil {
		return false
	}
	return true
}

// MultiDataPoint holds multiple DataPoints:
// http://opentsdb.net/docs/build/html/api_http/put.html#example-multiple-data-point-put.
type MultiDataPoint []*DataPoint

// TagSet is a helper class for tags.
type TagSet map[string]string

// Copy creates a new TagSet from t.
func (t TagSet) Copy() TagSet {
	n := make(TagSet)
	for k, v := range t {
		n[k] = v
	}
	return n
}

// Merge adds or overwrites everything from o into t and returns t.
func (t TagSet) Merge(o TagSet) TagSet {
	for k, v := range o {
		t[k] = v
	}
	return t
}

// Equal returns true if t and o contain only the same k=v pairs.
func (t TagSet) Equal(o TagSet) bool {
	if len(t) != len(o) {
		return false
	}
	for k, v := range t {
		if ov, ok := o[k]; !ok || ov != v {
			return false
		}
	}
	return true
}

// Subset returns true if all k=v pairs in o are in t.
func (t TagSet) Subset(o TagSet) bool {
	if len(o) > len(t) {
		return false
	}
	for k, v := range o {
		if tv, ok := t[k]; !ok || tv != v {
			return false
		}
	}
	return true
}

// Compatible returns true if all keys that are in both o and t, have the same value.
func (t TagSet) Compatible(o TagSet) bool {
	for k, v := range o {
		if tv, ok := t[k]; ok && tv != v {
			return false
		}
	}
	return true
}

// Intersection returns the intersection of t and o.
func (t TagSet) Intersection(o TagSet) TagSet {
	r := make(TagSet)
	for k, v := range t {
		if o[k] == v {
			r[k] = v
		}
	}
	return r
}

// String converts t to an OpenTSDB-style {a=b,c=b} string, alphabetized by key.
func (t TagSet) String() string {
	return fmt.Sprintf("{%s}", t.Tags())
}

// Tags is identical to String() but without { and }.
func (t TagSet) Tags() string {
	var keys []string
	for k := range t {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	b := &bytes.Buffer{}
	for i, k := range keys {
		if i > 0 {
			fmt.Fprint(b, ",")
		}
		fmt.Fprintf(b, "%s=%s", k, t[k])
	}
	return b.String()
}

// Returns true if the two tagsets "overlap".
// Two tagsets overlap if they:
// 1. Have at least one key/value pair that matches
// 2. Have no keys in common where the values do not match
func (a TagSet) Overlaps(b TagSet) bool {
	anyMatch := false
	for k, v := range a {
		v2, ok := b[k]
		if !ok {
			continue
		}
		if v2 != v {
			return false
		}
		anyMatch = true
	}
	return anyMatch
}

// Valid returns whether t contains OpenTSDB-submittable tags.
func (t TagSet) Valid() bool {
	if len(t) == 0 {
		return true
	}
	_, err := ParseTags(t.Tags())
	return err == nil
}

func (d *DataPoint) clean() error {
	if err := d.Tags.Clean(); err != nil {
		return err
	}
	m, err := Clean(d.Metric)
	if err != nil {
		return fmt.Errorf("cleaning metric %s: %s", d.Metric, err)
	}
	if d.Metric != m {
		d.Metric = m
	}
	switch v := d.Value.(type) {
	case string:
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			d.Value = i
		} else if f, err := strconv.ParseFloat(v, 64); err == nil {
			d.Value = f
		} else {
			return fmt.Errorf("Unparseable number %v", v)
		}
	case uint64:
		if v > math.MaxInt64 {
			d.Value = float64(v)
		}
	case *big.Int:
		if bigMaxInt64.Cmp(v) < 0 {
			if f, err := strconv.ParseFloat(v.String(), 64); err == nil {
				d.Value = f
			}
		}
	}
	return nil
}

var bigMaxInt64 = big.NewInt(math.MaxInt64)

// Clean removes characters from t that are invalid for OpenTSDB metric and tag
// values. An error is returned if a resulting tag is empty.
func (t TagSet) Clean() error {
	for k, v := range t {
		kc, err := Clean(k)
		if err != nil {
			return fmt.Errorf("cleaning tag %s: %s", k, err)
		}
		vc, err := Clean(v)
		if err != nil {
			return fmt.Errorf("cleaning key %s: %s", v, err)
		}
		if kc != k || vc != v {
			delete(t, k)
			t[kc] = vc
		}
	}
	return nil
}

// Clean is Replace with an empty replacement string.
func Clean(s string) (string, error) {
	return Replace(s, "")
}

// Replace removes characters from s that are invalid for OpenTSDB metric and
// tag values and replaces them.
// See: http://opentsdb.net/docs/build/html/user_guide/writing.html#metrics-and-tags
func Replace(s, replacement string) (string, error) {
	var c string
	replaced := false
	for len(s) > 0 {
		r, size := utf8.DecodeRuneInString(s)
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' || r == '.' || r == '/' {
			c += string(r)
			replaced = false
		} else if !replaced {
			c += replacement
			replaced = true
		}
		s = s[size:]
	}
	if len(c) == 0 {
		return "", fmt.Errorf("clean result is empty")
	}
	return c, nil
}

// MustReplace is like Replace, but returns an empty string on error.
func MustReplace(s, replacement string) string {
	r, err := Replace(s, replacement)
	if err != nil {
		return ""
	}
	return r
}

// Request holds query objects:
// http://opentsdb.net/docs/build/html/api_http/query/index.html#requests.
type Request struct {
	Start             interface{} `json:"start"`
	End               interface{} `json:"end,omitempty"`
	Queries           []*Query    `json:"queries"`
	NoAnnotations     bool        `json:"noAnnotations,omitempty"`
	GlobalAnnotations bool        `json:"globalAnnotations,omitempty"`
	MsResolution      bool        `json:"msResolution,omitempty"`
	ShowTSUIDs        bool        `json:"showTSUIDs,omitempty"`
}

// RequestFromJSON creates a new request from JSON.
func RequestFromJSON(b []byte) (*Request, error) {
	var r Request
	if err := json.Unmarshal(b, &r); err != nil {
		return nil, err
	}
	r.Start = TryParseAbsTime(r.Start)
	r.End = TryParseAbsTime(r.End)
	return &r, nil
}

// Query is a query for a request:
// http://opentsdb.net/docs/build/html/api_http/query/index.html#sub-queries.
type Query struct {
	Aggregator  string      `json:"aggregator"`
	Metric      string      `json:"metric"`
	Rate        bool        `json:"rate,omitempty"`
	RateOptions RateOptions `json:"rateOptions,omitempty"`
	Downsample  string      `json:"downsample,omitempty"`
	Tags        TagSet      `json:"tags,omitempty"`
}

// RateOptions are rate options for a query.
type RateOptions struct {
	Counter    bool  `json:"counter,omitempty"`
	CounterMax int64 `json:"counterMax,omitempty"`
	ResetValue int64 `json:"resetValue,omitempty"`
}

// ParseRequest parses OpenTSDB requests of the form: start=1h-ago&m=avg:cpu.
func ParseRequest(req string) (*Request, error) {
	v, err := url.ParseQuery(req)
	if err != nil {
		return nil, err
	}
	r := Request{}
	s := v.Get("start")
	if s == "" {
		return nil, fmt.Errorf("opentsdb: missing start: %s", req)
	}
	r.Start = s
	for _, m := range v["m"] {
		q, err := ParseQuery(m)
		if err != nil {
			return nil, err
		}
		r.Queries = append(r.Queries, q)
	}
	if len(r.Queries) == 0 {
		return nil, fmt.Errorf("opentsdb: missing m: %s", req)
	}
	return &r, nil
}

var qRE = regexp.MustCompile(`^(\w+):(?:(\w+-\w+):)?(?:(rate.*):)?([\w./-]+)(?:\{([\w./,=*-|]+)\})?$`)

// ParseQuery parses OpenTSDB queries of the form: avg:rate:cpu{k=v}. Validation
// errors will be returned along with a valid Query.
func ParseQuery(query string) (q *Query, err error) {
	q = new(Query)
	m := qRE.FindStringSubmatch(query)
	if m == nil {
		return nil, fmt.Errorf("opentsdb: bad query format: %s", query)
	}
	q.Aggregator = m[1]
	q.Downsample = m[2]
	q.Rate = strings.HasPrefix(m[3], "rate")
	if q.Rate && len(m[3]) > 4 {
		s := m[3][4:]
		if !strings.HasSuffix(s, "}") || !strings.HasPrefix(s, "{") {
			err = fmt.Errorf("opentsdb: invalid rate options")
			return
		}
		sp := strings.Split(s[1:len(s)-1], ",")
		q.RateOptions.Counter = sp[0] == "counter"
		if len(sp) > 1 {
			if sp[1] != "" {
				if q.RateOptions.CounterMax, err = strconv.ParseInt(sp[1], 10, 64); err != nil {
					return
				}
			}
		}
		if len(sp) > 2 {
			if q.RateOptions.ResetValue, err = strconv.ParseInt(sp[2], 10, 64); err != nil {
				return
			}
		}
	}
	q.Metric = m[4]
	if m[5] != "" {
		tags, e := ParseTags(m[5])
		if e != nil {
			err = e
			if tags == nil {
				return
			}
		}
		q.Tags = tags
	}
	return
}

// ParseTags parses OpenTSDB tagk=tagv pairs of the form: k=v,m=o. Validation
// errors do not stop processing, and will return a non-nil TagSet.
func ParseTags(t string) (TagSet, error) {
	ts := make(TagSet)
	var err error
	for _, v := range strings.Split(t, ",") {
		sp := strings.SplitN(v, "=", 2)
		if len(sp) != 2 {
			return nil, fmt.Errorf("opentsdb: bad tag: %s", v)
		}
		for i, s := range sp {
			sp[i] = strings.TrimSpace(s)
			if i > 0 {
				continue
			}
			if !ValidTag(sp[i]) {
				err = fmt.Errorf("invalid character in %s", sp[i])
			}
		}
		for _, s := range strings.Split(sp[1], "|") {
			if s == "*" {
				continue
			}
			if !ValidTag(s) {
				err = fmt.Errorf("invalid character in %s", sp[1])
			}
		}
		if _, present := ts[sp[0]]; present {
			return nil, fmt.Errorf("opentsdb: duplicated tag: %s", v)
		}
		ts[sp[0]] = sp[1]
	}
	return ts, err
}

// ValidTag returns true if s is a valid metric or tag.
func ValidTag(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		switch {
		case c >= 'a' && c <= 'z':
		case c >= 'A' && c <= 'Z':
		case c >= '0' && c <= '9':
		case strings.ContainsAny(string(c), `-_./`):
		case unicode.IsLetter(c):
		default:
			return false
		}
	}
	return true
}

var groupRE = regexp.MustCompile("{[^}]+}")

// ReplaceTags replaces all tag-like strings with tags from the given
// group. For example, given the string "test.metric{host=*}" and a TagSet
// with host=test.com, this returns "test.metric{host=test.com}".
func ReplaceTags(text string, group TagSet) string {
	return groupRE.ReplaceAllStringFunc(text, func(s string) string {
		tags, err := ParseTags(s[1 : len(s)-1])
		if err != nil {
			return s
		}
		for k := range tags {
			if group[k] != "" {
				tags[k] = group[k]
			}
		}
		return fmt.Sprintf("{%s}", tags.Tags())
	})
}

func (q Query) String() string {
	s := q.Aggregator + ":"
	if q.Downsample != "" {
		s += q.Downsample + ":"
	}
	if q.Rate {
		s += "rate"
		if q.RateOptions.Counter {
			s += "{counter"
			if q.RateOptions.CounterMax != 0 {
				s += ","
				s += strconv.FormatInt(q.RateOptions.CounterMax, 10)
			}
			if q.RateOptions.ResetValue != 0 {
				if q.RateOptions.CounterMax == 0 {
					s += ","
				}
				s += ","
				s += strconv.FormatInt(q.RateOptions.ResetValue, 10)
			}
			s += "}"
		}
		s += ":"
	}
	s += q.Metric
	if len(q.Tags) > 0 {
		s += q.Tags.String()
	}
	return s
}

func (r *Request) String() string {
	v := make(url.Values)
	for _, q := range r.Queries {
		v.Add("m", q.String())
	}
	if start, err := CanonicalTime(r.Start); err == nil {
		v.Add("start", start)
	}
	if end, err := CanonicalTime(r.End); err == nil {
		v.Add("end", end)
	}
	return v.Encode()
}

// Search returns a string suitable for OpenTSDB's `/` route.
func (r *Request) Search() string {
	// OpenTSDB uses the URL hash, not search parameters, to do this. The values are
	// not URL encoded. So it's the same as a url.Values just left as normal
	// strings.
	v, err := url.ParseQuery(r.String())
	if err != nil {
		return ""
	}
	buf := &bytes.Buffer{}
	for k, values := range v {
		for _, value := range values {
			fmt.Fprintf(buf, "%s=%s&", k, value)
		}
	}
	return buf.String()
}

// TSDBTimeFormat is the OpenTSDB-required time format for the time package.
const TSDBTimeFormat = "2006/01/02-15:04:05"

// CanonicalTime converts v to a string for use with OpenTSDB's `/` route.
func CanonicalTime(v interface{}) (string, error) {
	if s, ok := v.(string); ok {
		if strings.HasSuffix(s, "-ago") {
			return s, nil
		}
	}
	t, err := ParseTime(v)
	if err != nil {
		return "", err
	}
	return t.Format(TSDBTimeFormat), nil
}

// TryParseAbsTime attempts to parse v as an absolute time. It may be a string
// in the format of TSDBTimeFormat or a float64 of seconds since epoch. If so,
// the epoch as an int64 is returned. Otherwise, v is returned.
func TryParseAbsTime(v interface{}) interface{} {
	switch v := v.(type) {
	case string:
		d, err := ParseAbsTime(v)
		if err == nil {
			return d.Unix()
		}
	case float64:
		return int64(v)
	}
	return v
}

// ParseAbsTime returns the time of s, which must be of any non-relative (not
// "X-ago") format supported by OpenTSDB.
func ParseAbsTime(s string) (time.Time, error) {
	var t time.Time
	tFormats := [4]string{
		"2006/01/02-15:04:05",
		"2006/01/02-15:04",
		"2006/01/02-15",
		"2006/01/02",
	}
	for _, f := range tFormats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	i, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return t, err
	}
	return time.Unix(i, 0), nil
}

// ParseTime returns the time of v, which can be of any format supported by
// OpenTSDB.
func ParseTime(v interface{}) (time.Time, error) {
	now := time.Now().UTC()
	switch i := v.(type) {
	case string:
		if i != "" {
			if strings.HasSuffix(i, "-ago") {
				s := strings.TrimSuffix(i, "-ago")
				d, err := ParseDuration(s)
				if err != nil {
					return now, err
				}
				return now.Add(time.Duration(-d)), nil
			}
			return ParseAbsTime(i)
		}
		return now, nil
	case int64:
		return time.Unix(i, 0).UTC(), nil
	case float64:
		return time.Unix(int64(i), 0).UTC(), nil
	default:
		return time.Time{}, fmt.Errorf("type must be string or int64, got: %v", v)
	}
}

// GetDuration returns the duration from the request's start to end.
func GetDuration(r *Request) (Duration, error) {
	var t Duration
	if v, ok := r.Start.(string); ok && v == "" {
		return t, errors.New("start time must be provided")
	}
	start, err := ParseTime(r.Start)
	if err != nil {
		return t, err
	}
	var end time.Time
	if r.End != nil {
		end, err = ParseTime(r.End)
		if err != nil {
			return t, err
		}
	} else {
		end = time.Now()
	}
	t = Duration(end.Sub(start))
	return t, nil
}

// AutoDownsample sets the avg downsample aggregator to produce l points.
func (r *Request) AutoDownsample(l int) error {
	if l == 0 {
		return errors.New("opentsdb: target length must be > 0")
	}
	cd, err := GetDuration(r)
	if err != nil {
		return err
	}
	d := cd / Duration(l)
	ds := ""
	if d > Duration(time.Second)*15 {
		ds = fmt.Sprintf("%ds-avg", int64(d.Seconds()))
	}
	for _, q := range r.Queries {
		q.Downsample = ds
	}
	return nil
}

// SetTime adjusts the start and end time of the request to assume t is now.
// Relative times ("1m-ago") are changed to absolute times. Existing absolute
// times are adjusted by the difference between time.Now() and t.
func (r *Request) SetTime(t time.Time) error {
	diff := -time.Since(t)
	start, err := ParseTime(r.Start)
	if err != nil {
		return err
	}
	r.Start = start.Add(diff).Unix()
	if r.End != nil {
		end, err := ParseTime(r.End)
		if err != nil {
			return err
		}
		r.End = end.Add(diff).Unix()
	} else {
		r.End = t.UTC().Unix()
	}
	return nil
}

// Query performs a v2 OpenTSDB request to the given host. host should be of the
// form hostname:port. Uses DefaultClient. Can return a RequestError.
func (r *Request) Query(host string) (ResponseSet, error) {
	resp, err := r.QueryResponse(host, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var tr ResponseSet
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return nil, err
	}
	return tr, nil
}

// DefaultClient is the default http client for requests.
var DefaultClient = &http.Client{
	Timeout: time.Minute,
}

// QueryResponse performs a v2 OpenTSDB request to the given host. host should
// be of the form hostname:port. A nil client uses DefaultClient.
func (r *Request) QueryResponse(host string, client *http.Client) (*http.Response, error) {
	u := url.URL{
		Scheme: "http",
		Host:   host,
		Path:   "/api/query",
	}
	b, err := json.Marshal(&r)
	if err != nil {
		return nil, err
	}
	if client == nil {
		client = DefaultClient
	}
	resp, err := client.Post(u.String(), "application/json", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		e := RequestError{Request: string(b)}
		defer resp.Body.Close()
		body, _ := ioutil.ReadAll(resp.Body)
		if err := json.NewDecoder(bytes.NewBuffer(body)).Decode(&e); err == nil {
			return nil, &e
		}
		s := fmt.Sprintf("opentsdb: %s", resp.Status)
		if len(body) > 0 {
			s = fmt.Sprintf("%s: %s", s, body)
		}
		return nil, errors.New(s)
	}
	return resp, nil
}

// RequestError is the error structure for request errors.
type RequestError struct {
	Request string
	Err     struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Details string `json:"details"`
	} `json:"error"`
}

func (r *RequestError) Error() string {
	return fmt.Sprintf("opentsdb: %s: %s", r.Request, r.Err.Message)
}

// Context is the interface for querying an OpenTSDB server.
type Context interface {
	Query(*Request) (ResponseSet, error)
}

// Host is a simple OpenTSDB Context with no additional features.
type Host string

// Query performs the request to the OpenTSDB server.
func (h Host) Query(r *Request) (ResponseSet, error) {
	return r.Query(string(h))
}

// LimitContext is a context that enables limiting response size and filtering tags
type LimitContext struct {
	Host string
	// Limit limits response size in bytes
	Limit int64
	// FilterTags removes tagks from results if that tagk was not in the request
	FilterTags bool
}

// NewLimitContext returns a new context for the given host with response sizes limited
// to limit bytes.
func NewLimitContext(host string, limit int64) *LimitContext {
	return &LimitContext{
		Host:       host,
		Limit:      limit,
		FilterTags: true,
	}
}

// Query returns the result of the request. r may be cached. The request is
// byte-limited and filtered by c's properties.
func (c *LimitContext) Query(r *Request) (tr ResponseSet, err error) {
	resp, err := r.QueryResponse(c.Host, nil)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	lr := &io.LimitedReader{R: resp.Body, N: c.Limit}
	err = json.NewDecoder(lr).Decode(&tr)
	if lr.N == 0 {
		err = fmt.Errorf("TSDB response too large: limited to %E bytes", float64(c.Limit))
		return
	}
	if err != nil {
		return
	}
	if c.FilterTags {
		FilterTags(r, tr)
	}
	return
}

// FilterTags removes tagks in tr not present in r. Does nothing in the event of
// multiple queries in the request.
func FilterTags(r *Request, tr ResponseSet) {
	if len(r.Queries) != 1 {
		return
	}
	for _, resp := range tr {
		for k := range resp.Tags {
			if _, present := r.Queries[0].Tags[k]; !present {
				delete(resp.Tags, k)
			}
		}
	}
}
