package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type K8sUserService struct {
	userClient *iamv0.UserClient
	k8sClient  client.K8sHandler
}

var _ UserProxy = (*K8sUserService)(nil)

func NewK8sUserService(userClient *iamv0.UserClient) *K8sUserService {
	return &K8sUserService{userClient: userClient}
}

func (a *K8sUserService) GetByUserAuth(ctx context.Context, userAuth *login.UserAuth, orgID int64) (*user.User, error) {
	namespace := a.k8sClient.GetNamespace(orgID)

	u, err := a.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: userAuth.UserUID})
	if err != nil {
		return nil, err
	}

	return iamUserToUser(u, namespace), nil
}

func (a *K8sUserService) GetByEmail(ctx context.Context, email string, orgID int64) (*user.User, error) {
	namespace := a.k8sClient.GetNamespace(orgID)

	resp, err := a.k8sClient.Search(ctx, orgID, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{
					Key:      res.SEARCH_FIELD_PREFIX + builders.USER_EMAIL,
					Operator: "=",
					Values:   []string{email},
				},
			},
		},
		Fields: []string{res.SEARCH_FIELD_TITLE, builders.USER_EMAIL, builders.USER_LOGIN},
		Limit:  1,
	})
	if err != nil {
		return nil, err
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("user search: %s: %s", resp.Error.Message, resp.Error.Details)
	}

	rows := resp.GetResults().GetRows()
	if len(rows) == 0 {
		return nil, user.ErrUserNotFound
	}

	userUID := rows[0].GetKey().GetName()
	if userUID == "" {
		return nil, user.ErrUserNotFound
	}

	u, err := a.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: userUID})
	if err != nil {
		return nil, err
	}

	return iamUserToUser(u, namespace), nil
}

func (a *K8sUserService) GetByLogin(ctx context.Context, login string, orgID int64) (*user.User, error) {
	namespace := a.k8sClient.GetNamespace(orgID)

	resp, err := a.k8sClient.Search(ctx, orgID, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{
					Key:      res.SEARCH_FIELD_PREFIX + builders.USER_LOGIN,
					Operator: "=",
					Values:   []string{login},
				},
			},
		},
	})
	if err != nil {
		return nil, err
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("user search: %s: %s", resp.Error.Message, resp.Error.Details)
	}

	rows := resp.GetResults().GetRows()
	if len(rows) == 0 {
		return nil, user.ErrUserNotFound
	}

	userUID := rows[0].GetKey().GetName()
	if userUID == "" {
		return nil, user.ErrUserNotFound
	}

	u, err := a.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: userUID})
	if err != nil {
		return nil, err
	}

	return iamUserToUser(u, namespace), nil
}

func (a *K8sUserService) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	namespace := a.k8sClient.GetNamespace(query.OrgID)

	u, err := a.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: query.UserUID})
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

func (a *K8sUserService) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	namespace := a.k8sClient.GetNamespace(cmd.OrgID)

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

func (a *K8sUserService) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	namespace := a.k8sClient.GetNamespace(*cmd.OrgID)

	u, err := a.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: cmd.UserUID})
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

func (a *K8sUserService) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	namespace := a.k8sClient.GetNamespace(cmd.OrgID)

	u, err := a.userClient.Get(ctx, resource.Identifier{Namespace: namespace, Name: cmd.UserUID})
	if err != nil {
		return err
	}

	_, err = a.userClient.UpdateStatus(ctx, resource.Identifier{Namespace: namespace, Name: cmd.UserUID}, iamv0.UserStatus{
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
