package userk8s

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/fields"
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

	return toUser(&created, orgID), nil
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
	ctx, span := s.tracer.Start(ctx, "user.getByLogin", trace.WithAttributes(
		attribute.String("loginOrEmail", cmd.LoginOrEmail),
	))
	defer span.End()

	loginOrEmail := strings.ToLower(cmd.LoginOrEmail)

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

	if strings.Contains(loginOrEmail, "@") {
		if u, err := s.getByFieldSelector(ctx, client, "spec.email", loginOrEmail, orgID); err != nil {
			span.RecordError(err)
			return nil, err
		} else if u != nil {
			return u, nil
		}
	}

	u, err := s.getByFieldSelector(ctx, client, "spec.login", loginOrEmail, orgID)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	if u == nil {
		return nil, user.ErrUserNotFound
	}

	return u, nil
}

func (s *UserK8sService) GetByEmail(ctx context.Context, cmd *user.GetUserByEmailQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.getByEmail", trace.WithAttributes(
		attribute.String("email", cmd.Email),
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

	u, err := s.getByFieldSelector(ctx, client, "spec.email", strings.ToLower(cmd.Email), orgID)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	if u == nil {
		return nil, user.ErrUserNotFound
	}

	return u, nil
}

func (s *UserK8sService) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	ctx, span := s.tracer.Start(ctx, "user.update", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("failed to get requester from context", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	labelSelector := utils.LabelKeyDeprecatedInternalID + "=" + strconv.FormatInt(cmd.UserID, 10)
	list, err := client.List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		ctxLogger.Error("k8s user list failed", "namespace", namespace, "userID", cmd.UserID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	if len(list.Items) == 0 {
		span.RecordError(user.ErrUserNotFound)
		span.SetStatus(codes.Error, user.ErrUserNotFound.Error())
		return user.ErrUserNotFound
	}

	if len(list.Items) > 1 {
		ctxLogger.Error("multiple users found with same deprecated internal ID", "namespace", namespace, "userID", cmd.UserID, "count", len(list.Items))
		err := errors.New("multiple users found")
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	var existing iamv0alpha1.User
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(list.Items[0].Object, &existing); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	if cmd.Name != "" {
		existing.Spec.Title = cmd.Name
	}
	if cmd.Email != "" {
		existing.Spec.Email = strings.ToLower(cmd.Email)
	}
	if cmd.Login != "" {
		existing.Spec.Login = strings.ToLower(cmd.Login)
	}
	if cmd.IsDisabled != nil {
		existing.Spec.Disabled = *cmd.IsDisabled
	}
	if cmd.EmailVerified != nil {
		existing.Spec.EmailVerified = *cmd.EmailVerified
	}
	if cmd.IsGrafanaAdmin != nil {
		existing.Spec.GrafanaAdmin = *cmd.IsGrafanaAdmin
	}
	if cmd.IsProvisioned != nil {
		existing.Spec.Provisioned = *cmd.IsProvisioned
	}

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&existing)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	_, err = client.Update(ctx, &unstructured.Unstructured{Object: unstructuredObj}, metav1.UpdateOptions{})
	if err != nil {
		ctxLogger.Error("k8s user update failed", "namespace", namespace, "orgID", orgID, "userID", cmd.UserID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	return nil
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

func (s *UserK8sService) getByFieldSelector(ctx context.Context, client dynamic.ResourceInterface, field, value string, orgID int64) (*user.User, error) {
	result, err := client.List(ctx, metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(field, value).String(),
	})
	if err != nil {
		s.logger.Error("k8s user list failed", "orgID", orgID, "field", field, "value", value, "err", err)
		return nil, err
	}
	if len(result.Items) == 0 {
		return nil, nil
	}
	var found iamv0alpha1.User
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Items[0].Object, &found); err != nil {
		return nil, err
	}
	return toUser(&found, orgID), nil
}

func toUser(u *iamv0alpha1.User, orgID int64) *user.User {
	return &user.User{
		ID:            getUserID(u),
		UID:           u.Name,
		OrgID:         orgID,
		Login:         u.Spec.Login,
		Email:         u.Spec.Email,
		Name:          u.Spec.Title,
		IsAdmin:       u.Spec.GrafanaAdmin,
		IsDisabled:    u.Spec.Disabled,
		EmailVerified: u.Spec.EmailVerified,
		IsProvisioned: u.Spec.Provisioned,
		Created:       u.CreationTimestamp.Time,
		Updated:       u.GetUpdateTimestamp(),
	}
}
