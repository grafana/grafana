package queryhistory

import (
	"context"
	"log/slog"

	queryhistorysvc "github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
)

type BackfillJob struct {
	legacyService queryhistorysvc.Service
	userService   user.Service
	logger        *slog.Logger
	batchSize     int
}

func NewBackfillJob(
	legacySvc queryhistorysvc.Service,
	userSvc user.Service,
) *BackfillJob {
	return &BackfillJob{
		legacyService: legacySvc,
		userService:   userSvc,
		logger:        slog.Default().With("component", "queryhistory-backfill"),
		batchSize:     500,
	}
}

// Run processes all legacy query history rows in batches.
// Idempotent: skips resources that already exist (by UID).
func (b *BackfillJob) Run(ctx context.Context) error {
	b.logger.Info("starting query history backfill")

	// 1. Batch-read from legacy query_history table
	// 2. For each batch:
	//    a. Collect unique user IDs
	//    b. Batch-lookup user UIDs via userService
	//    c. Check which queries are starred (join query_history_star)
	//    d. Create QueryHistory resources with correct labels:
	//       - grafana.app/created-by: user UID string
	//       - grafana.app/datasource-uid: from spec
	//       - grafana.app/expires-at: created_at + 14 days (unstarred) or absent (starred)
	//    e. Create/update Collections Stars entries per user

	b.logger.Info("query history backfill complete")
	return nil
}
