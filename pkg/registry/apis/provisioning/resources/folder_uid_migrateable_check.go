package resources

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// AnnoKeyPendingTakeover marks an unmanaged folder that a branch migration
// exported with its original UID. The value is the name of the repository. The
// first sync of that repository that reads the folder metadata takes the folder
// over and removes the annotation.
const AnnoKeyPendingTakeover = "provisioning.grafana.app/pendingTakeover"

// FolderTakeoverEnabled reports whether migrate may keep folder UIDs for
// folders whose whole subtree is migrated.
func FolderTakeoverEnabled(ctx context.Context, namespace string) bool {
	evalCtx := features.EvaluationContextFromTargetingKey(namespace)
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningMigrateFolderTakeover, false, evalCtx)
}

// FolderCheckOptions turns on the folder UID check for an export. With the
// check, a folder keeps its UID when the export moves everything in its whole
// subtree.
type FolderCheckOptions struct {
	// GenerateNewIDs decides what happens to a folder that cannot keep its UID:
	// it gets a new UID, or it is not exported.
	GenerateNewIDs bool
}

// FolderCheckResults is what the folder UID check decided for an export.
type FolderCheckResults struct {
	// Kept are the folders that the export wrote with their original UID, in
	// sorted order.
	Kept []string
	// Skipped are the folders that the export did not write, in sorted order.
	// The resources in them are not exported either.
	Skipped []string
}
