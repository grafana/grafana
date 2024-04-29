package teamimpl

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/accesscontrol/embedserver"

	zclient "github.com/grafana/zanzana/pkg/service/client"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

type Service struct {
	store   store
	zClient *zclient.GRPCClient
}

func ProvideService(db db.DB, cfg *setting.Cfg, embedServer *embedserver.Service) (team.Service, error) {
	store := &xormStore{db: db, cfg: cfg, deletes: []string{}}

	if err := store.uidMigration(); err != nil {
		return nil, err
	}

	zClient, err := embedServer.GetClient(context.Background(), "1")
	if err != nil {
		return nil, err
	}

	return &Service{store: store, zClient: zClient}, nil
}

func (s *Service) CreateTeam(name, email string, orgID int64) (team.Team, error) {
	return s.store.Create(name, email, orgID)
}

func (s *Service) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	return s.store.Update(ctx, cmd)
}

func (s *Service) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	return s.store.Delete(ctx, cmd)
}

func (s *Service) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	return s.store.Search(ctx, query)
}

func (s *Service) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	return s.store.GetByID(ctx, query)
}

func (s *Service) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	return s.store.GetByUser(ctx, query)
}

func (s *Service) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error) {
	return s.store.GetIDsByUser(ctx, query)
}

func (s *Service) AddTeamMember(ctx context.Context, userID, orgID, teamID int64, isExternal bool, permission dashboardaccess.PermissionType) error {
	s.zClient.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              s.zClient.MustStoreID(ctx),
		AuthorizationModelId: s.zClient.AuthorizationModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{
				{
					User:     "user:" + strconv.FormatInt(userID, 10),
					Relation: "member",
					Object:   "team:" + strconv.FormatInt(teamID, 10), // FIXME: teamID has no org ref
				},
			},
		},
	})
	return s.store.AddMember(ctx, userID, orgID, teamID, isExternal, permission)
}

func (s *Service) UpdateTeamMember(ctx context.Context, cmd *team.UpdateTeamMemberCommand) error {
	return s.store.UpdateMember(ctx, cmd)
}

func (s *Service) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	return s.store.IsMember(orgId, teamId, userId)
}

func (s *Service) RemoveTeamMember(ctx context.Context, cmd *team.RemoveTeamMemberCommand) error {
	s.zClient.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              s.zClient.MustStoreID(ctx),
		AuthorizationModelId: s.zClient.AuthorizationModelID,
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: []*openfgav1.TupleKeyWithoutCondition{
				{
					User:     "user:" + strconv.FormatInt(cmd.UserID, 10),
					Relation: "member",
					Object:   "team:" + strconv.FormatInt(cmd.TeamID, 10), // FIXME: teamID has no org ref
				},
			},
		},
	})
	return s.store.RemoveMember(ctx, cmd)
}

func (s *Service) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	return s.store.RemoveUsersMemberships(ctx, userID)
}

func (s *Service) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error) {
	return s.store.GetMemberships(ctx, orgID, userID, external)
}

func (s *Service) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	return s.store.GetMembers(ctx, query)
}

func (s *Service) RegisterDelete(query string) {
	s.store.RegisterDelete(query)
}
