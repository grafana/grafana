package userk8s

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUserK8sService_Create(t *testing.T) {
	tests := []struct {
		name           string
		cmd            *user.CreateUserCommand
		cfg            *setting.Cfg
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectUser     *user.User
	}{
		{
			name:           "successfully creates a user",
			requesterOrgID: 1,
			cmd: &user.CreateUserCommand{
				Login: "jdoe",
				Email: "jdoe@example.com",
				Name:  "John Doe",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
				resp := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:              "some-uid",
						Namespace:         "org-1",
						CreationTimestamp: metav1.NewTime(now),
					},
					Spec: v0alpha1.UserSpec{
						Login: "jdoe",
						Email: "jdoe@example.com",
						Title: "John Doe",
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:     "some-uid",
				OrgID:   1,
				Login:   "jdoe",
				Email:   "jdoe@example.com",
				Name:    "John Doe",
				Created: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "maps admin, disabled, emailVerified, provisioned and role fields",
			requesterOrgID: 2,
			cmd: &user.CreateUserCommand{
				Login:          "admin-user",
				Email:          "admin@example.com",
				IsAdmin:        true,
				IsDisabled:     false,
				EmailVerified:  true,
				IsProvisioned:  true,
				DefaultOrgRole: "Admin",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				resp := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "admin-uid",
						Namespace: "org-2",
					},
					Spec: v0alpha1.UserSpec{
						Login:         "admin-user",
						Email:         "admin@example.com",
						GrafanaAdmin:  true,
						EmailVerified: true,
						Provisioned:   true,
						Role:          "Admin",
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:           "admin-uid",
				OrgID:         2,
				Login:         "admin-user",
				Email:         "admin@example.com",
				IsAdmin:       true,
				EmailVerified: true,
				IsProvisioned: true,
			},
		},
		{
			name:           "uses provided UID when set",
			requesterOrgID: 1,
			cmd: &user.CreateUserCommand{
				UID:   "explicit-uid",
				Login: "user2",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				meta := body["metadata"].(map[string]any)
				assert.Equal(t, "explicit-uid", meta["name"])

				resp := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "explicit-uid",
						Namespace: "org-1",
					},
					Spec: v0alpha1.UserSpec{Login: "user2"},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:   "explicit-uid",
				OrgID: 1,
				Login: "user2",
			},
		},
		{
			name:           "email is empty then email gets the login value",
			requesterOrgID: 1,
			cmd: &user.CreateUserCommand{
				Login: "jdoe",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				spec := body["spec"].(map[string]any)
				assert.Equal(t, "jdoe", spec["email"])

				resp := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "some-uid",
						Namespace: "org-1",
					},
					Spec: v0alpha1.UserSpec{
						Login: "jdoe",
						Email: "jdoe",
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:   "some-uid",
				OrgID: 1,
				Login: "jdoe",
				Email: "jdoe",
			},
		},
		{
			name:           "role is empty then it is set to autoAssignOrgRole",
			requesterOrgID: 1,
			cmd: &user.CreateUserCommand{
				Login: "jdoe",
				Email: "jdoe@example.com",
			},
			cfg: &setting.Cfg{AutoAssignOrgRole: "Viewer"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				spec := body["spec"].(map[string]any)
				assert.Equal(t, "Viewer", spec["role"])

				resp := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "some-uid",
						Namespace: "org-1",
					},
					Spec: v0alpha1.UserSpec{
						Login: "jdoe",
						Email: "jdoe@example.com",
						Role:  "Viewer",
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:   "some-uid",
				OrgID: 1,
				Login: "jdoe",
				Email: "jdoe@example.com",
			},
		},
		{
			name: "fails if there is no orgId in the context",
			cmd: &user.CreateUserCommand{
				Login: "jdoe",
				Email: "jdoe@example.com",
			},
			expectErr: true,
		},
		{
			name: "propagates error from k8s client",
			cmd: &user.CreateUserCommand{
				Login: "failing-user",
				OrgID: 1,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Message:  "k8s error",
					Code:     http.StatusInternalServerError,
				})
			},
			expectErr: true,
		},
		{
			name:        "returns error when config provider not initialized",
			cmd:         &user.CreateUserCommand{Login: "any-user", OrgID: 1},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &user.CreateUserCommand{Login: "any-user", OrgID: 1},
			noReqContext: true,
			expectErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, ctx := setupServiceAndCtx(t, svcTestSetup{
				nilProvider:    tt.nilProvider,
				noReqContext:   tt.noReqContext,
				requesterOrgID: tt.requesterOrgID,
				cfg:            tt.cfg,
				serverResponse: tt.serverResponse,
			})

			result, err := svc.Create(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectUser.UID, result.UID)
			assert.Equal(t, tt.expectUser.OrgID, result.OrgID)
			assert.Equal(t, tt.expectUser.Login, result.Login)
			assert.Equal(t, tt.expectUser.Email, result.Email)
			assert.Equal(t, tt.expectUser.Name, result.Name)
			assert.Equal(t, tt.expectUser.IsAdmin, result.IsAdmin)
			assert.Equal(t, tt.expectUser.IsDisabled, result.IsDisabled)
			assert.Equal(t, tt.expectUser.EmailVerified, result.EmailVerified)
			assert.Equal(t, tt.expectUser.IsProvisioned, result.IsProvisioned)
			assert.Equal(t, tt.expectUser.Created.UTC(), result.Created.UTC())
		})
	}
}

