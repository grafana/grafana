package teamprovider

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/team/teamk8s"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	legacyService     team.Service
	k8sService        team.Service
	openFeatureClient *openfeature.Client
}

var _ team.Service = (*Service)(nil)

func ProvideService(db db.DB, cfg *setting.Cfg, tracer tracing.Tracer, restConfigProvider apiserver.RestConfigProvider) *Service {
	legacyService, err := teamimpl.ProvideService(db, cfg, tracer)
	if err != nil {
		return nil
	}

	k8sService := teamk8s.NewTeamK8sService(log.New("team.k8s"), cfg, restConfigProvider)

	return &Service{
		legacyService:     legacyService,
		k8sService:        k8sService,
		openFeatureClient: openfeature.NewDefaultClient(),
	}
}

func (s *Service) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.CreateTeam(ctx, cmd)
	}

	return s.legacyService.CreateTeam(ctx, cmd)
}

func (s *Service) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.UpdateTeam(ctx, cmd)
	}

	return s.legacyService.UpdateTeam(ctx, cmd)
}

func (s *Service) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.DeleteTeam(ctx, cmd)
	}

	return s.legacyService.DeleteTeam(ctx, cmd)
}

func (s *Service) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.SearchTeams(ctx, query)
	}

	return s.legacyService.SearchTeams(ctx, query)
}

func (s *Service) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.GetTeamByID(ctx, query)
	}

	return s.legacyService.GetTeamByID(ctx, query)
}

func (s *Service) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.GetTeamsByUser(ctx, query)
	}

	return s.legacyService.GetTeamsByUser(ctx, query)
}

func (s *Service) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.GetTeamIDsByUser(ctx, query)
	}

	return s.legacyService.GetTeamIDsByUser(ctx, query)
}

func (s *Service) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.IsTeamMember(ctx, orgId, teamId, userId)
	}

	return s.legacyService.IsTeamMember(ctx, orgId, teamId, userId)
}

func (s *Service) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.RemoveUsersMemberships(ctx, userID)
	}

	return s.legacyService.RemoveUsersMemberships(ctx, userID)
}

func (s *Service) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.GetUserTeamMemberships(ctx, orgID, userID, external, bypassCache)
	}

	return s.legacyService.GetUserTeamMemberships(ctx, orgID, userID, external, bypassCache)
}

func (s *Service) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.GetTeamMembers(ctx, query)
	}

	return s.legacyService.GetTeamMembers(ctx, query)
}

func (s *Service) RegisterDelete(query string) {
	if s.isKubernetesTeamServiceEnabled(context.Background()) {
		s.k8sService.RegisterDelete(query)
		return
	}

	s.legacyService.RegisterDelete(query)
}

func (s *Service) isKubernetesTeamServiceEnabled(ctx context.Context) bool {
	if s.openFeatureClient == nil {
		return false
	}

	return s.openFeatureClient.Boolean(ctx, featuremgmt.FlagKubernetesTeamService, false, openfeature.TransactionContext(ctx))
}
