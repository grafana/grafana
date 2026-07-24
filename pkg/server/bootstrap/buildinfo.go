package bootstrap

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
)

// BuildInfo carries the edition-neutral build metadata that the CLI resolves at
// link time and hands to the bootstrap process. It aliases standalone.BuildInfo
// so callers can pass either type interchangeably.
type BuildInfo = standalone.BuildInfo

func getBuildstamp(opts BuildInfo) int64 {
	buildstampInt64, err := strconv.ParseInt(opts.BuildStamp, 10, 64)
	if err != nil || buildstampInt64 == 0 {
		buildstampInt64 = time.Now().Unix()
	}
	return buildstampInt64
}

func validPackaging(packaging string) string {
	validTypes := []string{"dev", "deb", "rpm", "docker", "brew", "hosted", "unknown"}
	for _, vt := range validTypes {
		if packaging == vt {
			return packaging
		}
	}
	return "unknown"
}

// SetBuildInfo records build metadata on the global setting package so it is
// available to services during startup. packaging describes how Grafana was
// installed (see validPackaging) and isEnterprise reports the edition; both are
// supplied by the caller rather than read from CLI flag globals or
// pkg/extensions so bootstrap stays independent of the CLI layer and edition.
func SetBuildInfo(opts BuildInfo, packaging string, isEnterprise bool) {
	setting.BuildVersion = opts.Version
	setting.BuildCommit = opts.Commit
	setting.EnterpriseBuildCommit = opts.EnterpriseCommit
	setting.BuildStamp = getBuildstamp(opts)
	setting.BuildBranch = opts.BuildBranch
	setting.IsEnterprise = isEnterprise
	setting.Packaging = validPackaging(packaging)
}
