// Package collect provides functions for sending data to OpenTSDB.
//
// The "collect" namespace is used (i.e., <root>.collect) to collect
// program and queue metrics.
package collect

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"bosun.org/metadata"
	"bosun.org/opentsdb"
)

var (
	// Freq is how often metrics are sent to OpenTSDB.
	Freq = time.Second * 15

	// MaxQueueLen is the maximum size of the queue, above which incoming data will
	// be discarded. Defaults to about 150MB.
	MaxQueueLen = 200000

	// BatchSize is the maximum length of data points sent at once to OpenTSDB.
	BatchSize = 250

	// Debug enables debug logging.
	Debug = false

	// Print prints all datapoints to stdout instead of sending them.
	Print = false

	// DisableDefaultCollectors prevents the scollector self metrics from being
	// generated.
	DisableDefaultCollectors = false

	// Tags is an opentsdb.TagSet used when sending self metrics.
	Tags opentsdb.TagSet

	// Dropped is the number of dropped data points due to a full queue.
	dropped int64

	// Sent is the number of sent data points.
	sent int64

	tchan               chan *opentsdb.DataPoint
	tsdbURL             string
	osHostname          string
	metricRoot          string
	queue               []json.RawMessage
	qlock, mlock, slock sync.Mutex // Locks for queues, maps, stats.
	counters            = make(map[string]*addMetric)
	sets                = make(map[string]*setMetric)
	puts                = make(map[string]*putMetric)
	client              = &http.Client{
		Transport: &timeoutTransport{Transport: new(http.Transport)},
		Timeout:   time.Minute,
	}
)

const (
	descCollectDropped      = "Counter of dropped data points due to the queue being full."
	descCollectSent         = "Counter of data points sent to the server."
	descCollectQueued       = "Total number of items currently queued and waiting to be sent to the server."
	descCollectAlloc        = "Total number of bytes allocated and still in use by the runtime (via runtime.ReadMemStats)."
	descCollectGoRoutines   = "Total number of goroutines that currently exist (via runtime.NumGoroutine)."
	descCollectPostDuration = "Total number of milliseconds it took to send an HTTP POST request to the server."
	descCollectPostCount    = "Counter of batches sent to the server."
	descCollectPostError    = "Counter of errors received when sending a batch to the server."
	descCollectPostBad      = "Counter of HTTP POST requests where resp.StatusCode != http.StatusNoContent."
	descCollectPostRestore  = "Counter of data points restored from batches that could not be sent to the server."
)

type timeoutTransport struct {
	*http.Transport
	Timeout time.Time
}

func (t *timeoutTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	if time.Now().After(t.Timeout) {
		t.Transport.CloseIdleConnections()
		t.Timeout = time.Now().Add(time.Minute * 5)
	}
	return t.Transport.RoundTrip(r)
}

// InitChan is similar to Init, but uses the given channel instead of creating a
// new one.
func InitChan(tsdbhost *url.URL, root string, ch chan *opentsdb.DataPoint) error {
	if tchan != nil {
		return fmt.Errorf("cannot init twice")
	}
	if err := checkClean(root, "metric root"); err != nil {
		return err
	}
	u, err := tsdbhost.Parse("/api/put")
	if err != nil {
		return err
	}
	if strings.HasPrefix(u.Host, ":") {
		u.Host = "localhost" + u.Host
	}
	tsdbURL = u.String()
	metricRoot = root + "."
	tchan = ch
	go queuer()
	go send()
	go collect()
	if DisableDefaultCollectors {
		return nil
	}
	Set("collect.dropped", Tags, func() (i interface{}) {
		slock.Lock()
		i = dropped
		slock.Unlock()
		return
	})
	Set("collect.sent", Tags, func() (i interface{}) {
		slock.Lock()
		i = sent
		slock.Unlock()
		return
	})
	Set("collect.queued", Tags, func() (i interface{}) {
		qlock.Lock()
		i = len(queue)
		qlock.Unlock()
		return
	})
	Set("collect.alloc", Tags, func() interface{} {
		var ms runtime.MemStats
		runtime.ReadMemStats(&ms)
		return ms.Alloc
	})
	Set("collect.goroutines", Tags, func() interface{} {
		return runtime.NumGoroutine()
	})
	metadata.AddMetricMeta(metricRoot+"collect.dropped", metadata.Counter, metadata.PerSecond, descCollectDropped)
	metadata.AddMetricMeta(metricRoot+"collect.sent", metadata.Counter, metadata.PerSecond, descCollectSent)
	metadata.AddMetricMeta(metricRoot+"collect.queued", metadata.Gauge, metadata.Item, descCollectQueued)
	metadata.AddMetricMeta(metricRoot+"collect.alloc", metadata.Gauge, metadata.Bytes, descCollectAlloc)
	metadata.AddMetricMeta(metricRoot+"collect.goroutines", metadata.Gauge, metadata.Count, descCollectGoRoutines)
	metadata.AddMetricMeta(metricRoot+"collect.post.total_duration", metadata.Counter, metadata.MilliSecond, descCollectPostDuration)
	metadata.AddMetricMeta(metricRoot+"collect.post.count", metadata.Counter, metadata.PerSecond, descCollectPostCount)
	metadata.AddMetricMeta(metricRoot+"collect.post.error", metadata.Counter, metadata.PerSecond, descCollectPostError)
	metadata.AddMetricMeta(metricRoot+"collect.post.bad_status", metadata.Counter, metadata.PerSecond, descCollectPostBad)
	metadata.AddMetricMeta(metricRoot+"collect.post.restore", metadata.Counter, metadata.PerSecond, descCollectPostRestore)
	return nil
}

