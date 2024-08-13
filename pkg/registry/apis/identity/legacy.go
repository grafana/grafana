package identity

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/authlib/claims"
	identity "github.com/grafana/grafana/pkg/apimachinery/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	_ LegacyUserStore = (*legacyUserStore)(nil)
)

type LegacyPaging struct {
	Start int64 // ContinueID
	Limit int64
}

// RBAC is not applied
type LegacyUserStore interface {
	GetUser(ctx context.Context, ns string, kind claims.IdentityType, uid string) (*user.User, error)
	ListUsers(ctx context.Context, ns string, kind claims.IdentityType, paging LegacyPaging) (*user.ListUserResult, error)

	// Get the teams for a given user
	GetUserTeams(ctx context.Context, ns string, kind claims.IdentityType, uid string) ([]*team.Team, error)

	// This command is also used to get a single team
	GetTeam(ctx context.Context, ns string, uid string) (*team.Team, error)
	ListTeams(ctx context.Context, ns string, paging LegacyPaging) ([]*team.Team, error)

	// Get user display properties
	GetDisplay(ctx context.Context, ns string, cmd *user.GetDisplayCommand) ([]identity.IdentityDisplay, error)
}

func asTeam(team *team.Team, ns string) (*identity.Team, error) {
	item := &identity.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name:              team.UID,
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(team.Created),
			ResourceVersion:   strconv.FormatInt(team.Updated.UnixMilli(), 10),
		},
		Spec: identity.TeamSpec{
			Title: team.Name,
			Email: team.Email,
		},
	}
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}
	meta.SetUpdatedTimestamp(&team.Updated)
	meta.SetOriginInfo(&utils.ResourceOriginInfo{
		Name: "SQL",
		Path: strconv.FormatInt(team.ID, 10),
	})
	return item, nil
}

type legacyUserStore struct {
	svcTeam team.Service
	svcUser user.Service
}

// GetTeam implements LegacyUserStore.
func (s *legacyUserStore) getOrgID(ns string) (int64, error) {
	info, err := claims.ParseNamespace(ns)
	if err != nil {
		return 0, err
	}
	if info.OrgID < 1 {
		return 0, fmt.Errorf("expected valid orgId in namespace")
	}
	return info.OrgID, nil
}

// GetUser implements LegacyUserStore.
func (s *legacyUserStore) GetUser(ctx context.Context, ns string, kind claims.IdentityType, uid string) (*user.User, error) {
	orgId, err := s.getOrgID(ns)
	if err != nil {
		return nil, err
	}
	found, err := s.svcUser.GetByUID(ctx, &user.GetUserByUIDQuery{
		OrgID: orgId,
		UID:   uid,
	})
	if found != nil {
		switch kind {
		case claims.TypeUser:
			if found.IsServiceAccount {
				return nil, fmt.Errorf("uid is for a service account")
			}
		case claims.TypeServiceAccount:
			if !found.IsServiceAccount {
				return nil, fmt.Errorf("uid is for a concrete user")
			}
		default:
		}
	}
	return found, err
}

// GetUserTeams implements LegacyUserStore.
func (s *legacyUserStore) GetUserTeams(ctx context.Context, ns string, kind claims.IdentityType, uid string) ([]*team.Team, error) {
	u, err := s.GetUser(ctx, ns, kind, uid)
	if err != nil {
		return nil, err
	}

	mem, err := s.svcTeam.GetUserTeamMemberships(ctx, u.OrgID, u.ID, false)
	if err != nil {
		return nil, err
	}

	teams := make([]*team.Team, len(mem))
	for i, m := range mem {
		teams[i] = &team.Team{
			ID:    m.TeamID,
			UID:   m.TeamUID,
			Name:  m.Name,
			Email: m.Email,
		}
	}
	return teams, nil
}

// GetTeam implements LegacyUserStore.
func (s *legacyUserStore) GetTeam(ctx context.Context, ns string, uid string) (*team.Team, error) {
	orgId, err := s.getOrgID(ns)
	if err != nil {
		return nil, err
	}
	teams, err := s.svcTeam.ListTeams(ctx, &team.ListTeamsCommand{
		OrgID: orgId,
		UID:   uid,
		Limit: 100,
	})
	if len(teams) > 0 {
		return teams[0], err
	}
	return nil, err
}

// ListTeams implements LegacyUserStore.
func (s *legacyUserStore) ListTeams(ctx context.Context, ns string, paging LegacyPaging) ([]*team.Team, error) {
	orgId, err := s.getOrgID(ns)
	if err != nil {
		return nil, err
	}

	return s.svcTeam.ListTeams(ctx, &team.ListTeamsCommand{
		OrgID: orgId,
		Start: int(paging.Start),
		Limit: int(paging.Limit),
	})
}

// ListUsers implements LegacyUserStore.
func (s *legacyUserStore) ListUsers(ctx context.Context, ns string, kind claims.IdentityType, paging LegacyPaging) (*user.ListUserResult, error) {
	orgId, err := s.getOrgID(ns)
	if err != nil {
		return nil, err
	}
	return s.svcUser.List(ctx, &user.ListUsersCommand{
		OrgID:            orgId,
		Limit:            paging.Limit,
		ContinueID:       paging.Start,
		IsServiceAccount: kind == claims.TypeServiceAccount,
	})
}

// GetDisplay implements LegacyUserStore.
func (s *legacyUserStore) GetDisplay(ctx context.Context, ns string, cmd *user.GetDisplayCommand) ([]identity.IdentityDisplay, error) {
	orgId, err := s.getOrgID(ns)
	if err != nil {
		return nil, err
	}
	cmd.OrgID = orgId
	return s.svcUser.GetDisplay(ctx, cmd)
}
