package sync

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestK8sUserService_GetByUserAuth(t *testing.T) {
	ctx := context.Background()
	ns := "org-1"
	iamUser := makeIAMUser("uid-1", ns, "jdoe", "jdoe@example.com", "Jane Doe", "Editor", 1000, false, false, true, false)

	t.Run("success", func(t *testing.T) {
		mock := &mockK8sUserClient{getUser: iamUser}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByUserAuth(ctx, &login.UserAuth{UserUID: "uid-1"}, 1)
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "uid-1", got.UID)
		assert.Equal(t, "jdoe", got.Login)
		assert.Equal(t, "jdoe@example.com", got.Email)
		assert.Equal(t, "Jane Doe", got.Name)
		assert.Equal(t, int64(1000), got.LastSeenAt.Unix())
		assert.Equal(t, 1, mock.getCalls)
	})

	t.Run("client error", func(t *testing.T) {
		wantErr := errors.New("get failed")
		mock := &mockK8sUserClient{getErr: wantErr}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByUserAuth(ctx, &login.UserAuth{UserUID: "uid-1"}, 1)
		assert.ErrorIs(t, err, wantErr)
		assert.Nil(t, got)
	})
}

func TestK8sUserService_GetByEmail(t *testing.T) {
	ctx := context.Background()
	ns := "org-1"
	iamUser := makeIAMUser("uid-1", ns, "jdoe", "jdoe@example.com", "Jane Doe", "Viewer", 0, false, false, false, false)

	t.Run("success", func(t *testing.T) {
		mock := &mockK8sUserClient{listUsers: &iamv0alpha1.UserList{Items: []iamv0alpha1.User{*iamUser}}}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByEmail(ctx, "jdoe@example.com", 1)
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "uid-1", got.UID)
		assert.Equal(t, "jdoe@example.com", got.Email)
		assert.Equal(t, 1, mock.listCalls)
	})

	t.Run("not found", func(t *testing.T) {
		mock := &mockK8sUserClient{listUsers: &iamv0alpha1.UserList{Items: nil}}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByEmail(ctx, "nobody@example.com", 1)
		assert.ErrorIs(t, err, user.ErrUserNotFound)
		assert.Nil(t, got)
	})

	t.Run("list error", func(t *testing.T) {
		wantErr := errors.New("list failed")
		mock := &mockK8sUserClient{listErr: wantErr}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByEmail(ctx, "jdoe@example.com", 1)
		assert.ErrorIs(t, err, wantErr)
		assert.Nil(t, got)
	})
}

func TestK8sUserService_GetByLogin(t *testing.T) {
	ctx := context.Background()
	ns := "org-1"
	iamUser := makeIAMUser("uid-1", ns, "jdoe", "jdoe@example.com", "Jane Doe", "Admin", 0, true, false, true, true)

	t.Run("success", func(t *testing.T) {
		mock := &mockK8sUserClient{listUsers: &iamv0alpha1.UserList{Items: []iamv0alpha1.User{*iamUser}}}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByLogin(ctx, "jdoe", 1)
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "jdoe", got.Login)
		assert.True(t, got.IsAdmin)
		assert.Equal(t, 1, mock.listCalls)
	})

	t.Run("not found", func(t *testing.T) {
		mock := &mockK8sUserClient{listUsers: &iamv0alpha1.UserList{Items: nil}}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByLogin(ctx, "nobody", 1)
		assert.ErrorIs(t, err, user.ErrUserNotFound)
		assert.Nil(t, got)
	})

	t.Run("list error", func(t *testing.T) {
		wantErr := errors.New("list failed")
		mock := &mockK8sUserClient{listErr: wantErr}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetByLogin(ctx, "jdoe", 1)
		assert.ErrorIs(t, err, wantErr)
		assert.Nil(t, got)
	})
}

func TestK8sUserService_GetSignedInUser(t *testing.T) {
	ctx := context.Background()
	ns := "org-2"
	lastSeen := time.Now().Add(-time.Hour).Unix()
	iamUser := makeIAMUser("uid-2", ns, "admin", "admin@example.com", "Admin User", "Admin", lastSeen, true, false, true, false)

	t.Run("success", func(t *testing.T) {
		mock := &mockK8sUserClient{getUser: iamUser}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserUID: "uid-2", OrgID: 2})
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "uid-2", got.UserUID)
		assert.Equal(t, int64(2), got.OrgID)
		assert.Equal(t, "admin", got.Login)
		assert.Equal(t, "admin@example.com", got.Email)
		assert.True(t, got.IsGrafanaAdmin)
		assert.Equal(t, ns, got.Namespace)
		assert.Equal(t, lastSeen, got.LastSeenAt.Unix())
	})

	t.Run("invalid role defaults to Viewer", func(t *testing.T) {
		u := makeIAMUser("uid-3", ns, "u", "u@e.com", "U", "InvalidRole", 0, false, false, false, false)
		mock := &mockK8sUserClient{getUser: u}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserUID: "uid-3", OrgID: 2})
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "Viewer", string(got.OrgRole))
	})

	t.Run("client error", func(t *testing.T) {
		wantErr := errors.New("get failed")
		mock := &mockK8sUserClient{getErr: wantErr}
		svc := initTestService(t, ns, mock)

		got, err := svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserUID: "uid-2", OrgID: 2})
		assert.ErrorIs(t, err, wantErr)
		assert.Nil(t, got)
	})
}

