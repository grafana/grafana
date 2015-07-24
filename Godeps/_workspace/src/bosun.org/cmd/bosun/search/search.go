package search // import "bosun.org/cmd/bosun/search"

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"bosun.org/opentsdb"
)

// Search is a struct to hold indexed data about OpenTSDB metric and tag data.
// It is suited to answering questions about: available metrics for a tag set,
// available tag keys for a metric, and available tag values for a metric and
// tag key.
type Search struct {
	// tagk + tagv -> metrics
	Metric qmap
	// metric -> tag keys
	Tagk smap
	// metric + tagk -> tag values
	Tagv qmap
	// Each Record
	MetricTags mtsmap

	Last map[string]*pair

	// Read replica. Should never be mutated. Can at any time be assigned to a new
	// value.
	Read *Search

	sync.RWMutex

	// copy is true when there is a Copy() event pending.
	copy bool
}

type pair struct {
	points [2]opentsdb.DataPoint
	index  int
}

type MetricTagSet struct {
	Metric string          `json:"metric"`
	Tags   opentsdb.TagSet `json:"tags"`
}

func (mts *MetricTagSet) key() string {
	return mts.Metric + mts.Tags.String()
}

type qmap map[duple]present
type smap map[string]present
type mtsmap map[string]MetricTagSet
type present map[string]int64

type duple struct {
	A, B string
}

func (q qmap) Copy() qmap {
	m := make(qmap)
	for k, v := range q {
		m[k] = v.Copy()
	}
	return m
}
func (s smap) Copy() smap {
	m := make(smap)
	for k, v := range s {
		m[k] = v.Copy()
	}
	return m
}
func (t mtsmap) Copy() mtsmap {
	m := make(mtsmap)
	for k, v := range t {
		m[k] = v
	}
	return m
}
func (p present) Copy() present {
	m := make(present)
	for k, v := range p {
		m[k] = v
	}
	return m
}

func NewSearch() *Search {
	s := Search{
		Metric:     make(qmap),
		Tagk:       make(smap),
		Tagv:       make(qmap),
		MetricTags: make(mtsmap),
		Last:       make(map[string]*pair),
		Read:       new(Search),
	}
	return &s
}

// Copy copies current data to the Read replica.
func (s *Search) Copy() {
	r := new(Search)
	r.Metric = s.Metric.Copy()
	r.Tagk = s.Tagk.Copy()
	r.Tagv = s.Tagv.Copy()
	r.MetricTags = s.MetricTags.Copy()
	s.Read = r
}

func (s *Search) Index(mdp opentsdb.MultiDataPoint) {
	now := time.Now().Unix()
	s.Lock()
	if !s.copy {
		s.copy = true
		go func() {
			time.Sleep(time.Second * 20)
			s.Lock()
			s.Copy()
			s.copy = false
			s.Unlock()
		}()
	}
	for _, dp := range mdp {
		var mts MetricTagSet
		mts.Metric = dp.Metric
		mts.Tags = dp.Tags
		key := mts.key()
		s.MetricTags[key] = mts
		var q duple
		for k, v := range dp.Tags {
			q.A, q.B = k, v
			if _, ok := s.Metric[q]; !ok {
				s.Metric[q] = make(present)
			}
			s.Metric[q][dp.Metric] = now

			if _, ok := s.Tagk[dp.Metric]; !ok {
				s.Tagk[dp.Metric] = make(present)
			}
			s.Tagk[dp.Metric][k] = now

			q.A, q.B = dp.Metric, k
			if _, ok := s.Tagv[q]; !ok {
				s.Tagv[q] = make(present)
			}
			s.Tagv[q][v] = now
		}
		p := s.Last[key]
		if p == nil {
			p = new(pair)
			s.Last[key] = p
		}
		if p.points[p.index%2].Timestamp < dp.Timestamp {
			p.points[p.index%2] = *dp
			p.index++
		}
	}
	s.Unlock()
}

// Match returns all matching values against search. search is a regex, except
// that `.` is literal, `*` can be used for `.*`, and the entire string is
// searched (`^` and `&` added to ends of search).
func Match(search string, values []string) ([]string, error) {
	v := strings.Replace(search, ".", `\.`, -1)
	v = strings.Replace(v, "*", ".*", -1)
	v = "^" + v + "$"
	re, err := regexp.Compile(v)
	if err != nil {
		return nil, err
	}
	var nvs []string
	for _, nv := range values {
		if re.MatchString(nv) {
			nvs = append(nvs, nv)
		}
	}
	return nvs, nil
}

