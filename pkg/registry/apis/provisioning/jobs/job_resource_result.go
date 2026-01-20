package jobs

import (
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// JobResourceResult represents the result of a resource operation in a job.
type JobResourceResult struct {
	name    string
	group   string
	kind    string
	path    string
	action  repository.FileAction
	err     error
	warning error
}

// jobResourceResultBuilder is a builder for creating JobResourceResult instances using a fluent API.
type jobResourceResultBuilder struct {
	result JobResourceResult
}

// NewResourceResult creates a new builder for JobResourceResult.
func NewResourceResult() *jobResourceResultBuilder {
	return &jobResourceResultBuilder{
		result: JobResourceResult{},
	}
}

// NewPathOnlyResult creates a new builder with the path already set.
// This is used for operations that cannot be references to a Grafana resource or when the resource is not yet known.
func NewPathOnlyResult(path string) *jobResourceResultBuilder {
	return NewResourceResult().WithPath(path)
}

func NewGroupKindResult(name string, group, kind string) *jobResourceResultBuilder {
	return NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind)
}

func NewGVKResult(name string, gvk schema.GroupVersionKind) *jobResourceResultBuilder {
	return NewResourceResult().
		WithName(name).
		WithGVK(gvk)
}

func NewFolderResult(name string) *jobResourceResultBuilder {
	return NewResourceResult().
		WithPath(name).
		WithGroup(resources.FolderResource.Group).
		WithKind(resources.FolderKind.Kind)
}

// WithName sets the name of the resource.
func (b *jobResourceResultBuilder) WithName(name string) *jobResourceResultBuilder {
	b.result.name = name
	return b
}

// WithGroup sets the group of the resource.
func (b *jobResourceResultBuilder) WithGroup(group string) *jobResourceResultBuilder {
	b.result.group = group
	return b
}

// WithKind sets the kind of the resource.
func (b *jobResourceResultBuilder) WithKind(kind string) *jobResourceResultBuilder {
	b.result.kind = kind
	return b
}

// WithGVK sets the group and kind of the resource.
func (b *jobResourceResultBuilder) WithGVK(gvk schema.GroupVersionKind) *jobResourceResultBuilder {
	b.result.group = gvk.Group
	b.result.kind = gvk.Kind
	return b
}

// WithGKR sets the name, group, and kind of the resource in one call.
// This is a convenience method for setting Group/Kind/Resource information together.
func (b *jobResourceResultBuilder) WithGKR(name, group, kind string) *jobResourceResultBuilder {
	b.result.name = name
	b.result.group = group
	b.result.kind = kind
	return b
}

// WithPath sets the path of the resource.
func (b *jobResourceResultBuilder) WithPath(path string) *jobResourceResultBuilder {
	b.result.path = path
	return b
}

// WithAction sets the action performed on the resource.
func (b *jobResourceResultBuilder) WithAction(action repository.FileAction) *jobResourceResultBuilder {
	b.result.action = action
	return b
}

// WithError sets the error associated with the resource operation.
func (b *jobResourceResultBuilder) WithError(err error) *jobResourceResultBuilder {
	b.result.err = err
	return b
}

// AsSkipped marks the resource as skipped by setting the action to Ignored and converting the error to a warning.
func (b *jobResourceResultBuilder) AsSkipped() *jobResourceResultBuilder {
	b.result.action = repository.FileActionIgnored
	if b.result.err != nil {
		b.result.warning = b.result.err
		b.result.err = nil
	}
	return b
}

// Build returns the final JobResourceResult.
func (b *jobResourceResultBuilder) Build() JobResourceResult {
	return b.result
}

// Name returns the name of the resource.
func (r JobResourceResult) Name() string {
	return r.name
}

// Group returns the group of the resource.
func (r JobResourceResult) Group() string {
	return r.group
}

// Kind returns the kind of the resource.
func (r JobResourceResult) Kind() string {
	return r.kind
}

// Path returns the path of the resource.
func (r JobResourceResult) Path() string {
	return r.path
}

// Action returns the action performed on the resource.
func (r JobResourceResult) Action() repository.FileAction {
	return r.action
}

// Error returns the error associated with the resource operation.
func (r JobResourceResult) Error() error {
	return r.err
}

// Warning returns the warning associated with the resource operation.
func (r JobResourceResult) Warning() error {
	return r.warning
}
