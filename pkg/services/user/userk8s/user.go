package userk8s

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

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

	ctxLogger := s.logger.FromContext(ctx)

	orgID, err := s.getOrgID(ctx, ctxLogger)
	if err != nil {
		ctxLogger.Error("failed to get orgID from context", "err", err)
		return nil, err
	}

	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
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
		ctxLogger.Error("k8s user create failed", "namespace", namespace, "orgID", orgID, "login", cmd.Login, "err", err)
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
	ctx, span := s.tracer.Start(ctx, "user.getByID", trace.WithAttributes(
		attribute.Int64("userID", cmd.ID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	orgID, err := s.getOrgID(ctx, ctxLogger)
	if err != nil {
		ctxLogger.Error("failed to get orgID from context", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	found, err := s.getByInternalID(ctx, ctxLogger, client, cmd.ID, namespace)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	return toUser(found, orgID), nil
}

func (s *UserK8sService) GetByUID(ctx context.Context, cmd *user.GetUserByUIDQuery) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) ListByIdOrUID(ctx context.Context, ids []string, intIDs []int64) ([]*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) GetByLoginWithPassword(_ context.Context, _ *user.GetUserByLoginQuery) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (s *UserK8sService) GetByLogin(ctx context.Context, cmd *user.GetUserByLoginQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.getByLogin", trace.WithAttributes(
		attribute.String("loginOrEmail", cmd.LoginOrEmail),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	loginOrEmail := strings.ToLower(cmd.LoginOrEmail)

	orgID, err := s.getOrgID(ctx, ctxLogger)
	if err != nil {
		ctxLogger.Error("failed to get orgID from context", "err", err)
		return nil, err
	}

	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		return nil, err
	}

	if strings.Contains(loginOrEmail, "@") {
		u, err := s.getByFieldSelector(ctx, ctxLogger, client, "spec.email", loginOrEmail, orgID)
		if err != nil && !errors.Is(err, user.ErrUserNotFound) {
			span.RecordError(err)
			return nil, err
		}
		if u != nil {
			return u, nil
		}
	}

	u, err := s.getByFieldSelector(ctx, ctxLogger, client, "spec.login", loginOrEmail, orgID)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	return u, nil
}

func (s *UserK8sService) GetByEmail(ctx context.Context, cmd *user.GetUserByEmailQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.getByEmail", trace.WithAttributes(
		attribute.String("email", cmd.Email),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	orgID, err := s.getOrgID(ctx, ctxLogger)
	if err != nil {
		ctxLogger.Error("failed to get orgID from context", "err", err)
		return nil, err
	}

	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		return nil, err
	}

	u, err := s.getByFieldSelector(ctx, ctxLogger, client, "spec.email", strings.ToLower(cmd.Email), orgID)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	return u, nil
}

func (s *UserK8sService) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	ctx, span := s.tracer.Start(ctx, "user.update", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	orgID, err := s.getOrgID(ctx, ctxLogger)
	if err != nil {
		ctxLogger.Error("failed to get orgID from context", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	existing, err := s.getByInternalID(ctx, ctxLogger, client, cmd.UserID, namespace)
	if err != nil {
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

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(existing)
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
	ctx, span := s.tracer.Start(ctx, "user.updateLastSeenAt", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	namespace := s.namespaceMapper(cmd.OrgID)
	span.SetAttributes(attribute.Int64("orgID", cmd.OrgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	existing, err := s.getByInternalID(ctx, ctxLogger, client, cmd.UserID, namespace)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	if existing.Status.LastSeenAt != 0 {
		lastSeen := time.Unix(existing.Status.LastSeenAt, 0)
		if time.Since(lastSeen) <= s.config.UserLastSeenUpdateInterval {
			return user.ErrLastSeenUpToDate
		}
	}

	existing.Status.LastSeenAt = time.Now().Unix()

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(existing)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	_, err = client.UpdateStatus(ctx, &unstructured.Unstructured{Object: unstructuredObj}, metav1.UpdateOptions{})
	if err != nil {
		ctxLogger.Error("k8s user update status failed", "namespace", namespace, "orgID", cmd.OrgID, "userID", cmd.UserID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	return nil
}

func (s *UserK8sService) GetSignedInUser(ctx context.Context, cmd *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	ctx, span := s.tracer.Start(ctx, "user.getSignedInUser", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
		attribute.Int64("orgID", cmd.OrgID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	orgID := cmd.OrgID
	if orgID <= 0 {
		var err error
		orgID, err = s.getOrgID(ctx, ctxLogger)
		if err != nil {
			ctxLogger.Error("failed to get orgID from context", "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}
	}

	namespace := s.namespaceMapper(orgID)
	span.SetAttributes(attribute.Int64("orgID", orgID))

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	var found *iamv0alpha1.User
	var lookupErr error
	switch {
	case cmd.UserID > 0:
		found, lookupErr = s.getByInternalID(ctx, ctxLogger, client, cmd.UserID, namespace)
	case cmd.Login != "":
		found, lookupErr = s.getByFieldSelectorRaw(ctx, ctxLogger, client, "spec.login", strings.ToLower(cmd.Login))
	case cmd.Email != "":
		found, lookupErr = s.getByFieldSelectorRaw(ctx, ctxLogger, client, "spec.email", strings.ToLower(cmd.Email))
	default:
		span.RecordError(user.ErrNoUniqueID)
		span.SetStatus(codes.Error, user.ErrNoUniqueID.Error())
		return nil, user.ErrNoUniqueID
	}

	if lookupErr != nil {
		span.RecordError(lookupErr)
		span.SetStatus(codes.Error, lookupErr.Error())
		return nil, lookupErr
	}

	return toSignedInUser(found, orgID), nil
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

func (s *UserK8sService) getOrgID(ctx context.Context, logger log.Logger) (int64, error) {
	requester, err := identity.GetRequester(ctx)
	if err == nil {
		return requester.GetOrgID(), nil
	}

	logger.Debug("failed to get requester from context, falling back to orgID", "error", err)
	orgID, ok := identity.OrgIDFrom(ctx)
	if ok {
		return orgID, nil
	}

	return 0, errors.New("failed to get orgID: no requester or orgID in context")
}

func (s *UserK8sService) getByInternalID(ctx context.Context, logger log.Logger, client dynamic.ResourceInterface, userID int64, namespace string) (*iamv0alpha1.User, error) {
	labelSelector := utils.LabelKeyDeprecatedInternalID + "=" + strconv.FormatInt(userID, 10)
	list, err := client.List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		logger.Error("k8s user list failed", "namespace", namespace, "userID", userID, "err", err)
		return nil, err
	}

	if len(list.Items) == 0 {
		return nil, user.ErrUserNotFound
	}

	if len(list.Items) > 1 {
		logger.Error("multiple users found with same deprecated internal ID", "namespace", namespace, "userID", userID, "count", len(list.Items))
		return nil, errors.New("multiple users found")
	}

	var found iamv0alpha1.User
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(list.Items[0].Object, &found); err != nil {
		return nil, err
	}

	return &found, nil
}

func (s *UserK8sService) getByFieldSelectorRaw(ctx context.Context, logger log.Logger, client dynamic.ResourceInterface, field, value string) (*iamv0alpha1.User, error) {
	result, err := client.List(ctx, metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(field, value).String(),
	})
	if err != nil {
		logger.Error("k8s user list failed", "field", field, "value", value, "err", err)
		return nil, err
	}
	if len(result.Items) == 0 {
		return nil, user.ErrUserNotFound
	}
	var found iamv0alpha1.User
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Items[0].Object, &found); err != nil {
		return nil, err
	}
	return &found, nil
}

func (s *UserK8sService) getByFieldSelector(ctx context.Context, logger log.Logger, client dynamic.ResourceInterface, field, value string, orgID int64) (*user.User, error) {
	found, err := s.getByFieldSelectorRaw(ctx, logger, client, field, value)
	if err != nil {
		return nil, err
	}
	return toUser(found, orgID), nil
}

func toSignedInUser(u *iamv0alpha1.User, orgID int64) *user.SignedInUser {
	userID := getUserID(u)

	signedInUser := &user.SignedInUser{
		UserID:         userID,
		UserUID:        u.Name,
		OrgID:          orgID,
		Login:          u.Spec.Login,
		Name:           u.Spec.Title,
		Email:          u.Spec.Email,
		EmailVerified:  u.Spec.EmailVerified,
		IsGrafanaAdmin: u.Spec.GrafanaAdmin,
		IsDisabled:     u.Spec.Disabled,
		LastSeenAt:     time.Unix(u.Status.LastSeenAt, 0),
	}

	role := identity.RoleType(u.Spec.Role)
	if role.IsValid() {
		signedInUser.OrgRole = role
	} else {
		signedInUser.OrgID = -1
		signedInUser.OrgName = "Org missing"
	}

	return signedInUser
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
		LastSeenAt:    time.Unix(u.Status.LastSeenAt, 0),
	}
}
