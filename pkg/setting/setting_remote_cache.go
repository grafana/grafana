package setting

import "github.com/grafana/grafana/pkg/util"

type RemoteCacheSettings struct {
	Name       string
	ConnStr    string
	Prefix     string
	Encryption bool
	Ring       RemoteCacheRingSettings
}

type RemoteCacheRingSettings struct {
	JoinMembers []string
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
			JoinMembers: util.SplitString(ringCacheSec.Key("join_members").MustString("")),
		},
	}

}
