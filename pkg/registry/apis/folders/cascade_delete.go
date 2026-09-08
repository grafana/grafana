package folders

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
)

// kubernetesFolderCascadeDeleteEnabled is the master switch for folder.grafana.app cascade
// deletion: opt-in non-empty delete via DeleteOptions.gracePeriodSeconds=0, which removes the
// folder's subtree — child folders, dashboards, variables, and (in the monolith) alert rules and
// library elements.
func kubernetesFolderCascadeDeleteEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}

// grafanaDashboardGlobalVariablesEnabled is the gate for deleting folder-scoped variables during
// cascade. The variables:delete preflight is skipped when this is off so roles that never needed
// that action are not 403'd on folder delete.
func grafanaDashboardGlobalVariablesEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagGrafanaDashboardGlobalVariables,
		false,
		openfeature.TransactionContext(ctx),
	)
}
