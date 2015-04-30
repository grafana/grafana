// Package metadata provides metadata information between bosun and OpenTSDB.
package metadata

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"reflect"
	"sync"
	"time"

	"bosun.org/opentsdb"
	"bosun.org/slog"
	"bosun.org/util"
)

// RateType is the type of rate for a metric: gauge, counter, or rate.
type RateType string

const (
	// Unknown is a not-yet documented rate type.
	Unknown RateType = ""
	// Gauge rate type.
	Gauge = "gauge"
	// Counter rate type.
	Counter = "counter"
	// Rate rate type.
	Rate = "rate"
)

// Unit is the unit for a metric.
type Unit string

const (
	// None is a not-yet documented unit.
	None           Unit = ""
	A                   = "A" // Amps
	Alert               = "alerts"
	Abort               = "aborts"
	Bool                = "bool"
	BitsPerSecond       = "bits per second"
	Bytes               = "bytes"
	BytesPerSecond      = "bytes per second"
	C                   = "C" // Celsius
	Check               = "checks"
	CHz                 = "CentiHertz"
	Connection          = "connections"
	Context             = "contexts"
	ContextSwitch       = "context switches"
	Count               = ""
	Document            = "documents"
	Entropy             = "entropy"
	Error               = "errors"
	Event               = ""
	Eviction            = "evictions"
	Fault               = "faults"
	Flush               = "flushes"
	Files               = "files"
	Get                 = "gets"
	GetExists           = "get exists"
	Interupt            = "interupts"
	Item                = "items"
	KBytes              = "kbytes"
	Key                 = "keys"
	Load                = "load"
	EMail               = "emails"
	MHz                 = "MHz" // MegaHertz
	Megabit             = "Mbit"
	Merge               = "merges"
	MilliSecond         = "milliseconds"
	Ok                  = "ok" // "OK" or not status, 0 = ok, 1 = not ok
	Operation           = "Operations"
	Page                = "pages"
	Pct                 = "percent" // Range of 0-100.
	PerSecond           = "per second"
	Process             = "processes"
	Priority            = "priority"
	Query               = "queries"
	Redispatch          = "redispatches"
	Refresh             = "refreshes"
	Replica             = "replicas"
	Retry               = "retries"
	Response            = "responses"
	Request             = "requests"
	RPM                 = "RPM" // Rotations per minute.
	Second              = "seconds"
	Segment             = "segments"
	Server              = "servers"
	Session             = "sessions"
	Shard               = "shards"
	Socket              = "sockets"
	Suggest             = "suggests"
	StatusCode          = "status code"
	Syscall             = "system calls"
	Thread              = "threads"
	Transition          = "transitions"
	V                   = "V" // Volts
	V10                 = "tenth-Volts"
	Watt                = "Watts"
	Weight              = "weight"
	Yield               = "yields"
)

// Metakey uniquely identifies a metadata entry.
type Metakey struct {
	Metric string
	Tags   string
	Name   string
}

// TagSet returns m's tags.
func (m Metakey) TagSet() opentsdb.TagSet {
	tags, err := opentsdb.ParseTags(m.Tags)
	if err != nil {
		return nil
	}
	return tags
}

var (
	metadata  = make(map[Metakey]interface{})
	metalock  sync.Mutex
	metahost  string
	metafuncs []func()
	metadebug bool
)

// AddMeta adds a metadata entry to memory, which is queued for later sending.
func AddMeta(metric string, tags opentsdb.TagSet, name string, value interface{}, setHost bool) {
	if tags == nil {
		tags = make(opentsdb.TagSet)
	}
	if _, present := tags["host"]; setHost && !present {
		tags["host"] = util.Hostname
	}
	if err := tags.Clean(); err != nil {
		slog.Error(err)
		return
	}
	ts := tags.Tags()
	metalock.Lock()
	defer metalock.Unlock()
	prev, present := metadata[Metakey{metric, ts, name}]
	if present && !reflect.DeepEqual(prev, value) {
		slog.Infof("metadata changed for %s/%s/%s: %v to %v", metric, ts, name, prev, value)
		go sendMetadata([]Metasend{{
			Metric: metric,
			Tags:   tags,
			Name:   name,
			Value:  value,
		}})
	} else if metadebug {
		slog.Infof("AddMeta for %s/%s/%s: %v", metric, ts, name, value)
	}
	metadata[Metakey{metric, ts, name}] = value
}

// AddMetricMeta is a convenience function to set the main metadata fields for a
// metric. Those fields are rate, unit, and description. If you need to document
// tag keys then use AddMeta.
func AddMetricMeta(metric string, rate RateType, unit Unit, desc string) {
	AddMeta(metric, nil, "rate", rate, false)
	AddMeta(metric, nil, "unit", unit, false)
	AddMeta(metric, nil, "desc", desc, false)
}

// Init initializes the metadata send queue.
func Init(u *url.URL, debug bool) error {
	mh, err := u.Parse("/api/metadata/put")
	if err != nil {
		return err
	}
	metahost = mh.String()
	metadebug = debug
	go collectMetadata()
	return nil
}

func collectMetadata() {
	// Wait a bit so hopefully our collectors have run once and populated the
	// metadata.
	time.Sleep(time.Second * 5)
	for {
		for _, f := range metafuncs {
			f()
		}
		metalock.Lock()
		if len(metadata) == 0 {
			metalock.Unlock()
			continue
		}
		ms := make([]Metasend, len(metadata))
		i := 0
		for k, v := range metadata {
			ms[i] = Metasend{
				Metric: k.Metric,
				Tags:   k.TagSet(),
				Name:   k.Name,
				Value:  v,
			}
			i++
		}
		metalock.Unlock()
		sendMetadata(ms)
		time.Sleep(time.Hour)
	}
}

// Metasend is the struct for sending metadata to bosun.
type Metasend struct {
	Metric string          `json:",omitempty"`
	Tags   opentsdb.TagSet `json:",omitempty"`
	Name   string          `json:",omitempty"`
	Value  interface{}
	Time   time.Time `json:",omitempty"`
}

func sendMetadata(ms []Metasend) {
	b, err := json.Marshal(&ms)
	if err != nil {
		slog.Error(err)
		return
	}
	resp, err := http.Post(metahost, "application/json", bytes.NewBuffer(b))
	if err != nil {
		slog.Error(err)
		return
	}
	if resp.StatusCode != 204 {
		slog.Errorln("bad metadata return:", resp.Status)
		return
	}
}
