package permissioncache

import (
	"context"
	"time"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// RefreshAfterCommit reloads the creator's permissions after the outermost SQL commit.
// Call this only after successful permission writes. Without a transaction, it reloads immediately.
// Delivery is best-effort. A refresh failure does not fail the committed mutation.
func RefreshAfterCommit(ctx context.Context, service accesscontrol.Service, requester identity.Requester) {
	if requester == nil || !requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return
	}
	sqlstore.AfterCommit(ctx, func(ctx context.Context) {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		ctx, span := tracing.Start(ctx, "accesscontrol.permissioncache.RefreshAfterCommit")
		defer span.End()

		// Reload also refreshes the AuthZ-side caches, unlike local cache invalidation.
		if _, err := service.GetUserPermissions(ctx, requester, accesscontrol.Options{ReloadCache: true}); err != nil {
			log.New("accesscontrol.permissioncache").Warn("Failed to refresh creator permissions", "error", err)
			_ = tracing.Error(span, err)
		}
	})
}
