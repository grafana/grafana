package legacy

import (
	"context"

	claims "github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
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
