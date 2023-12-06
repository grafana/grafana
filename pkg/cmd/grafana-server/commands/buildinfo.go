package commands

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
)

func setBuildInfo(opts ServerOptions) {
	buildstampInt64, err := strconv.ParseInt(opts.BuildStamp, 10, 64)
	if err != nil || buildstampInt64 == 0 {
		buildstampInt64 = time.Now().Unix()
	}
	setting.BuildVersion = opts.Version
	setting.BuildCommit = opts.Commit
	setting.EnterpriseBuildCommit = opts.EnterpriseCommit
	setting.BuildStamp = buildstampInt64
	setting.BuildBranch = opts.BuildBranch
	setting.IsEnterprise = extensions.IsEnterprise
	setting.Packaging = validPackaging(Packaging)

	metrics.SetBuildInformation(opts.Version, opts.Commit, opts.BuildBranch, buildstampInt64)
}
