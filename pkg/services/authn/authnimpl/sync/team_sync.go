package sync

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/team"
)

func ProvideTeamSync(teamService team.Service, teamPermissionsService accesscontrol.TeamPermissionsService, tracer tracing.Tracer) *TeamSync {
	return &TeamSync{
		teamService:           teamService,
		teamPermissionsService: teamPermissionsService,
		log:                   log.New("team.sync"),
		tracer:                tracer,
	}
}

type TeamSync struct {
	teamService           team.Service
	teamPermissionsService accesscontrol.TeamPermissionsService
	log                   log.Logger
	tracer                tracing.Tracer
}

func (s *TeamSync) SyncTeamsHook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "team.sync.SyncTeamsHook")
	defer span.End()

	if !identity.ClientParams.SyncTeams {
		return nil
	}

	if len(identity.ExternalGroups) == 0 {
		s.log.Debug("No external groups to sync for user", "id", identity.ID)
		return nil
	}

	userID, err := identity.GetInternalID()
	if err != nil {
		s.log.Warn("Failed to get user internal ID for team sync", "id", identity.ID, "err", err)
		return nil
	}

	s.log.Debug("Syncing external groups to teams", "userId", userID, "externalGroups", identity.ExternalGroups, "orgId", identity.OrgID)

	for _, groupName := range identity.ExternalGroups {
		if err := s.syncUserToTeam(ctx, identity.OrgID, userID, groupName); err != nil {
			s.log.Error("Failed to sync user to team", "userId", userID, "team", groupName, "error", err)
		}
	}

	return nil
}

func (s *TeamSync) syncUserToTeam(ctx context.Context, orgID int64, userID int64, teamName string) error {
	searchQuery := &team.SearchTeamsQuery{
		OrgID: orgID,
		Name:  teamName,
		Limit: 1,
	}

	result, err := s.teamService.SearchTeams(ctx, searchQuery)
	if err != nil {
		return err
	}

	if len(result.Teams) == 0 {
		s.log.Debug("Team not found, skipping sync", "team", teamName, "orgId", orgID)
		return nil
	}

	teamDTO := result.Teams[0]

	isMember, err := s.teamService.IsTeamMember(ctx, orgID, teamDTO.ID, userID)
	if err != nil {
		return err
	}

	if isMember {
		s.log.Debug("User is already a member of team", "userId", userID, "team", teamName)
		return nil
	}

	teamIDStr := strconv.FormatInt(teamDTO.ID, 10)
	_, err = s.teamPermissionsService.SetUserPermission(ctx, orgID, accesscontrol.User{ID: userID}, teamIDStr, "Member")
	if err != nil {
		s.log.Error("Failed to add user to team", "userId", userID, "teamId", teamDTO.ID, "error", err)
		return err
	}

	s.log.Debug("Successfully added user to team", "userId", userID, "team", teamName)
	return nil
}