var errNotFloat = fmt.Errorf("last: expected float64")

// GetLast returns the value of the most recent data point for the given metric
// and tag. tags should be of the form "{key=val,key2=val2}". If diff is true,
// the value is treated as a counter. err is non nil if there is no match.
func (s *Search) GetLast(metric, tags string, diff bool) (v float64, err error) {
	s.RLock()
	p := s.Last[metric+tags]
	if p != nil {
		var ok bool
		e := p.points[(p.index+1)%2]
		v, ok = e.Value.(float64)
		if !ok {
			err = errNotFloat
		}
		if diff {
			o := p.points[p.index%2]
			ov, ok := o.Value.(float64)
			if !ok {
				err = errNotFloat
			}
			if o.Timestamp == 0 || e.Timestamp == 0 {
				err = fmt.Errorf("last: need two data points")
			}
			v = (v - ov) / float64(e.Timestamp-o.Timestamp)
		}
	}
	s.RUnlock()
	return
}

func (s *Search) Expand(q *opentsdb.Query) error {
	for k, ov := range q.Tags {
		var nvs []string
		for _, v := range strings.Split(ov, "|") {
			v = strings.TrimSpace(v)
			if v == "*" || !strings.Contains(v, "*") {
				nvs = append(nvs, v)
			} else {
				vs := s.TagValuesByMetricTagKey(q.Metric, k, 0)
				ns, err := Match(v, vs)
				if err != nil {
					return err
				}
				nvs = append(nvs, ns...)
			}
		}
		if len(nvs) == 0 {
			return fmt.Errorf("expr: no tags matching %s=%s", k, ov)
		}
		q.Tags[k] = strings.Join(nvs, "|")
	}
	return nil
}

func (s *Search) UniqueMetrics() []string {
	metrics := make([]string, len(s.Tagk))
	i := 0
	for k := range s.Read.Tagk {
		metrics[i] = k
		i++
	}
	sort.Strings(metrics)
	return metrics
}

func (s *Search) TagValuesByTagKey(Tagk string, since time.Duration) []string {
	um := s.UniqueMetrics()
	tagvset := make(map[string]bool)
	for _, Metric := range um {
		for _, Tagv := range s.tagValuesByMetricTagKey(Metric, Tagk, since) {
			tagvset[Tagv] = true
		}
	}
	tagvs := make([]string, len(tagvset))
	i := 0
	for k := range tagvset {
		tagvs[i] = k
		i++
	}
	sort.Strings(tagvs)
	return tagvs
}

func (s *Search) MetricsByTagPair(Tagk, Tagv string) []string {
	r := make([]string, 0)
	for k := range s.Read.Metric[duple{Tagk, Tagv}] {
		r = append(r, k)
	}
	sort.Strings(r)
	return r
}

func (s *Search) TagKeysByMetric(Metric string) []string {
	r := make([]string, 0)
	for k := range s.Read.Tagk[Metric] {
		r = append(r, k)
	}
	sort.Strings(r)
	return r
}

func (s *Search) tagValuesByMetricTagKey(Metric, Tagk string, since time.Duration) []string {
	var t int64
	if since > 0 {
		t = time.Now().Add(-since).Unix()
	}
	r := make([]string, 0)
	for k, ts := range s.Read.Tagv[duple{Metric, Tagk}] {
		if t <= ts {
			r = append(r, k)
		}
	}
	sort.Strings(r)
	return r
}

func (s *Search) TagValuesByMetricTagKey(Metric, Tagk string, since time.Duration) []string {
	return s.tagValuesByMetricTagKey(Metric, Tagk, since)
}

func (s *Search) FilteredTagValuesByMetricTagKey(Metric, Tagk string, tsf map[string]string) []string {
	tagvset := make(map[string]bool)
	for _, mts := range s.Read.MetricTags {
		if Metric == mts.Metric {
			match := true
			if Tagv, ok := mts.Tags[Tagk]; ok {
				for tpk, tpv := range tsf {
					if v, ok := mts.Tags[tpk]; ok {
						if !(v == tpv) {
							match = false
						}
					} else {
						match = false
					}
				}
				if match {
					tagvset[Tagv] = true
				}
			}
		}
	}
	tagvs := make([]string, len(tagvset))
	i := 0
	for k := range tagvset {
		tagvs[i] = k
		i++
	}
	sort.Strings(tagvs)
	return tagvs
}
