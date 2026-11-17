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

// RefreshCreator reloads committed permissions without failing the mutation.
// Callers must defer this operation until the outermost transaction commits.
func RefreshCreator(ctx context.Context, service accesscontrol.Service, requester identity.Requester) {
	if requester == nil || !requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return
	}
	// Remote AuthZ cannot read an uncommitted SQL transaction.
	if sqlstore.IsInTransaction(ctx) {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	ctx, span := tracing.Start(ctx, "accesscontrol.permissioncache.RefreshCreator")
	defer span.End()
	if _, err := service.GetUserPermissions(ctx, requester, accesscontrol.Options{ReloadCache: true}); err != nil {
		log.New("accesscontrol.permissioncache").FromContext(ctx).Warn("Failed to refresh creator permissions", "error", err)
		_ = tracing.Error(span, err)
	}
}
