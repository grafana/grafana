package teamk8s

import (
	"context"
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var teamGVR = schema.GroupVersionResource{
	Group:    iamv0alpha1.APIGroup,
	Version:  iamv0alpha1.APIVersion,
	Resource: "teams",
}

type TeamK8sService struct {
	logger          log.Logger
	namespaceMapper request.NamespaceMapper
	configProvider  apiserver.DirectRestConfigProvider
	legacyService   team.Service
}

var _ team.Service = (*TeamK8sService)(nil)

func NewTeamK8sService(logger log.Logger, cfg *setting.Cfg, configProvider apiserver.DirectRestConfigProvider, legacyService team.Service) *TeamK8sService {
	return &TeamK8sService{
		logger:          logger,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		configProvider:  configProvider,
		legacyService:   legacyService,
	}
}

func (s *TeamK8sService) getClient(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
	if s.configProvider == nil {
		return nil, errors.New("config provider not initialized")
	}

	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return nil, errors.New("no request context")
	}

	dyn, err := dynamic.NewForConfig(s.configProvider.GetDirectRestConfig(reqCtx))
	if err != nil {
		return nil, err
	}

	return dyn.Resource(teamGVR).Namespace(namespace), nil
}

func (s *TeamK8sService) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return team.Team{}, err
	}
	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return team.Team{}, err
	}

	uid := util.GenerateShortUID()
	k8sTeam := iamv0alpha1.Team{
		TypeMeta: metav1.TypeMeta{
			APIVersion: iamv0alpha1.GroupVersion.Identifier(),
			Kind:       "Team",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      uid,
			Namespace: namespace,
		},
		Spec: iamv0alpha1.TeamSpec{
			Title:       cmd.Name,
			Email:       cmd.Email,
			ExternalUID: cmd.ExternalUID,
			Provisioned: cmd.IsProvisioned,
		},
	}

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&k8sTeam)
	if err != nil {
		return team.Team{}, err
	}

	result, err := client.Create(ctx, &unstructured.Unstructured{Object: unstructuredObj}, metav1.CreateOptions{})
	if err != nil {
		return team.Team{}, err
	}

	var created iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &created); err != nil {
		return team.Team{}, err
	}

	return team.Team{
		ID:            getTeamID(&created),
		UID:           created.Name,
		OrgID:         orgID,
		Name:          created.Spec.Title,
		Email:         created.Spec.Email,
		ExternalUID:   created.Spec.ExternalUID,
		IsProvisioned: created.Spec.Provisioned,
		Created:       created.CreationTimestamp.Time,
		Updated:       created.GetUpdateTimestamp(),
	}, nil
}

func (s *TeamK8sService) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	orgID := requester.GetOrgID()

	uid, _ := ctx.Value(team.TeamUIDCtxKey{}).(string)
	if uid == "" {
		legacyTeam, err := s.legacyService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
			ID:    cmd.ID,
			OrgID: orgID,
		})
		if err != nil {
			return err
		}
		uid = legacyTeam.UID
	}

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return err
	}

	result, err := client.Get(ctx, uid, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return team.ErrTeamNotFound
		}
		return err
	}

	updated := result.DeepCopy()
	if err := unstructured.SetNestedField(updated.Object, cmd.Name, "spec", "title"); err != nil {
		return err
	}
	if err := unstructured.SetNestedField(updated.Object, cmd.Email, "spec", "email"); err != nil {
		return err
	}
	if err := unstructured.SetNestedField(updated.Object, cmd.ExternalUID, "spec", "externalUID"); err != nil {
		return err
	}

	_, err = client.Update(ctx, updated, metav1.UpdateOptions{})
	return err
}

func (s *TeamK8sService) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	return errors.New("not implemented")
}

func (s *TeamK8sService) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	return team.SearchTeamQueryResult{}, errors.New("not implemented")
}

func (s *TeamK8sService) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	if query.ID == 0 && query.UID == "" {
		return nil, team.ErrTeamNotFound
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	orgID := requester.GetOrgID()

	uid := query.UID
	if uid == "" {
		uid, _ = ctx.Value(team.TeamUIDCtxKey{}).(string)
	}
	if uid == "" && query.ID != 0 {
		teamDTO, err := s.legacyService.GetTeamByID(ctx, query)
		if err != nil {
			return nil, err
		}
		uid = teamDTO.UID
	}

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return nil, err
	}

	result, err := client.Get(ctx, uid, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, team.ErrTeamNotFound
		}
		return nil, err
	}

	var fetched iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &fetched); err != nil {
		return nil, err
	}

	return &team.TeamDTO{
		ID:            getTeamID(&fetched),
		UID:           fetched.Name,
		OrgID:         orgID,
		Name:          fetched.Spec.Title,
		Email:         fetched.Spec.Email,
		ExternalUID:   fetched.Spec.ExternalUID,
		IsProvisioned: fetched.Spec.Provisioned,
	}, nil
}

func (s *TeamK8sService) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error) {
	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	return false, errors.New("not implemented")
}

func (s *TeamK8sService) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	return errors.New("not implemented")
}

func (s *TeamK8sService) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	return nil, errors.New("not implemented")
}

func (s *TeamK8sService) RegisterDelete(query string) {}

func getTeamID(team *iamv0alpha1.Team) int64 {
	if meta, err := utils.MetaAccessor(team); err == nil {
		return meta.GetDeprecatedInternalID() // nolint:staticcheck
	}
	return 0
}
