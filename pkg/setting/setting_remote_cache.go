package setting

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/util"
)

type RemoteCacheSettings struct {
	Name       string
	ConnStr    string
	Prefix     string
	Encryption bool
	Ring       RemoteCacheRingSettings
}

type RemoteCacheRingSettings struct {
	Addr             string
	Port             int
	JoinMembers      []string
	HeartbeatPeriod  time.Duration
	HeartbeatTimeout time.Duration
}

func (cfg *Cfg) readCacheSettings() {
	cacheSec := cfg.Raw.Section("remote_cache")
	ringCacheSec := cfg.Raw.Section("remote_cache.ring")

	cfg.RemoteCache = &RemoteCacheSettings{
		Name:       valueAsString(cacheSec, "type", "database"),
		ConnStr:    valueAsString(cacheSec, "connstr", ""),
		Prefix:     valueAsString(cacheSec, "prefix", ""),
		Encryption: cacheSec.Key("encryption").MustBool(false),
		Ring: RemoteCacheRingSettings{
			Addr:             ringCacheSec.Key("address").MustString(""),
			Port:             ringCacheSec.Key("port").MustInt(0),
			JoinMembers:      util.SplitString(ringCacheSec.Key("join_members").MustString("")),
			HeartbeatPeriod:  gtimeWithFallback(ringCacheSec.Key("heartbeat_period").MustString("15s"), 15*time.Second),
			HeartbeatTimeout: gtimeWithFallback(ringCacheSec.Key("heartbeat_timeout").MustString("1m"), time.Minute),
		},
	}

}

func gtimeWithFallback(v string, fallback time.Duration) time.Duration {
	d, err := gtime.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
