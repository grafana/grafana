package folders

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
)

// kubernetesFolderCascadeDeleteEnabled is the master switch for folder.grafana.app cascade
// deletion: the API server marks a deleted folder's subtree terminating via a finalizer and a poller
// drives it to completion, deleting nested folders and their contained dashboards, alert rules, and
// library elements. It implies force delete (a non-empty folder can only be cascaded by bypassing the
// empty-folder check), so callers do not need to enable both.
func kubernetesFolderCascadeDeleteEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}

// kubernetesFolderForceDeleteEnabled reports whether folder.grafana.app honors
// DeleteOptions.gracePeriodSeconds=0 as "delete this folder bypassing the eventually-consistent
// empty-folder check". On its own (without cascade delete) it removes only the folder and leaves
// contained resources orphaned, so it is meant for callers that delete the contents separately.
func kubernetesFolderForceDeleteEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderForceDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}
