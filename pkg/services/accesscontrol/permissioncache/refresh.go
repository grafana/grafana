package permissioncache

import (
	"context"
	"slices"
	"time"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

// Service schedules permission-cache work on the SQL store's ordered event queue.
// Delivery is in-process and best-effort, not durable.
type Service struct {
	ac accesscontrol.Service
}

// ProvideService registers one listener per event for the shared cache service.
func ProvideService(sql *sqlstore.SQLStore, ac accesscontrol.Service) *Service {
	return New(sql.Bus(), ac)
}

// New must be called once per bus, using the SQL transaction owner's bus.
func New(events bus.Bus, ac accesscontrol.Service) *Service {
	s := &Service{ac: ac}
	events.AddEventListener(s.onCachesInvalidated)
	events.AddEventListener(s.onCreatorRefreshRequested)
	return s
}

type resourcePermissionCachesInvalidated struct {
	orgID   int64
	userIDs []int64
}

type resourceCreatorPermissionsRefreshRequested struct {
	requester identity.Requester
}

// InvalidateAfterCommit preserves the write order without exposing uncommitted grants.
// Without an outer transaction, the permission write has already committed.
func (s *Service) InvalidateAfterCommit(ctx context.Context, orgID int64, userIDs []int64) {
	event := &resourcePermissionCachesInvalidated{orgID: orgID, userIDs: slices.Clone(userIDs)}
	if sess := sqlstore.SessionFromContext(ctx); sess != nil {
		sess.PublishAfterCommit(event)
		return
	}
	_ = s.onCachesInvalidated(ctx, event)
}

func (s *Service) onCachesInvalidated(_ context.Context, event *resourcePermissionCachesInvalidated) error {
	seen := make(map[int64]bool, len(event.userIDs))
	for _, id := range event.userIDs {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		// SQL permission commands do not distinguish user and service-account IDs.
		for _, serviceAccount := range []bool{false, true} {
			s.ac.ClearUserPermissionCache(&user.SignedInUser{OrgID: event.orgID, UserID: id, IsServiceAccount: serviceAccount})
		}
	}
	return nil
}

// RefreshAfterCommit must follow successful permission writes and their invalidation.
// Without a transaction, it reloads immediately.
func (s *Service) RefreshAfterCommit(ctx context.Context, requester identity.Requester) {
	if requester == nil || !requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return
	}
	event := &resourceCreatorPermissionsRefreshRequested{requester: requester}
	if sess := sqlstore.SessionFromContext(ctx); sess != nil {
		sess.PublishAfterCommit(event)
		return
	}
	_ = s.onCreatorRefreshRequested(ctx, event)
}

func (s *Service) onCreatorRefreshRequested(ctx context.Context, event *resourceCreatorPermissionsRefreshRequested) error {
	// Remote AuthZ cannot read an uncommitted SQL transaction.
	if sqlstore.IsInTransaction(ctx) {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	ctx, span := tracing.Start(ctx, "accesscontrol.permissioncache.RefreshAfterCommit")
	defer span.End()
	if _, err := s.ac.GetUserPermissions(ctx, event.requester, accesscontrol.Options{ReloadCache: true}); err != nil {
		log.New("accesscontrol.permissioncache").FromContext(ctx).Warn("Failed to refresh creator permissions", "error", err)
		_ = tracing.Error(span, err)
	}
	// The mutation already committed. Refresh failure must not stop event delivery.
	return nil
}