func TestUserK8sService_GetByEmail(t *testing.T) {
	tests := []struct {
		name           string
		cmd            *user.GetUserByEmailQuery
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		noRequester    bool
		expectErr      bool
		expectUser     *user.User
	}{
		{
			name:           "successfully retrieves a user by email",
			requesterOrgID: 1,
			cmd:            &user.GetUserByEmailQuery{Email: "jdoe@example.com"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.email%3Djdoe%40example.com")
				now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
				resp := v0alpha1.UserList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					Items: []v0alpha1.User{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: v0alpha1.GroupVersion.Identifier(),
								Kind:       "User",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name:              "some-uid",
								Namespace:         "org-1",
								CreationTimestamp: metav1.NewTime(now),
							},
							Spec: v0alpha1.UserSpec{
								Login: "jdoe",
								Email: "jdoe@example.com",
								Title: "John Doe",
							},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:     "some-uid",
				OrgID:   1,
				Login:   "jdoe",
				Email:   "jdoe@example.com",
				Name:    "John Doe",
				Created: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "lowercases email before querying",
			requesterOrgID: 1,
			cmd:            &user.GetUserByEmailQuery{Email: "JDOE@EXAMPLE.COM"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.email%3Djdoe%40example.com")
				resp := v0alpha1.UserList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					Items: []v0alpha1.User{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: v0alpha1.GroupVersion.Identifier(),
								Kind:       "User",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name:      "some-uid",
								Namespace: "org-1",
							},
							Spec: v0alpha1.UserSpec{
								Login: "jdoe",
								Email: "jdoe@example.com",
							},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:   "some-uid",
				OrgID: 1,
				Login: "jdoe",
				Email: "jdoe@example.com",
			},
		},
		{
			name:           "maps all user fields correctly",
			requesterOrgID: 2,
			cmd:            &user.GetUserByEmailQuery{Email: "admin@example.com"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				resp := v0alpha1.UserList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					Items: []v0alpha1.User{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: v0alpha1.GroupVersion.Identifier(),
								Kind:       "User",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name:      "admin-uid",
								Namespace: "org-2",
							},
							Spec: v0alpha1.UserSpec{
								Login:         "admin",
								Email:         "admin@example.com",
								GrafanaAdmin:  true,
								Disabled:      true,
								EmailVerified: true,
								Provisioned:   true,
							},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:           "admin-uid",
				OrgID:         2,
				Login:         "admin",
				Email:         "admin@example.com",
				IsAdmin:       true,
				IsDisabled:    true,
				EmailVerified: true,
				IsProvisioned: true,
			},
		},
		{
			name:           "returns ErrUserNotFound when list is empty",
			requesterOrgID: 1,
			cmd:            &user.GetUserByEmailQuery{Email: "notfound@example.com"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				resp := v0alpha1.UserList{}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client",
			requesterOrgID: 1,
			cmd:            &user.GetUserByEmailQuery{Email: "jdoe@example.com"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Message:  "k8s error",
					Code:     http.StatusInternalServerError,
				})
			},
			expectErr: true,
		},
		{
			name:        "returns error when config provider not initialized",
			cmd:         &user.GetUserByEmailQuery{Email: "jdoe@example.com"},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &user.GetUserByEmailQuery{Email: "jdoe@example.com"},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when no requester in context",
			cmd:         &user.GetUserByEmailQuery{Email: "jdoe@example.com"},
			noRequester: true,
			expectErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, ctx := setupServiceAndCtx(t, svcTestSetup{
				nilProvider:    tt.nilProvider,
				noReqContext:   tt.noReqContext,
				noRequester:    tt.noRequester,
				requesterOrgID: tt.requesterOrgID,
				serverResponse: tt.serverResponse,
			})

			result, err := svc.GetByEmail(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectUser.UID, result.UID)
			assert.Equal(t, tt.expectUser.OrgID, result.OrgID)
			assert.Equal(t, tt.expectUser.Login, result.Login)
			assert.Equal(t, tt.expectUser.Email, result.Email)
			assert.Equal(t, tt.expectUser.Name, result.Name)
			assert.Equal(t, tt.expectUser.IsAdmin, result.IsAdmin)
			assert.Equal(t, tt.expectUser.IsDisabled, result.IsDisabled)
			assert.Equal(t, tt.expectUser.EmailVerified, result.EmailVerified)
			assert.Equal(t, tt.expectUser.IsProvisioned, result.IsProvisioned)
			assert.Equal(t, tt.expectUser.Created.UTC(), result.Created.UTC())
		})
	}
}

