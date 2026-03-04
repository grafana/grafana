package sync

import (
	"context"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/util"
)

type K8sUserService struct {
	logger             log.Logger
	namespaceMapper    request.NamespaceMapper
	restConfigProvider apiserver.RestConfigProvider
	clientGenerator    resource.ClientGenerator
	userClient         *iamv0alpha1.UserClient
	initClients        sync.Once
}

var _ UserProxy = (*K8sUserService)(nil)

func NewK8sUserService(logger log.Logger, cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider) *K8sUserService {
	return &K8sUserService{
		logger:             logger,
		namespaceMapper:    request.GetNamespaceMapper(cfg),
		restConfigProvider: restConfigProvider,
		initClients:        sync.Once{},
	}
}

// initK8sClients lazily initializes the Kubernetes clients on first use.
func (s *K8sUserService) initK8sClients(ctx context.Context, logger log.Logger) {
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

		if c, err := iamv0alpha1.NewUserClientFromGenerator(s.clientGenerator); err != nil {
			logger.Warn("Failed to create user client", "error", err)
		} else {
			s.userClient = c
		}
	})
}

func (s *K8sUserService) GetByUserAuth(ctx context.Context, userAuth *login.UserAuth, orgID int64) (*user.User, error) {
	s.initK8sClients(ctx, s.logger)

	namespace := s.namespaceMapper(orgID)

	u, err := s.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: userAuth.UserUID})
	if err != nil {
		return nil, err
	}

	return iamUserToUser(u, namespace), nil
}

func (s *K8sUserService) GetByEmail(ctx context.Context, email string, orgID int64) (*user.User, error) {
	s.initK8sClients(ctx, s.logger)

	namespace := s.namespaceMapper(orgID)

	users, err := s.userClient.List(ctx, namespace, resource.ListOptions{
		FieldSelectors: []string{
			res.SEARCH_FIELD_PREFIX + builders.USER_EMAIL + "=" + email,
		},
	})
	if err != nil {
		return nil, err
	}

	if len(users.Items) == 0 {
		return nil, user.ErrUserNotFound
	}

	return iamUserToUser(&users.Items[0], namespace), nil
}

func (s *K8sUserService) GetByLogin(ctx context.Context, login string, orgID int64) (*user.User, error) {
	s.initK8sClients(ctx, s.logger)

	namespace := s.namespaceMapper(orgID)

	users, err := s.userClient.List(ctx, namespace, resource.ListOptions{
		FieldSelectors: []string{
			res.SEARCH_FIELD_PREFIX + builders.USER_LOGIN + "=" + login,
		},
	})
	if err != nil {
		return nil, err
	}

	if len(users.Items) == 0 {
		return nil, user.ErrUserNotFound
	}

	return iamUserToUser(&users.Items[0], namespace), nil
}

func (s *K8sUserService) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	s.initK8sClients(ctx, s.logger)

	namespace := s.namespaceMapper(query.OrgID)

	u, err := s.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: query.UserUID})
	if err != nil {
		return nil, err
	}

	var lastSeenAt time.Time
	if u.Status.LastSeenAt > 0 {
		lastSeenAt = time.Unix(u.Status.LastSeenAt, 0)
	}

	orgRole := identity.RoleType(u.Spec.Role)
	if !orgRole.IsValid() {
		orgRole = identity.RoleViewer
	}

	return &user.SignedInUser{
		UserID:         0, // we don't have the userID
		UserUID:        u.Name,
		OrgID:          query.OrgID,
		OrgRole:        orgRole,
		Login:          u.Spec.Login,
		Name:           u.Spec.Title,
		Email:          u.Spec.Email,
		EmailVerified:  u.Spec.EmailVerified,
		IsGrafanaAdmin: u.Spec.GrafanaAdmin,
		IsDisabled:     u.Spec.Disabled,
		LastSeenAt:     lastSeenAt,
		Namespace:      namespace,
		Teams:          nil,
	}, nil
}

func (s *K8sUserService) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	s.initK8sClients(ctx, s.logger)

	namespace := s.namespaceMapper(cmd.OrgID)

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}

	login := cmd.Login
	if login == "" {
		login = cmd.Email
	}

	obj := &iamv0alpha1.User{
		ObjectMeta: metav1.ObjectMeta{
			Name:      uid,
			Namespace: namespace,
		},
		Spec: iamv0alpha1.UserSpec{
			Login:         login,
			Email:         cmd.Email,
			Title:         cmd.Name,
			GrafanaAdmin:  cmd.IsAdmin,
			Disabled:      cmd.IsDisabled,
			EmailVerified: cmd.EmailVerified,
			Provisioned:   cmd.IsProvisioned,
			Role:          cmd.DefaultOrgRole,
		},
	}
	if obj.Spec.Role == "" {
		obj.Spec.Role = "Viewer"
	}

	created, err := s.userClient.Create(ctx, obj, resource.CreateOptions{})
	if err != nil {
		return nil, err
	}

	return iamUserToUser(created, namespace), nil
}

func (s *K8sUserService) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	s.initK8sClients(ctx, s.logger)

	namespace := s.namespaceMapper(*cmd.OrgID)

	u, err := s.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: cmd.UserUID})
	if err != nil {
		return err
	}

	if cmd.Login != "" {
		u.Spec.Login = cmd.Login
	}
	if cmd.Email != "" {
		u.Spec.Email = cmd.Email
	}
	if cmd.Name != "" {
		u.Spec.Title = cmd.Name
	}
	if cmd.IsGrafanaAdmin != nil {
		u.Spec.GrafanaAdmin = *cmd.IsGrafanaAdmin
	}
	if cmd.IsDisabled != nil {
		u.Spec.Disabled = *cmd.IsDisabled
	}
	if cmd.EmailVerified != nil {
		u.Spec.EmailVerified = *cmd.EmailVerified
	}

	_, err = s.userClient.Update(ctx, u, resource.UpdateOptions{ResourceVersion: u.ResourceVersion})
	return err
}

func (s *K8sUserService) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	s.initK8sClients(ctx, s.logger)

	namespace := s.namespaceMapper(cmd.OrgID)

	u, err := s.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: cmd.UserUID})
	if err != nil {
		return err
	}

	_, err = s.userClient.UpdateStatus(ctx, resource.Identifier{Namespace: namespace, Name: cmd.UserUID}, iamv0alpha1.UserStatus{
		LastSeenAt: time.Now().Unix(),
	}, resource.UpdateOptions{ResourceVersion: u.ResourceVersion})
	return err
}

func iamUserToUser(u *iamv0alpha1.User, namespace string) *user.User {
	var lastSeenAt time.Time
	if u.Status.LastSeenAt > 0 {
		lastSeenAt = time.Unix(u.Status.LastSeenAt, 0)
	}

	return &user.User{
		ID:            0, // we don't have the userID
		UID:           u.Name,
		Login:         u.Spec.Login,
		Email:         u.Spec.Email,
		Name:          u.Spec.Title,
		EmailVerified: u.Spec.EmailVerified,
		IsDisabled:    u.Spec.Disabled,
		IsAdmin:       u.Spec.GrafanaAdmin,
		IsProvisioned: u.Spec.Provisioned,
		LastSeenAt:    lastSeenAt,
	}
}
