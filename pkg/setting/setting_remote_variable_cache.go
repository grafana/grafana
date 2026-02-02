// BMC file
package setting

import "time"

type RemoteVariableCacheSettings struct {
	Enabled                      bool
	RedisClusterModeEnabled      bool
	Host                         string
	Port                         int
	DB                           int
	Password                     string
	TTL                          time.Duration
	PoolSize                     int
	SSL                          string
	MaxResponseSize              int
	ARRowLimitForCachedVariables int
	ConnStr                      string
	// Redis client connection settings
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ConnMaxIdleTime time.Duration
	MinIdleConns    int
	// Circuit breaker settings
	CircuitBreakerMaxRequests         uint32
	CircuitBreakerInterval            time.Duration
	CircuitBreakerTimeout             time.Duration
	CircuitBreakerConsecutiveFailures uint32
	CircuitBreakerFailureRatio        float64
	CircuitBreakerMinRequests         uint32
	// Redis SCAN operation settings
	ScanCount   int64
	ScanTimeout time.Duration
	// Background deletion timeout
	BackgroundDeletionTimeout time.Duration
}

func (cfg *Cfg) readRemoteVariableCacheSettings() {
	cacheServer := cfg.Raw.Section("remote_variable_cache")

	enabled := cacheServer.Key("enabled").MustBool(true)
	redisClusterModeEnabled := cacheServer.Key("redis_cluster_mode_enabled").MustBool(false)
	host := valueAsString(cacheServer, "host", "")
	port := cacheServer.Key("port").MustInt(6379)
	db := cacheServer.Key("db").MustInt(1)
	password := valueAsString(cacheServer, "password", "")
	ttl := cacheServer.Key("ttl").MustDuration(10 * 24 * time.Hour)
	poolSize := cacheServer.Key("pool_size").MustInt(10)
	ssl := valueAsString(cacheServer, "ssl", "false")
	maxResponseSizeInMB := cacheServer.Key("max_response_size").MustInt(1)
	arRowLimitForCachedVariables := cacheServer.Key("ar_row_limit_for_cached_variables").MustInt(10000)
	connStr := valueAsString(cacheServer, "bmc_varcache_connstr", "")

	// Redis client connection settings
	readTimeout := cacheServer.Key("read_timeout").MustDuration(2 * time.Second)
	writeTimeout := cacheServer.Key("write_timeout").MustDuration(2 * time.Second)
	connMaxIdleTime := cacheServer.Key("conn_max_idle_time").MustDuration(5 * time.Minute)
	minIdleConns := cacheServer.Key("min_idle_conns").MustInt(2)

	// Circuit breaker settings
	circuitBreakerMaxRequests := uint32(cacheServer.Key("circuit_breaker_max_requests").MustUint(3))
	circuitBreakerInterval := cacheServer.Key("circuit_breaker_interval").MustDuration(time.Minute)
	circuitBreakerTimeout := cacheServer.Key("circuit_breaker_timeout").MustDuration(600 * time.Second)
	circuitBreakerConsecutiveFailures := uint32(cacheServer.Key("circuit_breaker_consecutive_failures").MustUint(5))
	circuitBreakerFailureRatio := cacheServer.Key("circuit_breaker_failure_ratio").MustFloat64(0.5)
	circuitBreakerMinRequests := uint32(cacheServer.Key("circuit_breaker_min_requests").MustUint(10))

	// Redis SCAN operation settings
	scanCount := cacheServer.Key("scan_count").MustInt64(1000)
	scanTimeout := cacheServer.Key("scan_timeout").MustDuration(20 * time.Second)

	// Background deletion timeout
	backgroundDeletionTimeout := cacheServer.Key("background_deletion_timeout").MustDuration(5 * time.Minute)

	cfg.RemoteVariableCacheSettings = &RemoteVariableCacheSettings{
		Enabled:                           enabled,
		RedisClusterModeEnabled:           redisClusterModeEnabled,
		Host:                              host,
		Port:                              port,
		DB:                                db,
		Password:                          password,
		TTL:                               ttl,
		PoolSize:                          poolSize,
		SSL:                               ssl,
		MaxResponseSize:                   maxResponseSizeInMB * 1024 * 1024,
		ARRowLimitForCachedVariables:      arRowLimitForCachedVariables,
		ConnStr:                           connStr,
		ReadTimeout:                       readTimeout,
		WriteTimeout:                      writeTimeout,
		ConnMaxIdleTime:                   connMaxIdleTime,
		MinIdleConns:                      minIdleConns,
		CircuitBreakerMaxRequests:         circuitBreakerMaxRequests,
		CircuitBreakerInterval:            circuitBreakerInterval,
		CircuitBreakerTimeout:             circuitBreakerTimeout,
		CircuitBreakerConsecutiveFailures: circuitBreakerConsecutiveFailures,
		CircuitBreakerFailureRatio:        circuitBreakerFailureRatio,
		CircuitBreakerMinRequests:         circuitBreakerMinRequests,
		ScanCount:                         scanCount,
		ScanTimeout:                       scanTimeout,
		BackgroundDeletionTimeout:         backgroundDeletionTimeout,
	}
}