func TestUserK8sService_GetByLogin(t *testing.T) {
	userList := func(users ...v0alpha1.User) v0alpha1.UserList {
		return v0alpha1.UserList{
			TypeMeta: metav1.TypeMeta{
				APIVersion: v0alpha1.GroupVersion.Identifier(),
				Kind:       "User",
			},
			Items: users,
		}
	}
	makeUser := func(uid, namespace, login, email string) v0alpha1.User {
		return v0alpha1.User{
			TypeMeta: metav1.TypeMeta{
				APIVersion: v0alpha1.GroupVersion.Identifier(),
				Kind:       "User",
			},
			ObjectMeta: metav1.ObjectMeta{Name: uid, Namespace: namespace},
			Spec:       v0alpha1.UserSpec{Login: login, Email: email},
		}
	}

	tests := []struct {
		name           string
		cmd            *user.GetUserByLoginQuery
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		noRequester    bool
		expectErr      bool
		expectUser     *user.User
	}{
		{
			name:           "finds user by login",
			requesterOrgID: 1,
			cmd:            &user.GetUserByLoginQuery{LoginOrEmail: "jdoe"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.login%3Djdoe")
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(userList(makeUser("some-uid", "org-1", "jdoe", "jdoe@example.com")))
			},
			expectUser: &user.User{UID: "some-uid", OrgID: 1, Login: "jdoe", Email: "jdoe@example.com"},
		},
		{
			name:           "lowercases login before querying",
			requesterOrgID: 1,
			cmd:            &user.GetUserByLoginQuery{LoginOrEmail: "JDOE"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.login%3Djdoe")
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(userList(makeUser("some-uid", "org-1", "jdoe", "jdoe@example.com")))
			},
			expectUser: &user.User{UID: "some-uid", OrgID: 1, Login: "jdoe", Email: "jdoe@example.com"},
		},
		{
			name:           "finds user by email when LoginOrEmail contains @",
			requesterOrgID: 1,
			cmd:            &user.GetUserByLoginQuery{LoginOrEmail: "jdoe@example.com"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.email%3Djdoe%40example.com")
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(userList(makeUser("some-uid", "org-1", "jdoe", "jdoe@example.com")))
			},
			expectUser: &user.User{UID: "some-uid", OrgID: 1, Login: "jdoe", Email: "jdoe@example.com"},
		},
		{
			name:           "falls back to login when email lookup returns no results",
			requesterOrgID: 1,
			cmd:            &user.GetUserByLoginQuery{LoginOrEmail: "jdoe@example.com"},
			serverResponse: func() func(w http.ResponseWriter, r *http.Request) {
				callCount := 0
				return func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					callCount++
					if callCount == 1 {
						// First call: email lookup returns empty
						assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.email%3Djdoe%40example.com")
						_ = json.NewEncoder(w).Encode(userList())
					} else {
						// Second call: login lookup returns the user
						assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.login%3Djdoe%40example.com")
						_ = json.NewEncoder(w).Encode(userList(makeUser("some-uid", "org-1", "jdoe@example.com", "")))
					}
				}
			}(),
			expectUser: &user.User{UID: "some-uid", OrgID: 1, Login: "jdoe@example.com"},
		},
		{
			name:           "returns ErrUserNotFound when neither email nor login match",
			requesterOrgID: 1,
			cmd:            &user.GetUserByLoginQuery{LoginOrEmail: "notfound"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(userList())
			},
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client on login query",
			requesterOrgID: 1,
			cmd:            &user.GetUserByLoginQuery{LoginOrEmail: "jdoe"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Code:     http.StatusInternalServerError,
				})
			},
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client on email fallback to login query",
			requesterOrgID: 1,
			cmd:            &user.GetUserByLoginQuery{LoginOrEmail: "jdoe@example.com"},
			serverResponse: func() func(w http.ResponseWriter, r *http.Request) {
				callCount := 0
				return func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					callCount++
					if callCount == 1 {
						// First call: email lookup returns empty, triggering login fallback
						_ = json.NewEncoder(w).Encode(userList())
					} else {
						// Second call: login lookup returns error
						w.WriteHeader(http.StatusInternalServerError)
						_ = json.NewEncoder(w).Encode(metav1.Status{
							TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
							Status:   metav1.StatusFailure,
							Code:     http.StatusInternalServerError,
						})
					}
				}
			}(),
			expectErr: true,
		},
		{
			name:        "returns error when config provider not initialized",
			cmd:         &user.GetUserByLoginQuery{LoginOrEmail: "jdoe"},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &user.GetUserByLoginQuery{LoginOrEmail: "jdoe"},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when no requester in context",
			cmd:         &user.GetUserByLoginQuery{LoginOrEmail: "jdoe"},
			noRequester: true,
			expectErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, ctx := setupServiceAndCtx(t, svcTestSetup{
				nilProvider:    tt.nilProvider,
				noReqContext:   tt.noReqContext,
				noRequester:    tt.noRequester,
				requesterOrgID: tt.requesterOrgID,
				serverResponse: tt.serverResponse,
			})

			result, err := svc.GetByLogin(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectUser.UID, result.UID)
			assert.Equal(t, tt.expectUser.OrgID, result.OrgID)
			assert.Equal(t, tt.expectUser.Login, result.Login)
			assert.Equal(t, tt.expectUser.Email, result.Email)
		})
	}
}

