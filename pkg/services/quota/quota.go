package quota

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	// Get returns the quota for the specific scope (global, organization, user)
	// If the scope is organization, the ID is expected to be the organisation ID.
	// If the scope is user, the id is expected to be the user ID.
	Get(ctx context.Context, scope string, ID int64) ([]QuotaDTO, error)
	// Update overrides the quota for a specific scope (global, organization, user).
	// If the cmd.OrgID is set, then the organization quota are updated.
	// If the cmd.UseID is set, then the user quota are updated.
	Update(ctx context.Context, cmd *UpdateQuotaCmd) error
	// QuotaReached is called by the quota middleware for applying quota enforcement to API handlers
	QuotaReached(c *models.ReqContext, target string) (bool, error)
	// CheckQuotaReached checks if the quota limitations have been reached for a specific service target
	CheckQuotaReached(ctx context.Context, target string, scopeParams *ScopeParameters) (bool, error)
	// DeleteByUser deletes custom quota limitations for the user
	DeleteByUser(ctx context.Context, userID int64) error
	// DeleteByOrg(ctx context.Context, orgID int64) error

	// AddReporter registers a service UsageReporterFunc, targets and their default limits
	AddReporter(ctx context.Context, e *NewQuotaReporter) error
}

type UsageReporterFunc func(ctx context.Context, scopeParams *ScopeParameters) (*Map, error)
