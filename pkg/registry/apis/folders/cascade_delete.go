package folders

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
)

// kubernetesFolderCascadeDeleteEnabled is the master switch for folder.grafana.app cascade
// deletion: opt-in non-empty delete via DeleteOptions.gracePeriodSeconds=0, and (when
// implemented) finalizer-backed cleanup of child folders and contained resources.
//
// Until that reconciliation exists, allowing non-empty delete only skips admission validation;
// the folder CR is removed and dashboards, nested folders, library elements, and alert rules
// in the tree remain as orphan resources.
func kubernetesFolderCascadeDeleteEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}
