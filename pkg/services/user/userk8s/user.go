package userk8s

import (
	"context"
	"errors"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var userGVR = schema.GroupVersionResource{
	Group:    iamv0alpha1.APIGroup,
	Version:  iamv0alpha1.APIVersion,
	Resource: "users",
}

type UserK8sService struct {
	logger          log.Logger
	namespaceMapper request.NamespaceMapper
	configProvider  apiserver.DirectRestConfigProvider
}

var _ user.Service = (*UserK8sService)(nil)

func NewUserK8sService(logger log.Logger, cfg *setting.Cfg, configProvider apiserver.DirectRestConfigProvider) *UserK8sService {
	return &UserK8sService{
		logger:          logger,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		configProvider:  configProvider,
	}
}

func (s *UserK8sService) getClient(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
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

	return dyn.Resource(userGVR).Namespace(namespace), nil
}

func (s *UserK8sService) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	namespace := s.namespaceMapper(cmd.OrgID)

	// Call getClient to fix the linter error about unused function, the actual implementation will come in a future PR
	_, err := s.getClient(ctx, namespace)
	if err != nil {
		return nil, err
	}

	return nil, errors.New("not implemented")
}

func (s *UserK8sService) CreateServiceAccount(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) Delete(ctx context.Context, cmd *user.DeleteUserCommand) error {
	return errors.New("not implemented")
}

func (s *UserK8sService) GetByID(ctx context.Context, cmd *user.GetUserByIDQuery) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) GetByUID(ctx context.Context, cmd *user.GetUserByUIDQuery) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) ListByIdOrUID(ctx context.Context, ids []string, intIDs []int64) ([]*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) GetByLogin(ctx context.Context, cmd *user.GetUserByLoginQuery) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) GetByEmail(ctx context.Context, cmd *user.GetUserByEmailQuery) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	return errors.New("not implemented")
}

func (s *UserK8sService) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return errors.New("not implemented")
}

func (s *UserK8sService) GetSignedInUser(ctx context.Context, cmd *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) Search(ctx context.Context, cmd *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	return errors.New("not implemented")
}

func (s *UserK8sService) GetProfile(ctx context.Context, cmd *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) GetUsageStats(ctx context.Context) map[string]any {
	return map[string]any{}
}
