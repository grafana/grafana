package user

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	claims "github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
)

func TestStoreWrapper_SettingService_AfterGet(t *testing.T) {
	tests := []struct {
		name        string
		settings    []*settingsvc.Setting
		login       string
		requester   string
		expectError bool
		isNotFound  bool
	}{
		{
			name:        "no hidden users setting returns nil",
			settings:    nil,
			login:       "admin",
			requester:   "viewer",
			expectError: false,
		},
		{
			name: "empty hidden_users value returns nil",
			settings: []*settingsvc.Setting{
				{Section: "users", Key: "hidden_users", Value: ""},
			},
			login:       "admin",
			requester:   "viewer",
			expectError: false,
		},
		{
			name: "hidden user returns NotFound for other requester",
			settings: []*settingsvc.Setting{
				{Section: "users", Key: "hidden_users", Value: "admin"},
			},
			login:       "admin",
			requester:   "viewer",
			expectError: true,
			isNotFound:  true,
		},
		{
			name: "hidden user can see themselves",
			settings: []*settingsvc.Setting{
				{Section: "users", Key: "hidden_users", Value: "admin"},
			},
			login:       "admin",
			requester:   "admin",
			expectError: false,
		},
		{
			name: "comma-separated hidden users",
			settings: []*settingsvc.Setting{
				{Section: "users", Key: "hidden_users", Value: "admin, servicebot"},
			},
			login:       "servicebot",
			requester:   "viewer",
			expectError: true,
			isNotFound:  true,
		},
		{
			name: "non-hidden user is allowed",
			settings: []*settingsvc.Setting{
				{Section: "users", Key: "hidden_users", Value: "admin"},
			},
			login:       "viewer",
			requester:   "other",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sw := NewStoreWrapper(nil, &fakeSettingService{settings: tt.settings})
			ctx := withAuthInfo(context.Background(), tt.requester)
			user := &iamv0.User{
				ObjectMeta: metav1.ObjectMeta{Name: tt.login},
				Spec:       iamv0.UserSpec{Login: tt.login},
			}

			err := sw.AfterGet(ctx, user)
			if tt.expectError {
				require.Error(t, err)
				if tt.isNotFound {
					assert.True(t, apierrors.IsNotFound(err))
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestStoreWrapper_SettingService_FilterList(t *testing.T) {
	sw := NewStoreWrapper(nil, &fakeSettingService{
		settings: []*settingsvc.Setting{
			{Section: "users", Key: "hidden_users", Value: "hidden1, hidden2"},
		},
	})
	ctx := withAuthInfo(context.Background(), "hidden1")

	list := &iamv0.UserList{
		Items: []iamv0.User{
			{Spec: iamv0.UserSpec{Login: "visible"}},
			{Spec: iamv0.UserSpec{Login: "hidden1"}}, // requester themselves
			{Spec: iamv0.UserSpec{Login: "hidden2"}},
			{Spec: iamv0.UserSpec{Login: "another"}},
		},
	}

	result, err := sw.FilterList(ctx, list)
	require.NoError(t, err)

	userList := result.(*iamv0.UserList)
	logins := make([]string, len(userList.Items))
	for i, u := range userList.Items {
		logins[i] = u.Spec.Login
	}
	assert.Equal(t, []string{"visible", "hidden1", "another"}, logins)
}

func TestStoreWrapper_SettingService_BeforeCreate(t *testing.T) {
	sw := NewStoreWrapper(nil, &fakeSettingService{
		settings: []*settingsvc.Setting{
			{Section: "users", Key: "hidden_users", Value: "admin"},
		},
	})
	ctx := context.Background()

	t.Run("blocked for hidden login", func(t *testing.T) {
		err := sw.BeforeCreate(ctx, &iamv0.User{
			ObjectMeta: metav1.ObjectMeta{Name: "admin"},
			Spec:       iamv0.UserSpec{Login: "admin"},
		})
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("allowed for non-hidden login", func(t *testing.T) {
		err := sw.BeforeCreate(ctx, &iamv0.User{
			ObjectMeta: metav1.ObjectMeta{Name: "viewer"},
			Spec:       iamv0.UserSpec{Login: "viewer"},
		})
		require.NoError(t, err)
	})
}

func TestStoreWrapper_SettingService_BeforeUpdate(t *testing.T) {
	sw := NewStoreWrapper(nil, &fakeSettingService{
		settings: []*settingsvc.Setting{
			{Section: "users", Key: "hidden_users", Value: "admin"},
		},
	})
	ctx := context.Background()

	t.Run("blocked when old user is hidden", func(t *testing.T) {
		oldObj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "admin"}, Spec: iamv0.UserSpec{Login: "admin"}}
		newObj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "admin"}, Spec: iamv0.UserSpec{Login: "newlogin"}}
		err := sw.BeforeUpdate(ctx, oldObj, newObj)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("blocked when new login is hidden", func(t *testing.T) {
		oldObj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "viewer"}, Spec: iamv0.UserSpec{Login: "viewer"}}
		newObj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "viewer"}, Spec: iamv0.UserSpec{Login: "admin"}}
		err := sw.BeforeUpdate(ctx, oldObj, newObj)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("allowed when neither is hidden", func(t *testing.T) {
		oldObj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "viewer"}, Spec: iamv0.UserSpec{Login: "viewer"}}
		newObj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "viewer"}, Spec: iamv0.UserSpec{Login: "editor"}}
		err := sw.BeforeUpdate(ctx, oldObj, newObj)
		require.NoError(t, err)
	})
}

