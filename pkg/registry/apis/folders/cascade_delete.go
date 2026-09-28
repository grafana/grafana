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

// kubernetesFolderCascadeDeleteAsyncEnabled gates the PoC async, finalizer-driven cascade delete
// mechanism: stamping new folders with the cascade-delete finalizer at admission time, and running
// the background controller that processes it (cascade_delete_controller.go). Independent of
// kubernetesFolderCascadeDeleteEnabled, which gates the existing synchronous, in-request cascade.
func kubernetesFolderCascadeDeleteAsyncEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDeleteAsync,
		false,
		openfeature.TransactionContext(ctx),
	)
}

// CascadeDeleteAsyncEnabled is the exported form of kubernetesFolderCascadeDeleteAsyncEnabled, for
// callers outside this package that need to gate on the same flag -- namely
// pkg/operators/folder, which runs CascadeDeleteController as a standalone operator and must decide
// whether to wire it up the same way the apiserver's post-start hook (GetPostStartHooks in
// register.go) does.
func CascadeDeleteAsyncEnabled(ctx context.Context) bool {
	return kubernetesFolderCascadeDeleteAsyncEnabled(ctx)
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
