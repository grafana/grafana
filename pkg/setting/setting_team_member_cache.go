package setting

import (
	"time"

	"gopkg.in/ini.v1"
)

// TeamMemberCacheSettings contains settings for the team member permission cache
type TeamMemberCacheSettings struct {
	// Maximum number of cached team member permission entries
	MaxSize int
	// Time-to-live for cached entries
	TTL time.Duration
}

func readTeamMemberCacheSettings(iniFile *ini.File) TeamMemberCacheSettings {
	section := iniFile.Section("team.member_cache")

	return TeamMemberCacheSettings{
		MaxSize: section.Key("max_size").MustInt(1000),
		TTL:     section.Key("ttl").MustDuration(5 * time.Minute),
	}
}