func TestK8sUserService_Create(t *testing.T) {
	ctx := context.Background()
	ns := "org-1"

	t.Run("success with UID", func(t *testing.T) {
		created := makeIAMUser("custom-uid", ns, "newuser", "new@example.com", "New User", "Editor", 0, false, false, false, true)
		mock := &mockK8sUserClient{createUser: created}
		svc := initTestService(t, ns, mock)

		cmd := &user.CreateUserCommand{
			OrgID:          1,
			UID:            "custom-uid",
			Login:          "newuser",
			Email:          "new@example.com",
			Name:           "New User",
			IsAdmin:        false,
			IsDisabled:     false,
			EmailVerified:  false,
			IsProvisioned:  true,
			DefaultOrgRole: "Editor",
		}
		got, err := svc.Create(ctx, cmd)
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.Equal(t, "custom-uid", got.UID)
		assert.Equal(t, "newuser", got.Login)
		assert.Equal(t, "new@example.com", got.Email)
		assert.True(t, got.IsProvisioned)
		assert.Equal(t, 1, mock.createCalls)
	})

	t.Run("success without UID generates short UID", func(t *testing.T) {
		svc := initTestService(t, ns, &mockK8sUserClient{})

		cmd := &user.CreateUserCommand{
			OrgID: 1,
			Email: "nologin@example.com",
			Name:  "No Login",
		}
		got, err := svc.Create(ctx, cmd)
		require.NoError(t, err)
		require.NotNil(t, got)
		assert.NotEmpty(t, got.UID)
		assert.Equal(t, "nologin@example.com", got.Login) // login falls back to email
		assert.Equal(t, "nologin@example.com", got.Email)
	})

	t.Run("create error", func(t *testing.T) {
		wantErr := errors.New("create failed")
		mock := &mockK8sUserClient{createErr: wantErr}
		svc := initTestService(t, ns, mock)

		got, err := svc.Create(ctx, &user.CreateUserCommand{OrgID: 1, UID: "x", Login: "x", Email: "x@x.com", Name: "X"})
		assert.ErrorIs(t, err, wantErr)
		assert.Nil(t, got)
	})
}

func TestK8sUserService_Update(t *testing.T) {
	ctx := context.Background()
	ns := "org-1"
	existing := makeIAMUser("uid-1", ns, "oldlogin", "old@example.com", "Old Name", "Viewer", 0, false, false, false, false)

	t.Run("success", func(t *testing.T) {
		mock := &mockK8sUserClient{getUser: existing}
		svc := initTestService(t, ns, mock)

		orgID := int64(1)
		err := svc.Update(ctx, &user.UpdateUserCommand{
			UserUID:        "uid-1",
			OrgID:          &orgID,
			Login:          "newlogin",
			Email:          "new@example.com",
			Name:           "New Name",
			IsGrafanaAdmin: ptrBool(true),
			IsDisabled:     ptrBool(false),
			EmailVerified:  ptrBool(true),
		})
		require.NoError(t, err)
		assert.Equal(t, 1, mock.getCalls)
		assert.Equal(t, 1, mock.updateCalls)
		assert.Equal(t, "newlogin", existing.Spec.Login)
		assert.Equal(t, "new@example.com", existing.Spec.Email)
		assert.Equal(t, "New Name", existing.Spec.Title)
	})

	t.Run("get error", func(t *testing.T) {
		wantErr := errors.New("get failed")
		mock := &mockK8sUserClient{getErr: wantErr}
		svc := initTestService(t, ns, mock)

		orgID := int64(1)
		err := svc.Update(ctx, &user.UpdateUserCommand{UserUID: "uid-1", OrgID: &orgID})
		assert.ErrorIs(t, err, wantErr)
		assert.Equal(t, 0, mock.updateCalls)
	})

	t.Run("update error", func(t *testing.T) {
		wantErr := errors.New("update failed")
		mock := &mockK8sUserClient{getUser: existing, updateErr: wantErr}
		svc := initTestService(t, ns, mock)

		orgID := int64(1)
		err := svc.Update(ctx, &user.UpdateUserCommand{UserUID: "uid-1", OrgID: &orgID, Login: "x"})
		assert.ErrorIs(t, err, wantErr)
	})
}

