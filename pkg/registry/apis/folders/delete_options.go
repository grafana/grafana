package folders

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// forceDeleteFromDeleteOptions reports whether the client set DeleteOptions.gracePeriodSeconds=0.
// Used with kubernetesFolderCascadeDelete to opt into deleting a non-empty folder.
// Matches dashboard delete validation in pkg/registry/apis/dashboard.
//
// Use gracePeriodSeconds=0, e.g. kubectl delete folders.folder.grafana.app my-folder --grace-period=0
func forceDeleteFromDeleteOptions(options *metav1.DeleteOptions) bool {
	if options == nil || options.GracePeriodSeconds == nil {
		return false
	}
	return *options.GracePeriodSeconds == 0
}
