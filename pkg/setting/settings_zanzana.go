package setting

import (
	"slices"
	"time"
)

type ZanzanaMode string

const (
	ZanzanaModeClient   ZanzanaMode = "client"
	ZanzanaModeEmbedded ZanzanaMode = "embedded"
)

type ZanzanaSettings struct {
	// Addr is only used when mode is set to client
	Addr string
	// Mode can either be embedded or client
	Mode ZanzanaMode
	// ListenHTTP enables OpenFGA http server which allows to use fga cli
	ListenHTTP bool
	// OpenFGA http server address which allows to connect with fga cli
	HttpAddr string
	// If enabled, authorization cheks will be only performed by zanzana.
	// This bypasses the performance comparison with the legacy system.
	ZanzanaOnlyEvaluation bool
	// Number of concurrent check requests running by Grafana.
	ConcurrentChecks int64
	// Enable cache for Check() requests
	CheckQueryCache bool
	// TTL for cached requests. Default is 10 seconds.
	CheckQueryCacheTTL time.Duration
	// Max number of results returned by ListObjects() query. Default is 1000.
	ListObjectsMaxResults uint32
	// Deadline for the ListObjects() query. Default is 3 seconds.
	ListObjectsDeadline time.Duration
	// Use streamed version of list objects.
	// Returns full list of objects, but takes more time.
	UseStreamedListObjects bool
}

func (cfg *Cfg) readZanzanaSettings() {
	s := ZanzanaSettings{}

	sec := cfg.Raw.Section("zanzana")
	s.Mode = ZanzanaMode(sec.Key("mode").MustString("embedded"))

	validModes := []ZanzanaMode{ZanzanaModeEmbedded, ZanzanaModeClient}

	if !slices.Contains(validModes, s.Mode) {
		cfg.Logger.Warn("Invalid zanzana mode", "expected", validModes, "got", s.Mode)
		s.Mode = "embedded"
	}

	s.Addr = sec.Key("address").MustString("")
	s.ListenHTTP = sec.Key("listen_http").MustBool(false)
	s.HttpAddr = sec.Key("http_addr").MustString("127.0.0.1:8080")
	s.ConcurrentChecks = sec.Key("concurrent_checks").MustInt64(10)
	s.ZanzanaOnlyEvaluation = sec.Key("zanzana_only_evaluation").MustBool(false)
	s.CheckQueryCache = sec.Key("check_query_cache").MustBool(true)
	s.CheckQueryCacheTTL = sec.Key("check_query_cache_ttl").MustDuration(10 * time.Second)
	s.ListObjectsDeadline = sec.Key("list_objects_deadline").MustDuration(3 * time.Second)
	s.ListObjectsMaxResults = uint32(sec.Key("list_objects_max_results").MustUint(1000))
	s.UseStreamedListObjects = sec.Key("use_streamed_list_objects").MustBool(false)

	cfg.Zanzana = s
}