func TestK8sUserService_UpdateLastSeenAt(t *testing.T) {
	ctx := context.Background()
	ns := "org-1"
	existing := makeIAMUser("uid-1", ns, "u", "u@e.com", "U", "Viewer", 0, false, false, false, false)
	existing.ResourceVersion = "123"

	t.Run("success", func(t *testing.T) {
		mock := &mockK8sUserClient{getUser: existing}
		svc := initTestService(t, ns, mock)

		err := svc.UpdateLastSeenAt(ctx, &user.UpdateUserLastSeenAtCommand{UserUID: "uid-1", OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, 1, mock.getCalls)
		assert.Equal(t, 1, mock.updateStatusCalls)
	})

	t.Run("get error", func(t *testing.T) {
		wantErr := errors.New("get failed")
		mock := &mockK8sUserClient{getErr: wantErr}
		svc := initTestService(t, ns, mock)

		err := svc.UpdateLastSeenAt(ctx, &user.UpdateUserLastSeenAtCommand{UserUID: "uid-1", OrgID: 1})
		assert.ErrorIs(t, err, wantErr)
		assert.Equal(t, 0, mock.updateStatusCalls)
	})

	t.Run("update status error", func(t *testing.T) {
		wantErr := errors.New("update status failed")
		mock := &mockK8sUserClient{getUser: existing, updateStatusErr: wantErr}
		svc := initTestService(t, ns, mock)

		err := svc.UpdateLastSeenAt(ctx, &user.UpdateUserLastSeenAtCommand{UserUID: "uid-1", OrgID: 1})
		assert.ErrorIs(t, err, wantErr)
	})
}

func initTestService(t *testing.T, ns string, mock k8sUserClient) *K8sUserService {
	svc := &K8sUserService{
		logger:          log.NewNopLogger(),
		namespaceMapper: func(orgID int64) string { return ns },
		userClient:      mock,
	}

	// mark init as done so we don't overwrite userClient
	svc.initClients.Do(func() {})

	return svc
}

type mockK8sUserClient struct {
	getUser           *iamv0alpha1.User
	getErr            error
	listUsers         *iamv0alpha1.UserList
	listErr           error
	createUser        *iamv0alpha1.User
	createErr         error
	updateErr         error
	updateStatusErr   error
	getCalls          int
	listCalls         int
	createCalls       int
	updateCalls       int
	updateStatusCalls int
}

func (m *mockK8sUserClient) Get(ctx context.Context, identifier resource.Identifier) (*iamv0alpha1.User, error) {
	m.getCalls++
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.getUser, nil
}

func (m *mockK8sUserClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*iamv0alpha1.UserList, error) {
	m.listCalls++
	if m.listErr != nil {
		return nil, m.listErr
	}
	return m.listUsers, nil
}

func (m *mockK8sUserClient) Create(ctx context.Context, obj *iamv0alpha1.User, opts resource.CreateOptions) (*iamv0alpha1.User, error) {
	m.createCalls++
	if m.createErr != nil {
		return nil, m.createErr
	}
	if m.createUser != nil {
		return m.createUser, nil
	}
	return obj, nil
}

func (m *mockK8sUserClient) Update(ctx context.Context, obj *iamv0alpha1.User, opts resource.UpdateOptions) (*iamv0alpha1.User, error) {
	m.updateCalls++
	return obj, m.updateErr
}

func (m *mockK8sUserClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus iamv0alpha1.UserStatus, opts resource.UpdateOptions) (*iamv0alpha1.User, error) {
	m.updateStatusCalls++
	if m.updateStatusErr != nil {
		return nil, m.updateStatusErr
	}
	return &iamv0alpha1.User{Status: newStatus}, nil
}

func makeIAMUser(name, namespace, login, email, title, role string, lastSeenAt int64, admin, disabled, emailVerified, provisioned bool) *iamv0alpha1.User {
	u := &iamv0alpha1.User{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: iamv0alpha1.UserSpec{
			Login:         login,
			Email:         email,
			Title:         title,
			Role:          role,
			GrafanaAdmin:  admin,
			Disabled:      disabled,
			EmailVerified: emailVerified,
			Provisioned:   provisioned,
		},
		Status: iamv0alpha1.UserStatus{LastSeenAt: lastSeenAt},
	}
	return u
}