// Init sets up the channels and the queue for sending data to OpenTSDB. It also
// sets up the basename for all metrics.
func Init(tsdbhost *url.URL, root string) error {
	return InitChan(tsdbhost, root, make(chan *opentsdb.DataPoint))
}

func SetHostname(host string) error {
	if err := checkClean(host, "host tag"); err != nil {
		return err
	}
	osHostname = host
	return nil
}

func setHostName() error {
	h, err := os.Hostname()
	if err != nil {
		return err
	}
	osHostname = strings.ToLower(strings.SplitN(h, ".", 2)[0])
	if err := checkClean(osHostname, "host tag"); err != nil {
		return err
	}
	return nil
}

type setMetric struct {
	metric string
	ts     opentsdb.TagSet
	f      func() interface{}
}

// Set registers a callback for the given metric and tags, calling f immediately
// before queueing data for send.
func Set(metric string, ts opentsdb.TagSet, f func() interface{}) error {
	if err := check(metric, &ts); err != nil {
		return err
	}
	tss := metric + ts.String()
	mlock.Lock()
	sets[tss] = &setMetric{metric, ts.Copy(), f}
	mlock.Unlock()
	return nil
}

type addMetric struct {
	metric string
	ts     opentsdb.TagSet
	value  int64
}

// Add takes a metric and increments a counter for that metric. The metric name
// is appended to the basename specified in the Init function.
func Add(metric string, ts opentsdb.TagSet, inc int64) error {
	if err := check(metric, &ts); err != nil {
		return err
	}
	tss := metric + ts.String()
	mlock.Lock()
	if counters[tss] == nil {
		counters[tss] = &addMetric{
			metric: metric,
			ts:     ts.Copy(),
		}
	}
	counters[tss].value += inc
	mlock.Unlock()
	return nil
}

type putMetric struct {
	metric string
	ts     opentsdb.TagSet
	value  interface{}
}

// Put is useful for capturing "events" that have a gauge value. Subsequent
// calls between the sending interval will overwrite previous calls.
func Put(metric string, ts opentsdb.TagSet, v interface{}) error {
	if err := check(metric, &ts); err != nil {
		return err
	}
	tss := metric + ts.String()
	mlock.Lock()
	puts[tss] = &putMetric{metric, ts.Copy(), v}
	mlock.Unlock()
	return nil
}

func check(metric string, ts *opentsdb.TagSet) error {
	if err := checkClean(metric, "metric"); err != nil {
		return err
	}
	for k, v := range *ts {
		if err := checkClean(k, "tagk"); err != nil {
			return err
		}
		if err := checkClean(v, "tagv"); err != nil {
			return err
		}
	}
	if osHostname == "" {
		if err := setHostName(); err != nil {
			return err
		}
	}
	if *ts == nil {
		*ts = make(opentsdb.TagSet)
	}
	if host, present := (*ts)["host"]; !present {
		(*ts)["host"] = osHostname
	} else if host == "" {
		delete(*ts, "host")
	}
	return nil
}

func checkClean(s, t string) error {
	if sc, err := opentsdb.Clean(s); s != sc || err != nil {
		if err != nil {
			return err
		}
		return fmt.Errorf("%s %s may only contain a to z, A to Z, 0 to 9, -, _, ., / or Unicode letters and may not be empty", t, s)
	}
	return nil
}

func collect() {
	for {
		mlock.Lock()
		now := time.Now().Unix()
		for _, c := range counters {
			dp := &opentsdb.DataPoint{
				Metric:    metricRoot + c.metric,
				Timestamp: now,
				Value:     c.value,
				Tags:      c.ts,
			}
			tchan <- dp
		}
		for _, s := range sets {
			dp := &opentsdb.DataPoint{
				Metric:    metricRoot + s.metric,
				Timestamp: now,
				Value:     s.f(),
				Tags:      s.ts,
			}
			tchan <- dp
		}
		for _, s := range puts {
			dp := &opentsdb.DataPoint{
				Metric:    metricRoot + s.metric,
				Timestamp: now,
				Value:     s.value,
				Tags:      s.ts,
			}
			tchan <- dp
		}
		puts = make(map[string]*putMetric)
		mlock.Unlock()
		time.Sleep(Freq)
	}
}
