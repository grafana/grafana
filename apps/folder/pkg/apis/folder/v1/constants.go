package v1

import "k8s.io/apimachinery/pkg/runtime/schema"

const (
	// APIGroup is the API group used by all kinds in this package
	APIGroup = "folder.grafana.app"
	// APIVersion is the API version used by all kinds in this package
	APIVersion = "v1"
)

// Cascade-delete contract shared between the folder API server and the async reconciler.
const (
	// LabelTerminating marks a folder whose cascade deletion has started; it drives the reconciler.
	LabelTerminating = "grafana.app/folder-terminating"
	// LabelTerminatingStatus reports cascade progress; set to failed when a step errors. Kept separate
	// from LabelTerminating so the terminating label keeps driving retries.
	LabelTerminatingStatus = "grafana.app/folder-terminating-status"
	// AnnotationTerminatingError carries the human-readable reason a cascade delete is blocked.
	AnnotationTerminatingError = "grafana.app/folder-terminating-error"
	// FinalizerCascadeDelete keeps a terminating folder alive until its subtree is drained.
	FinalizerCascadeDelete = "folder.grafana.app/cascade-delete"

	LabelValueTrue   = "true"
	LabelValueFailed = "failed"
)

var (
	// GroupVersion is a schema.GroupVersion consisting of the Group and Version constants for this package
	GroupVersion = schema.GroupVersion{
		Group:   APIGroup,
		Version: APIVersion,
	}
)
