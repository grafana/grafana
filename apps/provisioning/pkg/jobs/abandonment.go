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
