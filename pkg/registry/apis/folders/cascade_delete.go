package folders

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// kubernetesFolderCascadeDeleteEnabled is the master switch for folder.grafana.app cascade
// deletion: opt-in non-empty delete via DeleteOptions.gracePeriodSeconds=0, and (when
// implemented) finalizer-backed cleanup of child folders and contained resources.
//
// Until that reconciliation exists, allowing non-empty delete only skips admission validation;
// the folder CR is removed and dashboards, nested folders, library elements, and alert rules
// in the tree remain as orphan resources.
func kubernetesFolderCascadeDeleteEnabled(ctx context.Context, features featuremgmt.FeatureToggles) bool {
	if features == nil {
		return false
	}
	return features.IsEnabled(ctx, featuremgmt.FlagKubernetesFolderCascadeDelete)
}

// clientRequestedCascadeDelete reports whether the delete request opts into deleting a
// non-empty folder (gracePeriodSeconds=0). Requires kubernetesFolderCascadeDelete. Child
// resources are not deleted automatically until cascade reconciliation is implemented.
func clientRequestedCascadeDelete(options *metav1.DeleteOptions) bool {
	return forceDeleteFromDeleteOptions(options)
}
