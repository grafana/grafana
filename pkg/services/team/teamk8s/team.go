package teamk8s

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
)

type TeamK8sService struct {
	logger             log.Logger
	namespaceMapper    request.NamespaceMapper
	restConfigProvider apiserver.RestConfigProvider
	clientGenerator    resource.ClientGenerator
	teamClient         *iamv0alpha1.TeamClient
	teamBindingClient  *iamv0alpha1.TeamBindingClient
	initClients        sync.Once
}

var _ team.Service = (*TeamK8sService)(nil)

func NewTeamK8sService(logger log.Logger, cfg *setting.Cfg, restConfigProvider apiserver.RestConfigProvider) *TeamK8sService {
	return &TeamK8sService{
		logger:             logger,
		namespaceMapper:    request.GetNamespaceMapper(cfg),
		restConfigProvider: restConfigProvider,
		initClients:        sync.Once{},
	}
}

// initK8sClients lazily initializes the Kubernetes clients on first use.
func (s *TeamK8sService) initK8sClients(ctx context.Context, logger log.Logger) {
	s.initClients.Do(func() {
		if s.restConfigProvider == nil {
			return
		}

		restConfig, err := s.restConfigProvider.GetRestConfig(ctx)
		if err != nil {
			logger.Warn("Failed to get rest config", "error", err)
			return
		}

		s.clientGenerator = k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())

		if c, err := iamv0alpha1.NewTeamClientFromGenerator(s.clientGenerator); err != nil {
			logger.Warn("Failed to create team client", "error", err)
		} else {
			s.teamClient = c
		}

		if c, err := iamv0alpha1.NewTeamBindingClientFromGenerator(s.clientGenerator); err != nil {
			logger.Warn("Failed to create team binding client", "error", err)
		} else {
			s.teamBindingClient = c
		}
	})
}

func (s *TeamK8sService) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	s.initK8sClients(ctx, s.logger)

	return team.Team{}, errors.New("not implemented")
}

func (s *TeamK8sService) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	s.initK8sClients(ctx, s.logger)

	return errors.New("not implemented")
}

func (s *TeamK8sService) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	s.initK8sClients(ctx, s.logger)

	return errors.New("not implemented")
}

func (s *TeamK8sService) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	s.initK8sClients(ctx, s.logger)

	return team.SearchTeamQueryResult{}, errors.New("not implemented")
}

func (s *TeamK8sService) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	s.initK8sClients(ctx, s.logger)

	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	s.initK8sClients(ctx, s.logger)

	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error) {
	s.initK8sClients(ctx, s.logger)

	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	s.initK8sClients(ctx, s.logger)

	return false, errors.New("not implemented")
}

func (s *TeamK8sService) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	s.initK8sClients(ctx, s.logger)

	return errors.New("not implemented")
}

func (s *TeamK8sService) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	s.initK8sClients(ctx, s.logger)

	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	s.initK8sClients(ctx, s.logger)

	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) RegisterDelete(query string) {}
