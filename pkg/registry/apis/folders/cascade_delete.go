package folders

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
)

// kubernetesFolderCascadeDeleteEnabled is the master switch for folder.grafana.app cascade
// deletion: opt-in non-empty delete via DeleteOptions.gracePeriodSeconds=0, which removes the
// folder's subtree — child folders, dashboards, and (in the monolith) alert rules and library elements.
func kubernetesFolderCascadeDeleteEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}
