package quota

import (
	"context"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type Service interface {
	// GetQuotasByScope returns the quota for the specific scope (global, organization, user)
	// If the scope is organization, the ID is expected to be the organisation ID.
	// If the scope is user, the id is expected to be the user ID.
	GetQuotasByScope(ctx context.Context, scope Scope, ID int64) ([]QuotaDTO, error)
	// Update overrides the quota for a specific scope (global, organization, user).
	// If the cmd.OrgID is set, then the organization quota are updated.
	// If the cmd.UseID is set, then the user quota are updated.
	Update(ctx context.Context, cmd *UpdateQuotaCmd) error
	// QuotaReached is called by the quota middleware for applying quota enforcement to API handlers
	QuotaReached(c *contextmodel.ReqContext, targetSrv TargetSrv) (bool, error)
	// CheckQuotaReached checks if the quota limitations have been reached for a specific service
	CheckQuotaReached(ctx context.Context, targetSrv TargetSrv, scopeParams *ScopeParameters) (bool, error)
	// DeleteQuotaForUser deletes custom quota limitations for the user
	DeleteQuotaForUser(ctx context.Context, userID int64) error
	// DeleteByOrg(ctx context.Context, orgID int64) error

	// RegisterQuotaReporter registers a service UsageReporterFunc, targets and their default limits
	RegisterQuotaReporter(e *NewUsageReporter) error
}

type UsageReporterFunc func(ctx context.Context, scopeParams *ScopeParameters) (*Map, error)
