package setting

import "github.com/grafana/grafana/pkg/util"

type CacheSettings struct {
	JoinMembers []string
}

func (cfg *Cfg) readCacheSettings() {
	s := CacheSettings{}

	sec := cfg.Raw.Section("cache")
	s.JoinMembers = util.SplitString(sec.Key("join_members").MustString(""))

	cfg.Cache = s
}
