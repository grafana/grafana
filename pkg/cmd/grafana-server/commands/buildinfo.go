package commands

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/setting"
)

func getBuildstamp(opts ServerOptions) int64 {
	buildstampInt64, err := strconv.ParseInt(opts.BuildStamp, 10, 64)
	if err != nil || buildstampInt64 == 0 {
		buildstampInt64 = time.Now().Unix()
	}
	return buildstampInt64
}

func SetBuildInfo(opts ServerOptions) {
	setting.BuildVersion = opts.Version
	setting.BuildCommit = opts.Commit
	setting.EnterpriseBuildCommit = opts.EnterpriseCommit
	setting.BuildStamp = getBuildstamp(opts)
	setting.BuildBranch = opts.BuildBranch
	setting.IsEnterprise = extensions.IsEnterprise
	setting.Packaging = validPackaging(Packaging)
}
