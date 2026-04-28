package userk8s

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
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

func TestUserK8sService_GetByID(t *testing.T) {
	makeListResponse := func(users ...v0alpha1.User) func(http.ResponseWriter, *http.Request) {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			items := make([]any, 0, len(users))
			for _, u := range users {
				items = append(items, u)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": "v1",
				"kind":       "List",
				"items":      items,
			})
		}
	}

	tests := []struct {
		name           string
		cmd            *user.GetUserByIDQuery
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		noRequester    bool
		expectErr      bool
		expectErrIs    error
		expectUser     *user.User
	}{
		{
			name:           "successfully retrieves a user by internal ID",
			requesterOrgID: 1,
			cmd:            &user.GetUserByIDQuery{ID: 42},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "labelSelector=grafana.app")
				assert.Contains(t, r.URL.RawQuery, "42")
				makeListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.User{
				ID:            42,
				UID:           "some-uid",
				OrgID:         1,
				Login:         "jdoe",
				Email:         "jdoe@example.com",
				Name:          "John Doe",
				IsAdmin:       true,
				EmailVerified: true,
				LastSeenAt:    time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "maps all user fields correctly",
			requesterOrgID: 2,
			cmd:            &user.GetUserByIDQuery{ID: 7},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
				u := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:              "admin-uid",
						Namespace:         "org-2",
						Labels:            map[string]string{"grafana.app/deprecatedInternalID": "7"},
						CreationTimestamp: metav1.NewTime(now),
					},
					Spec: v0alpha1.UserSpec{
						Login:         "admin",
						Email:         "admin@example.com",
						Title:         "Admin User",
						GrafanaAdmin:  true,
						Disabled:      true,
						EmailVerified: true,
						Provisioned:   true,
					},
					Status: v0alpha1.UserStatus{
						LastSeenAt: time.Date(2025, 3, 15, 12, 0, 0, 0, time.UTC).Unix(),
					},
				}
				makeListResponse(u)(w, r)
			},
			expectUser: &user.User{
				ID:            7,
				UID:           "admin-uid",
				OrgID:         2,
				Login:         "admin",
				Email:         "admin@example.com",
				Name:          "Admin User",
				IsAdmin:       true,
				IsDisabled:    true,
				EmailVerified: true,
				IsProvisioned: true,
				Created:       time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
				LastSeenAt:    time.Date(2025, 3, 15, 12, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "returns ErrUserNotFound when no user matches",
			requesterOrgID: 1,
			cmd:            &user.GetUserByIDQuery{ID: 99},
			serverResponse: makeListResponse(),
			expectErr:      true,
			expectErrIs:    user.ErrUserNotFound,
		},
		{
			name:           "returns error when multiple users found with same internal ID",
			requesterOrgID: 1,
			cmd:            &user.GetUserByIDQuery{ID: 5},
			serverResponse: makeListResponse(
				newTestK8sUser("uid-1", "org-1", "user-a", "a@example.com"),
				newTestK8sUser("uid-2", "org-1", "user-b", "b@example.com"),
			),
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client",
			requesterOrgID: 1,
			cmd:            &user.GetUserByIDQuery{ID: 42},
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
			cmd:         &user.GetUserByIDQuery{ID: 42},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &user.GetUserByIDQuery{ID: 42},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when no requester in context",
			cmd:         &user.GetUserByIDQuery{ID: 42},
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

			result, err := svc.GetByID(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				if tt.expectErrIs != nil {
					require.ErrorIs(t, err, tt.expectErrIs)
				}
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectUser.ID, result.ID)
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
			assert.Equal(t, tt.expectUser.LastSeenAt.UTC(), result.LastSeenAt.UTC())
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
							Status: v0alpha1.UserStatus{
								LastSeenAt: time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC).Unix(),
							},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:        "some-uid",
				OrgID:      1,
				Login:      "jdoe",
				Email:      "jdoe@example.com",
				Name:       "John Doe",
				Created:    time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
				LastSeenAt: time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
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
							Status: v0alpha1.UserStatus{
								LastSeenAt: time.Date(2025, 2, 10, 8, 30, 0, 0, time.UTC).Unix(),
							},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectUser: &user.User{
				UID:        "some-uid",
				OrgID:      1,
				Login:      "jdoe",
				Email:      "jdoe@example.com",
				LastSeenAt: time.Date(2025, 2, 10, 8, 30, 0, 0, time.UTC),
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
							Status: v0alpha1.UserStatus{
								// LastSeenAt is stored as Unix seconds (not millis)
								LastSeenAt: time.Date(2025, 3, 15, 12, 0, 0, 0, time.UTC).Unix(),
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
				LastSeenAt:    time.Date(2025, 3, 15, 12, 0, 0, 0, time.UTC),
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
			assert.Equal(t, tt.expectUser.LastSeenAt.UTC(), result.LastSeenAt.UTC())
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
				_ = json.NewEncoder(w).Encode(userList(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")))
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
				_ = json.NewEncoder(w).Encode(userList(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")))
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
				_ = json.NewEncoder(w).Encode(userList(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")))
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
						_ = json.NewEncoder(w).Encode(userList(newTestK8sUser("some-uid", "org-1", "jdoe@example.com", "")))
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

func TestUserK8sService_Update(t *testing.T) {
	trueVal := true
	falseVal := false

	tests := []struct {
		name           string
		cmd            *user.UpdateUserCommand
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		noRequester    bool
		expectErr      bool
	}{
		{
			name:           "successfully updates a user",
			requesterOrgID: 1,
			cmd: &user.UpdateUserCommand{
				UserID: 42,
				Name:   "Jane Doe",
				Email:  "jane@example.com",
				Login:  "janedoe",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodGet {
					// List response
					resp := v0alpha1.User{
						TypeMeta: metav1.TypeMeta{
							APIVersion: v0alpha1.GroupVersion.Identifier(),
							Kind:       "User",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "some-uid",
							Namespace: "org-1",
							Labels:    map[string]string{"grafana.app/deprecatedInternalID": "42"},
						},
						Spec: v0alpha1.UserSpec{Login: "jdoe", Email: "jdoe@example.com"},
					}
					list := map[string]any{
						"apiVersion": "v1",
						"kind":       "List",
						"items":      []any{resp},
					}
					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(list)
					return
				}
				// Update response
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				spec := body["spec"].(map[string]any)
				assert.Equal(t, "Jane Doe", spec["title"])
				assert.Equal(t, "jane@example.com", spec["email"])
				assert.Equal(t, "janedoe", spec["login"])

				resp := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{Name: "some-uid", Namespace: "org-1"},
					Spec:       v0alpha1.UserSpec{Login: "janedoe", Email: "jane@example.com", Title: "Jane Doe"},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
		},
		{
			name:           "updates optional boolean fields",
			requesterOrgID: 1,
			cmd: &user.UpdateUserCommand{
				UserID:         7,
				IsDisabled:     &trueVal,
				EmailVerified:  &falseVal,
				IsGrafanaAdmin: &trueVal,
				IsProvisioned:  &falseVal,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodGet {
					resp := v0alpha1.User{
						TypeMeta: metav1.TypeMeta{
							APIVersion: v0alpha1.GroupVersion.Identifier(),
							Kind:       "User",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "some-uid",
							Namespace: "org-1",
							Labels:    map[string]string{"grafana.app/deprecatedInternalID": "7"},
						},
						Spec: v0alpha1.UserSpec{Login: "user7"},
					}
					list := map[string]any{
						"apiVersion": "v1",
						"kind":       "List",
						"items":      []any{resp},
					}
					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(list)
					return
				}
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				spec := body["spec"].(map[string]any)
				assert.Equal(t, true, spec["disabled"])
				assert.Equal(t, false, spec["emailVerified"])
				assert.Equal(t, true, spec["grafanaAdmin"])
				assert.Equal(t, false, spec["provisioned"])

				resp := v0alpha1.User{
					TypeMeta: metav1.TypeMeta{
						APIVersion: v0alpha1.GroupVersion.Identifier(),
						Kind:       "User",
					},
					ObjectMeta: metav1.ObjectMeta{Name: "some-uid", Namespace: "org-1"},
					Spec:       v0alpha1.UserSpec{Login: "user7", Disabled: true, GrafanaAdmin: true},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
		},
		{
			name:           "returns not found when user does not exist",
			requesterOrgID: 1,
			cmd:            &user.UpdateUserCommand{UserID: 99},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				list := map[string]any{
					"apiVersion": "v1",
					"kind":       "List",
					"items":      []any{},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(list)
			},
			expectErr: true,
		},
		{
			name:        "returns error when config provider not initialized",
			cmd:         &user.UpdateUserCommand{UserID: 1},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &user.UpdateUserCommand{UserID: 1},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when no requester in context",
			cmd:         &user.UpdateUserCommand{UserID: 1},
			noRequester: true,
			expectErr:   true,
		},
		{
			name:           "returns error when list returns multiple users",
			requesterOrgID: 1,
			cmd:            &user.UpdateUserCommand{UserID: 5},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				user1 := v0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: v0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "uid-1", Namespace: "org-1"},
					Spec:       v0alpha1.UserSpec{Login: "user-a"},
				}
				user2 := v0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: v0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "uid-2", Namespace: "org-1"},
					Spec:       v0alpha1.UserSpec{Login: "user-b"},
				}
				list := map[string]any{
					"apiVersion": "v1",
					"kind":       "List",
					"items":      []any{user1, user2},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(list)
			},
			expectErr: true,
		},
		{
			name:           "returns error when list call fails",
			requesterOrgID: 1,
			cmd:            &user.UpdateUserCommand{UserID: 5},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Message:  "internal server error",
					Code:     http.StatusInternalServerError,
				})
			},
			expectErr: true,
		},
		{
			name:           "propagates error from client.Update",
			requesterOrgID: 1,
			cmd:            &user.UpdateUserCommand{UserID: 5},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodGet {
					resp := v0alpha1.User{
						TypeMeta:   metav1.TypeMeta{APIVersion: v0alpha1.GroupVersion.Identifier(), Kind: "User"},
						ObjectMeta: metav1.ObjectMeta{Name: "uid-1", Namespace: "org-1"},
						Spec:       v0alpha1.UserSpec{Login: "user-a"},
					}
					list := map[string]any{
						"apiVersion": "v1",
						"kind":       "List",
						"items":      []any{resp},
					}
					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(list)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusConflict)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Message:  "conflict",
					Code:     http.StatusConflict,
				})
			},
			expectErr: true,
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

			err := svc.Update(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestUserK8sService_UpdateLastSeenAt(t *testing.T) {
	makeListResponse := func(userID int64, lastSeenAtSec int64) func(http.ResponseWriter, *http.Request) {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			switch r.Method {
			case http.MethodGet:
				resp := map[string]any{
					"apiVersion": v0alpha1.GroupVersion.Identifier(),
					"kind":       "UserList",
					"items": []any{
						map[string]any{
							"apiVersion": v0alpha1.GroupVersion.Identifier(),
							"kind":       "User",
							"metadata": map[string]any{
								"name":      "some-uid",
								"namespace": "org-1",
								"labels":    map[string]any{"grafana.app/deprecatedInternalID": strconv.FormatInt(userID, 10)},
							},
							"spec":   map[string]any{"login": "jdoe"},
							"status": map[string]any{"lastSeenAt": lastSeenAtSec},
						},
					},
				}
				_ = json.NewEncoder(w).Encode(resp)
			case http.MethodPut:
				_ = json.NewEncoder(w).Encode(map[string]any{
					"apiVersion": v0alpha1.GroupVersion.Identifier(),
					"kind":       "User",
					"metadata":   map[string]any{"name": "some-uid", "namespace": "org-1"},
					"spec":       map[string]any{"login": "jdoe"},
					"status":     map[string]any{"lastSeenAt": time.Now().Unix()},
				})
			}
		}
	}

	tests := []struct {
		name         string
		cmd          *user.UpdateUserLastSeenAtCommand
		cfg          *setting.Cfg
		noReqContext bool
		nilProvider  bool
		serverFn     func(http.ResponseWriter, *http.Request)
		expectErr    bool
		expectErrIs  error
	}{
		{
			name:     "successfully updates last seen at",
			cmd:      &user.UpdateUserLastSeenAtCommand{UserID: 42, OrgID: 1},
			cfg:      &setting.Cfg{UserLastSeenUpdateInterval: 5 * time.Minute},
			serverFn: makeListResponse(42, 0),
		},
		{
			name:        "skips update when last seen is within the interval",
			cmd:         &user.UpdateUserLastSeenAtCommand{UserID: 42, OrgID: 1},
			cfg:         &setting.Cfg{UserLastSeenUpdateInterval: 1 * time.Hour},
			serverFn:    makeListResponse(42, time.Now().Unix()), // just seen
			expectErr:   true,
			expectErrIs: user.ErrLastSeenUpToDate,
		},
		{
			name: "returns ErrUserNotFound when no user matches the label selector",
			cmd:  &user.UpdateUserLastSeenAtCommand{UserID: 99, OrgID: 1},
			cfg:  &setting.Cfg{UserLastSeenUpdateInterval: 5 * time.Minute},
			serverFn: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{
					"apiVersion": v0alpha1.GroupVersion.Identifier(),
					"kind":       "UserList",
					"items":      []any{},
				})
			},
			expectErr:   true,
			expectErrIs: user.ErrUserNotFound,
		},
		{
			name: "returns error when multiple users found with same internal ID",
			cmd:  &user.UpdateUserLastSeenAtCommand{UserID: 42, OrgID: 1},
			cfg:  &setting.Cfg{UserLastSeenUpdateInterval: 5 * time.Minute},
			serverFn: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				item := map[string]any{
					"apiVersion": v0alpha1.GroupVersion.Identifier(),
					"kind":       "User",
					"metadata": map[string]any{
						"name":      "uid-1",
						"namespace": "org-1",
						"labels":    map[string]any{"grafana.app/deprecatedInternalID": "42"},
					},
					"spec":   map[string]any{"login": "user1"},
					"status": map[string]any{"lastSeenAt": 0},
				}
				_ = json.NewEncoder(w).Encode(map[string]any{
					"apiVersion": v0alpha1.GroupVersion.Identifier(),
					"kind":       "UserList",
					"items":      []any{item, item},
				})
			},
			expectErr: true,
		},
		{
			name: "returns error when k8s list fails",
			cmd:  &user.UpdateUserLastSeenAtCommand{UserID: 42, OrgID: 1},
			cfg:  &setting.Cfg{UserLastSeenUpdateInterval: 5 * time.Minute},
			serverFn: func(w http.ResponseWriter, r *http.Request) {
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
			name:         "returns error when no request context",
			cmd:          &user.UpdateUserLastSeenAtCommand{UserID: 42, OrgID: 1},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when config provider not initialized",
			cmd:         &user.UpdateUserLastSeenAtCommand{UserID: 42, OrgID: 1},
			nilProvider: true,
			expectErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, ctx := setupServiceAndCtx(t, svcTestSetup{
				noReqContext:   tt.noReqContext,
				nilProvider:    tt.nilProvider,
				cfg:            tt.cfg,
				serverResponse: tt.serverFn,
			})

			err := svc.UpdateLastSeenAt(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				if tt.expectErrIs != nil {
					require.ErrorIs(t, err, tt.expectErrIs)
				}
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestUserK8sService_GetSignedInUser(t *testing.T) {
	makeUserListResponse := func(users ...v0alpha1.User) func(http.ResponseWriter, *http.Request) {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			list := v0alpha1.UserList{
				TypeMeta: metav1.TypeMeta{
					APIVersion: v0alpha1.GroupVersion.Identifier(),
					Kind:       "UserList",
				},
				Items: users,
			}
			_ = json.NewEncoder(w).Encode(list)
		}
	}

	tests := []struct {
		name           string
		cmd            *user.GetSignedInUserQuery
		requesterOrgID int64
		serverResponse func(http.ResponseWriter, *http.Request)
		nilProvider    bool
		noReqContext   bool
		noRequester    bool
		expectErr      bool
		expectErrIs    error
		expectUser     *user.SignedInUser
	}{
		{
			name:           "finds user by UserID via label selector",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{UserID: 42, OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "labelSelector=grafana.app")
				makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          1,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "finds user by Login via field selector",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{Login: "jdoe", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.login%3Djdoe")
				makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          1,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "lowercases login before querying",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{Login: "JDOE", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.login%3Djdoe")
				makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          1,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "finds user by Email via field selector",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{Email: "jdoe@example.com", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.email%3Djdoe%40example.com")
				makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          1,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "lowercases email before querying",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{Email: "JDOE@EXAMPLE.COM", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.email%3Djdoe%40example.com")
				makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          1,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "uses OrgID from query when provided",
			requesterOrgID: 99,
			cmd:            &user.GetSignedInUserQuery{UserID: 42, OrgID: 5},
			serverResponse: makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")),
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          5,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "falls back to orgID from context when query OrgID is zero",
			requesterOrgID: 3,
			cmd:            &user.GetSignedInUserQuery{UserID: 42},
			serverResponse: makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")),
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          3,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "sets OrgID to -1 and OrgName to 'Org missing' when role is empty",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{UserID: 42, OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				u := newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")
				u.Spec.Role = ""
				makeUserListResponse(u)(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          -1,
				OrgName:        "Org missing",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "sets OrgID to -1 and OrgName to 'Org missing' when role is invalid",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{UserID: 42, OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				u := newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")
				u.Spec.Role = "InvalidRole"
				makeUserListResponse(u)(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          -1,
				OrgName:        "Org missing",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "returns ErrNoUniqueID when no identifier provided",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{OrgID: 1},
			expectErr:      true,
			expectErrIs:    user.ErrNoUniqueID,
		},
		{
			name:           "returns ErrUserNotFound when UserID lookup returns empty list",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{UserID: 99, OrgID: 1},
			serverResponse: makeUserListResponse(),
			expectErr:      true,
			expectErrIs:    user.ErrUserNotFound,
		},
		{
			name:           "returns ErrUserNotFound when Login lookup returns empty list",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{Login: "notfound", OrgID: 1},
			serverResponse: makeUserListResponse(),
			expectErr:      true,
			expectErrIs:    user.ErrUserNotFound,
		},
		{
			name:           "returns ErrUserNotFound when Email lookup returns empty list",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{Email: "notfound@example.com", OrgID: 1},
			serverResponse: makeUserListResponse(),
			expectErr:      true,
			expectErrIs:    user.ErrUserNotFound,
		},
		{
			name:           "returns error when multiple users found by UserID",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{UserID: 42, OrgID: 1},
			serverResponse: makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"), newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com")),
			expectErr:      true,
		},
		{
			name:           "returns error when k8s list call fails",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{UserID: 42, OrgID: 1},
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
			name:        "returns error when config provider not initialized",
			cmd:         &user.GetSignedInUserQuery{UserID: 42, OrgID: 1},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &user.GetSignedInUserQuery{UserID: 42, OrgID: 1},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when no requester and no OrgID in query",
			cmd:         &user.GetSignedInUserQuery{UserID: 42},
			noRequester: true,
			expectErr:   true,
		},
		{
			name:           "prefers UserID over Login and Email",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{UserID: 42, Login: "other", Email: "other@example.com", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "labelSelector=grafana.app")
				assert.NotContains(t, r.URL.RawQuery, "fieldSelector")
				makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          1,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "prefers Login over Email when UserID is zero",
			requesterOrgID: 1,
			cmd:            &user.GetSignedInUserQuery{Login: "jdoe", Email: "other@example.com", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.RawQuery, "fieldSelector=spec.login%3Djdoe")
				makeUserListResponse(newTestK8sUser("some-uid", "org-1", "jdoe", "jdoe@example.com"))(w, r)
			},
			expectUser: &user.SignedInUser{
				UserUID:        "some-uid",
				OrgID:          1,
				OrgRole:        "Admin",
				Login:          "jdoe",
				Email:          "jdoe@example.com",
				Name:           "John Doe",
				IsGrafanaAdmin: true,
				EmailVerified:  true,
				LastSeenAt:     time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC),
			},
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

			result, err := svc.GetSignedInUser(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				if tt.expectErrIs != nil {
					require.ErrorIs(t, err, tt.expectErrIs)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.Equal(t, tt.expectUser.UserUID, result.UserUID)
			assert.Equal(t, tt.expectUser.OrgID, result.OrgID)
			assert.Equal(t, tt.expectUser.OrgRole, result.OrgRole)
			assert.Equal(t, tt.expectUser.OrgName, result.OrgName)
			assert.Equal(t, tt.expectUser.Login, result.Login)
			assert.Equal(t, tt.expectUser.Email, result.Email)
			assert.Equal(t, tt.expectUser.Name, result.Name)
			assert.Equal(t, tt.expectUser.IsGrafanaAdmin, result.IsGrafanaAdmin)
			assert.Equal(t, tt.expectUser.IsDisabled, result.IsDisabled)
			assert.Equal(t, tt.expectUser.EmailVerified, result.EmailVerified)
			if !tt.expectUser.LastSeenAt.IsZero() {
				assert.Equal(t, tt.expectUser.LastSeenAt.UTC(), result.LastSeenAt.UTC())
			}
		})
	}
}

func newTestK8sUser(uid, namespace, login, email string) v0alpha1.User {
	return v0alpha1.User{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v0alpha1.GroupVersion.Identifier(),
			Kind:       "User",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      uid,
			Namespace: namespace,
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "42"},
		},
		Spec: v0alpha1.UserSpec{
			Login:         login,
			Email:         email,
			Title:         "John Doe",
			GrafanaAdmin:  true,
			EmailVerified: true,
			Role:          "Admin",
		},
		Status: v0alpha1.UserStatus{
			LastSeenAt: time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC).Unix(),
		},
	}
}

// testClientGenerator creates a resource.ClientGenerator backed by a test HTTP server.
func testClientGenerator(serverURL string) resource.ClientGenerator {
	return apiserver.ProvideClientGenerator(apiserver.RestConfigProviderFunc(
		func(_ context.Context) (*rest.Config, error) {
			return &rest.Config{Host: serverURL}, nil
		},
	))
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
		svc = NewUserK8sService(log.NewNopLogger(), s.cfg, testClientGenerator(ts.URL), tracer)
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
