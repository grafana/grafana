package legacy

import (
	"context"

	claims "github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
)

// WithWatchNotifications announces the user and team writes made through store
// on the legacy watch subjects once they have committed.
func WithWatchNotifications(store LegacyIdentityStore, publisher *legacywatch.Publisher) LegacyIdentityStore {
	if publisher == nil {
		return store
	}
	return &notifyingStore{LegacyIdentityStore: store, publisher: publisher}
}

type notifyingStore struct {
	LegacyIdentityStore
	publisher *legacywatch.Publisher
}

func (s *notifyingStore) CreateUser(ctx context.Context, ns claims.NamespaceInfo, cmd CreateUserCommand) (*CreateUserResult, error) {
	res, err := s.LegacyIdentityStore.CreateUser(ctx, ns, cmd)
	if err == nil {
		s.publisher.Publish(ctx, legacywatch.Added, iamv0.UserResourceInfo.GroupResource(), ns.OrgID, res.User.UID, res.User.Updated.UnixMilli())
	}
	return res, err
}

func (s *notifyingStore) UpdateUser(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateUserCommand) (*UpdateUserResult, error) {
	res, err := s.LegacyIdentityStore.UpdateUser(ctx, ns, cmd)
	if err == nil {
		s.publisher.Publish(ctx, legacywatch.Modified, iamv0.UserResourceInfo.GroupResource(), ns.OrgID, res.User.UID, res.User.Updated.UnixMilli())
	}
	return res, err
}

func (s *notifyingStore) UpdateLastSeenAt(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateUserLastSeenAtCommand) error {
	err := s.LegacyIdentityStore.UpdateLastSeenAt(ctx, ns, cmd)
	// We do not need to publish events when the lastSeenAt value updates -- this is a pretty silly design that will almost certainly be changed
	return err
}

func (s *notifyingStore) DeleteUser(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteUserCommand) error {
	err := s.LegacyIdentityStore.DeleteUser(ctx, ns, cmd)
	if err == nil {
		s.publisher.Publish(ctx, legacywatch.Deleted, iamv0.UserResourceInfo.GroupResource(), ns.OrgID, cmd.UID, 0)
	}
	return err
}

func (s *notifyingStore) CreateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTeamCommand) (*CreateTeamResult, error) {
	res, err := s.LegacyIdentityStore.CreateTeam(ctx, ns, cmd)
	if err == nil {
		s.publisher.Publish(ctx, legacywatch.Added, iamv0.TeamResourceInfo.GroupResource(), ns.OrgID, res.Team.UID, res.Team.Updated.UnixMilli())
	}
	return res, err
}

func (s *notifyingStore) UpdateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateTeamCommand) (*UpdateTeamResult, error) {
	res, err := s.LegacyIdentityStore.UpdateTeam(ctx, ns, cmd)
	if err == nil {
		s.publisher.Publish(ctx, legacywatch.Modified, iamv0.TeamResourceInfo.GroupResource(), ns.OrgID, res.Team.UID, res.Team.Updated.UnixMilli())
	}
	return res, err
}

func (s *notifyingStore) DeleteTeam(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteTeamCommand) error {
	err := s.LegacyIdentityStore.DeleteTeam(ctx, ns, cmd)
	if err == nil {
		s.publisher.Publish(ctx, legacywatch.Deleted, iamv0.TeamResourceInfo.GroupResource(), ns.OrgID, cmd.UID, 0)
	}
	return err
}

// Team members are part of their Team's spec, so a membership change is
// announced as a modified team; TeamBindings themselves are not announced.

func (s *notifyingStore) CreateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTeamMemberCommand) (*CreateTeamMemberResult, error) {
	res, err := s.LegacyIdentityStore.CreateTeamMember(ctx, ns, cmd)
	if err == nil {
		s.publishTeam(ctx, ns, res.TeamMember.TeamUID)
	}
	return res, err
}

func (s *notifyingStore) UpdateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd UpdateTeamMemberCommand) (*UpdateTeamMemberResult, error) {
	teamUID := s.bindingTeamUID(ctx, ns, cmd.UID)
	res, err := s.LegacyIdentityStore.UpdateTeamMember(ctx, ns, cmd)
	if err == nil {
		s.publishTeam(ctx, ns, teamUID)
	}
	return res, err
}

func (s *notifyingStore) DeleteTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteTeamMemberCommand) error {
	// Read the team first: it cannot be found from the binding once it is gone.
	teamUID := s.bindingTeamUID(ctx, ns, cmd.UID)
	err := s.LegacyIdentityStore.DeleteTeamMember(ctx, ns, cmd)
	if err == nil {
		s.publishTeam(ctx, ns, teamUID)
	}
	return err
}

func (s *notifyingStore) publishTeam(ctx context.Context, ns claims.NamespaceInfo, teamUID string) {
	s.publisher.Publish(ctx, legacywatch.Modified, iamv0.TeamResourceInfo.GroupResource(), ns.OrgID, teamUID, 0)
}

// bindingTeamUID returns the UID of the team a binding belongs to, or "" when
// nothing will be announced or the lookup fails.
func (s *notifyingStore) bindingTeamUID(ctx context.Context, ns claims.NamespaceInfo, uid string) string {
	if !s.publisher.Enabled() {
		return ""
	}
	res, err := s.ListTeamBindings(ctx, ns, ListTeamBindingsQuery{
		UID:        uid,
		OrgID:      ns.OrgID,
		Pagination: common.Pagination{Limit: 1},
	})
	if err != nil || len(res.Bindings) == 0 {
		return ""
	}
	return res.Bindings[0].TeamUID
}