type mockDirectRestConfigProvider struct {
	restConfig *rest.Config
}

func (m *mockDirectRestConfigProvider) GetDirectRestConfig(_ *contextmodel.ReqContext) *rest.Config {
	return m.restConfig
}

func (m *mockDirectRestConfigProvider) DirectlyServeHTTP(_ http.ResponseWriter, _ *http.Request) {}

func (m *mockDirectRestConfigProvider) IsReady() bool {
	return true
}

func contextWithReqContext() context.Context {
	reqCtx := &contextmodel.ReqContext{}
	return context.WithValue(context.Background(), ctxkey.Key{}, reqCtx)
}

type svcTestSetup struct {
	nilProvider    bool
	noReqContext   bool
	noRequester    bool
	requesterOrgID int64
	cfg            *setting.Cfg
	serverResponse func(http.ResponseWriter, *http.Request)
}

func setupServiceAndCtx(t *testing.T, s svcTestSetup) (*UserK8sService, context.Context) {
	t.Helper()
	tracer := tracing.InitializeTracerForTest()

	var svc *UserK8sService
	if s.nilProvider {
		svc = NewUserK8sService(log.NewNopLogger(), s.cfg, nil, tracer)
	} else {
		ts := httptest.NewServer(http.HandlerFunc(s.serverResponse))
		t.Cleanup(ts.Close)
		svc = NewUserK8sService(log.NewNopLogger(), s.cfg, &mockDirectRestConfigProvider{
			restConfig: &rest.Config{Host: ts.URL},
		}, tracer)
	}

	ctx := contextWithReqContext()
	if s.noReqContext {
		ctx = context.Background()
	}
	if !s.noRequester && s.requesterOrgID != 0 {
		ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: s.requesterOrgID})
	}

	return svc, ctx
}
