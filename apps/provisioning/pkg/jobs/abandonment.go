package jobs

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// AbandonmentHandler handles cleanup logic when a job is detected as abandoned/expired.
// Different job types may need to update different status fields or perform type-specific cleanup.
//
//go:generate mockery --name AbandonmentHandler --structname MockAbandonmentHandler --inpackage --filename abandonment_handler_mock.go --with-expecter
type AbandonmentHandler interface {
	// HandleAbandonment is called when a job is detected as abandoned (expired lease).
	// It should update any related status/state before the job is marked as failed and archived.
	// The job parameter is already marked with error state and message.
	HandleAbandonment(ctx context.Context, job *provisioning.Job) error

	// SupportsAction returns true if this handler supports the given job action.
	SupportsAction(action provisioning.JobAction) bool
}

// AbandonmentHandlerRegistry manages handlers for different job types.
type AbandonmentHandlerRegistry struct {
	handlers []AbandonmentHandler
}

// NewAbandonmentHandlerRegistry creates a new registry with the given handlers.
func NewAbandonmentHandlerRegistry(handlers ...AbandonmentHandler) *AbandonmentHandlerRegistry {
	return &AbandonmentHandlerRegistry{
		handlers: handlers,
	}
}

// HandleAbandonment finds the appropriate handler for the job and invokes it.
// If no handler supports the job action, this is a no-op (returns nil).
func (r *AbandonmentHandlerRegistry) HandleAbandonment(ctx context.Context, job *provisioning.Job) error {
	for _, handler := range r.handlers {
		if handler.SupportsAction(job.Spec.Action) {
			return handler.HandleAbandonment(ctx, job)
		}
	}
	// No handler found - that's okay, not all job types need special abandonment handling
	return nil
}