func TestStoreWrapper_SettingService_BeforeDelete(t *testing.T) {
	sw := NewStoreWrapper(nil, &fakeSettingService{
		settings: []*settingsvc.Setting{
			{Section: "users", Key: "hidden_users", Value: "admin"},
		},
	})
	ctx := context.Background()

	t.Run("blocked for hidden user", func(t *testing.T) {
		err := sw.BeforeDelete(ctx, &iamv0.User{
			ObjectMeta: metav1.ObjectMeta{Name: "admin"},
			Spec:       iamv0.UserSpec{Login: "admin"},
		})
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("allowed for non-hidden user", func(t *testing.T) {
		err := sw.BeforeDelete(ctx, &iamv0.User{
			ObjectMeta: metav1.ObjectMeta{Name: "viewer"},
			Spec:       iamv0.UserSpec{Login: "viewer"},
		})
		require.NoError(t, err)
	})
}

func TestStoreWrapper_NilProviders(t *testing.T) {
	sw := NewStoreWrapper(nil, nil)
	ctx := withAuthInfo(context.Background(), "admin")

	user := &iamv0.User{
		ObjectMeta: metav1.ObjectMeta{Name: "admin"},
		Spec:       iamv0.UserSpec{Login: "admin"},
	}

	errMsg := "neither cfgProvider nor settingService is configured"

	t.Run("AfterGet returns error", func(t *testing.T) {
		err := sw.AfterGet(ctx, user)
		require.ErrorContains(t, err, errMsg)
	})

	t.Run("FilterList returns error", func(t *testing.T) {
		list := &iamv0.UserList{Items: []iamv0.User{*user}}
		_, err := sw.FilterList(ctx, list)
		require.ErrorContains(t, err, errMsg)
	})

	t.Run("BeforeCreate returns error", func(t *testing.T) {
		require.ErrorContains(t, sw.BeforeCreate(ctx, user), errMsg)
	})

	t.Run("BeforeUpdate returns error", func(t *testing.T) {
		require.ErrorContains(t, sw.BeforeUpdate(ctx, user, user), errMsg)
	})

	t.Run("BeforeDelete returns error", func(t *testing.T) {
		require.ErrorContains(t, sw.BeforeDelete(ctx, user), errMsg)
	})
}

func TestStoreWrapper_SettingService_Error(t *testing.T) {
	sw := NewStoreWrapper(nil, &fakeSettingService{
		err: assert.AnError,
	})
	ctx := context.Background()
	user := &iamv0.User{
		ObjectMeta: metav1.ObjectMeta{Name: "admin"},
		Spec:       iamv0.UserSpec{Login: "admin"},
	}

	t.Run("AfterGet propagates error", func(t *testing.T) {
		require.ErrorIs(t, sw.AfterGet(ctx, user), assert.AnError)
	})

	t.Run("FilterList propagates error", func(t *testing.T) {
		_, err := sw.FilterList(ctx, &iamv0.UserList{})
		require.ErrorIs(t, err, assert.AnError)
	})

	t.Run("BeforeCreate propagates error", func(t *testing.T) {
		require.ErrorIs(t, sw.BeforeCreate(ctx, user), assert.AnError)
	})

	t.Run("BeforeUpdate propagates error", func(t *testing.T) {
		require.ErrorIs(t, sw.BeforeUpdate(ctx, user, user), assert.AnError)
	})

	t.Run("BeforeDelete propagates error", func(t *testing.T) {
		require.ErrorIs(t, sw.BeforeDelete(ctx, user), assert.AnError)
	})
}

func TestStoreWrapper_ServiceIdentityBypass(t *testing.T) {
	sw := NewStoreWrapper(nil, &fakeSettingService{
		settings: []*settingsvc.Setting{
			{Section: "users", Key: "hidden_users", Value: "admin"},
		},
	})

	// Create a service identity context — should bypass all hidden user filtering.
	svcCtx, _ := identity.WithServiceIdentity(context.Background(), 1)
	hiddenUser := &iamv0.User{
		ObjectMeta: metav1.ObjectMeta{Name: "admin"},
		Spec:       iamv0.UserSpec{Login: "admin"},
	}

	t.Run("AfterGet allows hidden user", func(t *testing.T) {
		require.NoError(t, sw.AfterGet(svcCtx, hiddenUser))
	})

	t.Run("FilterList returns all users", func(t *testing.T) {
		list := &iamv0.UserList{
			Items: []iamv0.User{
				{Spec: iamv0.UserSpec{Login: "visible"}},
				{Spec: iamv0.UserSpec{Login: "admin"}},
			},
		}
		result, err := sw.FilterList(svcCtx, list)
		require.NoError(t, err)
		assert.Len(t, result.(*iamv0.UserList).Items, 2)
	})

	t.Run("BeforeCreate allows hidden login", func(t *testing.T) {
		require.NoError(t, sw.BeforeCreate(svcCtx, hiddenUser))
	})

	t.Run("BeforeUpdate allows hidden user", func(t *testing.T) {
		newObj := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "admin"}, Spec: iamv0.UserSpec{Login: "newlogin"}}
		require.NoError(t, sw.BeforeUpdate(svcCtx, hiddenUser, newObj))
	})

	t.Run("BeforeDelete allows hidden user", func(t *testing.T) {
		require.NoError(t, sw.BeforeDelete(svcCtx, hiddenUser))
	})
}

// withAuthInfo adds a StaticRequester to the context so claims.AuthInfoFrom succeeds.
func withAuthInfo(ctx context.Context, login string) context.Context {
	return claims.WithAuthInfo(ctx, &identity.StaticRequester{
		Type:  claims.TypeUser,
		Login: login,
	})
}

// fakeSettingService implements settingsvc.Service for testing.
type fakeSettingService struct {
	settings []*settingsvc.Setting
	err      error
}

func (f *fakeSettingService) ListAsIni(_ context.Context, _ metav1.LabelSelector) (*ini.File, error) {
	return nil, f.err
}

func (f *fakeSettingService) List(_ context.Context, _ metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	return f.settings, f.err
}

func (f *fakeSettingService) Describe(chan<- *prometheus.Desc) {}
func (f *fakeSettingService) Collect(chan<- prometheus.Metric) {}
