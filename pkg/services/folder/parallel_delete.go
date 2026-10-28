package folder

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var parallelDeleteLogger = log.New("folder.parallel-delete")

// ParallelDashboardDeleteConcurrency returns how many dashboard deletes may be in flight at once for a
// single folder deletion. 1 means the dashboards are deleted sequentially. Evaluate it once per folder
// deletion so a flag change mid-request cannot mix the two modes.
func ParallelDashboardDeleteConcurrency(ctx context.Context) int {
	details, _ := openfeature.NewDefaultClient().IntValueDetails(ctx, featuremgmt.FlagFoldersParallelDashboardDeleteConcurrency, 1, openfeature.TransactionContext(ctx))
	// Unlike the old ini setting, a malformed value cannot fail startup, so make it visible instead of
	// silently deleting sequentially. A provider that does not know the flag is not misconfigured.
	if details.ErrorCode != "" && details.ErrorCode != openfeature.FlagNotFoundCode {
		parallelDeleteLogger.Warn("Invalid flag value, deleting dashboards sequentially",
			"flag", featuremgmt.FlagFoldersParallelDashboardDeleteConcurrency, "errorCode", details.ErrorCode, "error", details.ErrorMessage)
	}
	// Zero workers would block the scheduling loop forever.
	return int(max(details.Value, 1))
}
