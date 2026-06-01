package folders

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
)

// kubernetesFolderCascadeDeleteEnabled is the master switch for folder.grafana.app cascade
// deletion: opt-in non-empty delete via DeleteOptions.gracePeriodSeconds=0, plus finalizer-backed
// cascade of child folders driven by the cascade watcher.
//
// The cascade currently covers child folders only. Dashboards, library elements, and alert rules
// contained in the tree are not yet cascaded and remain as orphan resources (a follow-up).
func kubernetesFolderCascadeDeleteEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}
