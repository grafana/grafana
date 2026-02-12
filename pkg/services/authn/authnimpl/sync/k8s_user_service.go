package sync

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
)

type K8sUserService struct {
	userClient *iamv0.UserClient
}

func NewK8sUserService(userClient *iamv0.UserClient) *K8sUserService {
	return &K8sUserService{userClient: userClient}
}

func (a *K8sUserService) GetByID(ctx context.Context, id int64) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (a *K8sUserService) GetByEmail(ctx context.Context, namespace string, email string) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (a *K8sUserService) GetByLogin(ctx context.Context, namespace string, login string) (*user.User, error) {
	return nil, errors.New("not implemented")
}

func (a *K8sUserService) GetSignedInUser(ctx context.Context, namespace string, userUID string, orgID int64) (*user.SignedInUser, error) {
	ctx = request.WithNamespace(ctx, namespace)
	id := resource.Identifier{Namespace: namespace, Name: userUID}

	u, err := a.userClient.Get(ctx, id)
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
		OrgID:          orgID,
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

func (a *K8sUserService) Create(ctx context.Context, namespace string, cmd *user.CreateUserCommand) (*user.User, error) {
	ctx = request.WithNamespace(ctx, namespace)

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}

	login := cmd.Login
	if login == "" {
		login = cmd.Email
	}

	obj := &iamv0.User{
		ObjectMeta: metav1.ObjectMeta{
			Name:      uid,
			Namespace: namespace,
		},
		Spec: iamv0.UserSpec{
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

	created, err := a.userClient.Create(ctx, obj, resource.CreateOptions{})
	if err != nil {
		return nil, err
	}

	return iamUserToUser(created, namespace), nil
}

func (a *K8sUserService) Update(ctx context.Context, namespace string, userUID string, cmd *user.UpdateUserCommand) error {
	ctx = request.WithNamespace(ctx, namespace)
	id := resource.Identifier{Namespace: namespace, Name: userUID}

	u, err := a.userClient.Get(ctx, id)
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

	_, err = a.userClient.Update(ctx, u, resource.UpdateOptions{ResourceVersion: u.ResourceVersion})
	return err
}

func (a *K8sUserService) UpdateLastSeenAt(ctx context.Context, namespace string, userUID string, _ int64) error {
	ctx = request.WithNamespace(ctx, namespace)
	id := resource.Identifier{Namespace: namespace, Name: userUID}

	u, err := a.userClient.Get(ctx, id)
	if err != nil {
		return err
	}

	_, err = a.userClient.UpdateStatus(ctx, id, iamv0.UserStatus{
		LastSeenAt: time.Now().Unix(),
	}, resource.UpdateOptions{ResourceVersion: u.ResourceVersion})
	return err
}

func iamUserToUser(u *iamv0.User, namespace string) *user.User {
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
