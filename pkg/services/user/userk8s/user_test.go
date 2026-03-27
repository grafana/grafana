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
			var svc *UserK8sService

			tracer := tracing.InitializeTracerForTest()
			if tt.nilProvider {
				svc = NewUserK8sService(log.NewNopLogger(), nil, nil, tracer)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &rest.Config{Host: ts.URL},
				}
				svc = NewUserK8sService(log.NewNopLogger(), tt.cfg, provider, tracer)
			}

			var ctx context.Context
			if tt.noReqContext {
				ctx = context.Background()
			} else {
				ctx = contextWithReqContext()
			}

			if tt.requesterOrgID != 0 {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: tt.requesterOrgID})
			}

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
			var svc *UserK8sService

			tracer := tracing.InitializeTracerForTest()
			if tt.nilProvider {
				svc = NewUserK8sService(log.NewNopLogger(), nil, nil, tracer)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &rest.Config{Host: ts.URL},
				}
				svc = NewUserK8sService(log.NewNopLogger(), nil, provider, tracer)
			}

			var ctx context.Context
			if tt.noReqContext {
				ctx = context.Background()
			} else {
				ctx = contextWithReqContext()
			}

			if tt.requesterOrgID != 0 {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: tt.requesterOrgID})
			} else if !tt.noRequester {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: 1})
			}

			err := svc.Update(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
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
