package userk8s

import (
	"context"
	"errors"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
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
	config          *setting.Cfg
	tracer          tracing.Tracer
}

var _ user.Service = (*UserK8sService)(nil)

func NewUserK8sService(logger log.Logger, cfg *setting.Cfg, configProvider apiserver.DirectRestConfigProvider, tracer tracing.Tracer) *UserK8sService {
	return &UserK8sService{
		logger:          logger,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		configProvider:  configProvider,
		config:          cfg,
		tracer:          tracer,
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
	ctx, span := s.tracer.Start(ctx, "user.create", trace.WithAttributes(
		attribute.String("login", cmd.Login),
	))
	defer span.End()

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		s.logger.Error("failed to get requester from context", "err", err)
		return nil, err
	}

	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		s.logger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		return nil, err
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}

	role := cmd.DefaultOrgRole
	if role == "" && s.config != nil {
		role = s.config.AutoAssignOrgRole
	}

	if cmd.Email == "" {
		cmd.Email = cmd.Login
	}

	k8sUser := iamv0alpha1.User{
		TypeMeta: metav1.TypeMeta{
			APIVersion: iamv0alpha1.GroupVersion.Identifier(),
			Kind:       "User",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      uid,
			Namespace: namespace,
		},
		Spec: iamv0alpha1.UserSpec{
			Login:         strings.ToLower(cmd.Login),
			Email:         strings.ToLower(cmd.Email),
			Title:         cmd.Name,
			GrafanaAdmin:  cmd.IsAdmin,
			Disabled:      cmd.IsDisabled,
			EmailVerified: cmd.EmailVerified,
			Provisioned:   cmd.IsProvisioned,
			Role:          role,
		},
	}

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&k8sUser)
	if err != nil {
		return nil, err
	}

	result, err := client.Create(ctx, &unstructured.Unstructured{Object: unstructuredObj}, metav1.CreateOptions{})
	if err != nil {
		s.logger.Error("k8s user create failed", "namespace", namespace, "orgID", orgID, "login", cmd.Login, "err", err)
		span.RecordError(err)
		return nil, err
	}

	var created iamv0alpha1.User
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &created); err != nil {
		return nil, err
	}

	return &user.User{
		ID:            getUserID(&created),
		UID:           created.Name,
		OrgID:         orgID,
		Login:         created.Spec.Login,
		Email:         created.Spec.Email,
		Name:          created.Spec.Title,
		IsAdmin:       created.Spec.GrafanaAdmin,
		IsDisabled:    created.Spec.Disabled,
		EmailVerified: created.Spec.EmailVerified,
		IsProvisioned: created.Spec.Provisioned,
		Created:       created.CreationTimestamp.Time,
		Updated:       created.GetUpdateTimestamp(),
	}, nil
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

func getUserID(u *iamv0alpha1.User) int64 {
	if meta, err := utils.MetaAccessor(u); err == nil {
		return meta.GetDeprecatedInternalID() // nolint:staticcheck
	}
	return 0
}
