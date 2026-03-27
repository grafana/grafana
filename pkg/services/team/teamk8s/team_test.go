package teamk8s

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
	clientrest "k8s.io/client-go/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
)

func TestTeamK8sService_CreateTeam(t *testing.T) {
	tests := []struct {
		name           string
		cmd            *team.CreateTeamCommand
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectTeam     team.Team
	}{
		{
			name:           "successfully creates a team",
			requesterOrgID: 1,
			cmd: &team.CreateTeamCommand{
				Name:  "Test Team",
				Email: "team@example.com",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
				resp := iamv0alpha1.Team{
					TypeMeta: metav1.TypeMeta{
						APIVersion: iamv0alpha1.GroupVersion.Identifier(),
						Kind:       "Team",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:              "some-uid",
						Namespace:         "org-1",
						CreationTimestamp: metav1.NewTime(now),
					},
					Spec: iamv0alpha1.TeamSpec{
						Title: "Test Team",
						Email: "team@example.com",
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectTeam: team.Team{
				OrgID:   1,
				Name:    "Test Team",
				Email:   "team@example.com",
				Created: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			},
		},
		{
			name:           "maps ExternalUID and IsProvisioned fields",
			requesterOrgID: 2,
			cmd: &team.CreateTeamCommand{
				Name:          "Provisioned Team",
				ExternalUID:   "ext-uid-123",
				IsProvisioned: true,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				resp := iamv0alpha1.Team{
					TypeMeta: metav1.TypeMeta{
						APIVersion: iamv0alpha1.GroupVersion.Identifier(),
						Kind:       "Team",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "new-uid",
						Namespace: "org-2",
					},
					Spec: iamv0alpha1.TeamSpec{
						Title:       "Provisioned Team",
						ExternalUID: "ext-uid-123",
						Provisioned: true,
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectTeam: team.Team{
				OrgID:         2,
				Name:          "Provisioned Team",
				ExternalUID:   "ext-uid-123",
				IsProvisioned: true,
			},
		},
		{
			name:           "propagates error from k8s client",
			requesterOrgID: 1,
			cmd: &team.CreateTeamCommand{
				Name: "Failing Team",
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
			name:           "returns error when config provider not initialized",
			requesterOrgID: 1,
			cmd:            &team.CreateTeamCommand{Name: "Any Team"},
			nilProvider:    true,
			expectErr:      true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &team.CreateTeamCommand{Name: "Any Team"},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when requester is not set in context",
			cmd:         &team.CreateTeamCommand{Name: "Any Team"},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:           "uses orgId from context instead of command",
			requesterOrgID: 5,
			cmd: &team.CreateTeamCommand{
				Name:  "Test Team",
				OrgID: 99,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.Path, "org-5")
				resp := iamv0alpha1.Team{
					TypeMeta: metav1.TypeMeta{
						APIVersion: iamv0alpha1.GroupVersion.Identifier(),
						Kind:       "Team",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "some-uid",
						Namespace: "org-5",
					},
					Spec: iamv0alpha1.TeamSpec{Title: "Test Team"},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectTeam: team.Team{OrgID: 5, Name: "Test Team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService

			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, nil)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, nil)
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

			result, err := svc.CreateTeam(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectTeam.OrgID, result.OrgID)
			assert.Equal(t, tt.expectTeam.Name, result.Name)
			assert.Equal(t, tt.expectTeam.Email, result.Email)
			assert.Equal(t, tt.expectTeam.ExternalUID, result.ExternalUID)
			assert.Equal(t, tt.expectTeam.IsProvisioned, result.IsProvisioned)
			assert.Equal(t, tt.expectTeam.Created.UTC(), result.Created.UTC())
		})
	}
}

func TestTeamK8sService_GetTeamByID(t *testing.T) {
	tests := []struct {
		name           string
		query          *team.GetTeamByIDQuery
		requesterOrgID int64
		ctxUID         string
		legacyResult   *team.TeamDTO
		legacyErr      error
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectDTO      *team.TeamDTO
	}{
		{
			name:           "successfully gets a team by UID from context",
			requesterOrgID: 1,
			query: &team.GetTeamByIDQuery{
				ID: 42,
			},
			ctxUID: "team-uid-from-ctx",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.Path, "team-uid-from-ctx")
				resp := iamv0alpha1.Team{
					TypeMeta: metav1.TypeMeta{
						APIVersion: iamv0alpha1.GroupVersion.Identifier(),
						Kind:       "Team",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "team-uid-from-ctx",
						Namespace: "org-1",
					},
					Spec: iamv0alpha1.TeamSpec{
						Title: "Context Team",
						Email: "ctx@example.com",
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectDTO: &team.TeamDTO{
				UID:   "team-uid-from-ctx",
				OrgID: 1,
				Name:  "Context Team",
				Email: "ctx@example.com",
			},
		},
		{
			name:           "successfully gets a team by UID",
			requesterOrgID: 1,
			query: &team.GetTeamByIDQuery{
				UID: "team-uid-1",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				resp := iamv0alpha1.Team{
					TypeMeta: metav1.TypeMeta{
						APIVersion: iamv0alpha1.GroupVersion.Identifier(),
						Kind:       "Team",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "team-uid-1",
						Namespace: "org-1",
					},
					Spec: iamv0alpha1.TeamSpec{
						Title:       "My Team",
						Email:       "team@example.com",
						ExternalUID: "ext-1",
						Provisioned: true,
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectDTO: &team.TeamDTO{
				UID:           "team-uid-1",
				OrgID:         1,
				Name:          "My Team",
				Email:         "team@example.com",
				ExternalUID:   "ext-1",
				IsProvisioned: true,
			},
		},
		{
			name:           "successfully gets a team by ID",
			requesterOrgID: 1,
			query: &team.GetTeamByIDQuery{
				ID: 42,
			},
			legacyResult: &team.TeamDTO{ID: 42, UID: "team-uid-42", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				resp := iamv0alpha1.Team{
					TypeMeta: metav1.TypeMeta{
						APIVersion: iamv0alpha1.GroupVersion.Identifier(),
						Kind:       "Team",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "team-uid-42",
						Namespace: "org-1",
					},
					Spec: iamv0alpha1.TeamSpec{
						Title: "Team From ID",
						Email: "id@example.com",
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectDTO: &team.TeamDTO{
				UID:   "team-uid-42",
				OrgID: 1,
				Name:  "Team From ID",
				Email: "id@example.com",
			},
		},
		{
			name:           "returns error when team not found in legacy",
			requesterOrgID: 1,
			query: &team.GetTeamByIDQuery{
				ID: 999,
			},
			legacyErr: team.ErrTeamNotFound,
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client",
			requesterOrgID: 1,
			query: &team.GetTeamByIDQuery{
				UID: "team-uid-1",
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
			name:           "returns error when config provider not initialized",
			requesterOrgID: 1,
			query:          &team.GetTeamByIDQuery{UID: "team-uid-1"},
			nilProvider:    true,
			expectErr:      true,
		},
		{
			name:         "returns error when no request context",
			query:        &team.GetTeamByIDQuery{UID: "team-uid-1"},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when requester is not set in context",
			query:       &team.GetTeamByIDQuery{UID: "team-uid-1"},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:      "returns error when both ID and UID are unset",
			query:     &team.GetTeamByIDQuery{},
			expectErr: true,
		},
		{
			name:           "uses orgId from context instead of query",
			requesterOrgID: 5,
			query: &team.GetTeamByIDQuery{
				UID:   "team-uid-1",
				OrgID: 99,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.Path, "org-5")
				resp := iamv0alpha1.Team{
					TypeMeta: metav1.TypeMeta{
						APIVersion: iamv0alpha1.GroupVersion.Identifier(),
						Kind:       "Team",
					},
					ObjectMeta: metav1.ObjectMeta{
						Name:      "team-uid-1",
						Namespace: "org-5",
					},
					Spec: iamv0alpha1.TeamSpec{Title: "My Team"},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectDTO: &team.TeamDTO{UID: "team-uid-1", OrgID: 5, Name: "My Team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockLegacyService{
				getTeamByIDResult: tt.legacyResult,
				getTeamByIDErr:    tt.legacyErr,
			}

			var svc *TeamK8sService

			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, mock)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if tt.serverResponse != nil {
						tt.serverResponse(w, r)
					}
				}))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, mock)
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

			if tt.ctxUID != "" {
				ctx = context.WithValue(ctx, team.TeamUIDCtxKey{}, tt.ctxUID)
			}

			result, err := svc.GetTeamByID(ctx, tt.query)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectDTO.UID, result.UID)
			assert.Equal(t, tt.expectDTO.OrgID, result.OrgID)
			assert.Equal(t, tt.expectDTO.Name, result.Name)
			assert.Equal(t, tt.expectDTO.Email, result.Email)
			assert.Equal(t, tt.expectDTO.ExternalUID, result.ExternalUID)
			assert.Equal(t, tt.expectDTO.IsProvisioned, result.IsProvisioned)
		})
	}
}

func TestTeamK8sService_UpdateTeam(t *testing.T) {
	tests := []struct {
		name           string
		cmd            *team.UpdateTeamCommand
		requesterOrgID int64
		legacyResult   *team.TeamDTO
		legacyErr      error
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
	}{
		{
			name:           "successfully updates a team",
			requesterOrgID: 1,
			cmd: &team.UpdateTeamCommand{
				ID:          1,
				Name:        "Updated Team",
				Email:       "updated@example.com",
				ExternalUID: "ext-uid-1",
			},
			legacyResult: &team.TeamDTO{ID: 1, UID: "team-uid-1", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				switch r.Method {
				case http.MethodGet:
					resp := iamv0alpha1.Team{
						TypeMeta: metav1.TypeMeta{
							APIVersion: iamv0alpha1.GroupVersion.Identifier(),
							Kind:       "Team",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "team-uid-1",
							Namespace: "org-1",
						},
						Spec: iamv0alpha1.TeamSpec{
							Title: "Old Team",
							Email: "old@example.com",
						},
					}
					_ = json.NewEncoder(w).Encode(resp)
				case http.MethodPut:
					var body map[string]any
					_ = json.NewDecoder(r.Body).Decode(&body)
					spec := body["spec"].(map[string]any)
					assert.Equal(t, "Updated Team", spec["title"])
					assert.Equal(t, "updated@example.com", spec["email"])
					assert.Equal(t, "ext-uid-1", spec["externalUID"])
					_ = json.NewEncoder(w).Encode(body)
				}
			},
		},
		{
			name:           "preserves provisioned field during update",
			requesterOrgID: 1,
			cmd: &team.UpdateTeamCommand{
				ID:    2,
				Name:  "Updated Provisioned Team",
				Email: "updated@example.com",
			},
			legacyResult: &team.TeamDTO{ID: 2, UID: "team-uid-2", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				switch r.Method {
				case http.MethodGet:
					resp := iamv0alpha1.Team{
						TypeMeta: metav1.TypeMeta{
							APIVersion: iamv0alpha1.GroupVersion.Identifier(),
							Kind:       "Team",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "team-uid-2",
							Namespace: "org-1",
						},
						Spec: iamv0alpha1.TeamSpec{
							Title:       "Provisioned Team",
							Email:       "old@example.com",
							Provisioned: true,
						},
					}
					_ = json.NewEncoder(w).Encode(resp)
				case http.MethodPut:
					var body map[string]any
					_ = json.NewDecoder(r.Body).Decode(&body)
					spec := body["spec"].(map[string]any)
					assert.Equal(t, "Updated Provisioned Team", spec["title"])
					assert.Equal(t, "updated@example.com", spec["email"])
					assert.Equal(t, true, spec["provisioned"])
					_ = json.NewEncoder(w).Encode(body)
				}
			},
		},
		{
			name:           "returns error when team not found in legacy",
			requesterOrgID: 1,
			cmd: &team.UpdateTeamCommand{
				ID:   999,
				Name: "Any",
			},
			legacyErr: team.ErrTeamNotFound,
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client",
			requesterOrgID: 1,
			cmd: &team.UpdateTeamCommand{
				ID:   1,
				Name: "Any",
			},
			legacyResult: &team.TeamDTO{ID: 1, UID: "team-uid-1", OrgID: 1},
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
			name:           "returns error when config provider not initialized",
			requesterOrgID: 1,
			cmd:            &team.UpdateTeamCommand{ID: 1, Name: "Any"},
			legacyResult:   &team.TeamDTO{ID: 1, UID: "team-uid-1", OrgID: 1},
			nilProvider:    true,
			expectErr:      true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &team.UpdateTeamCommand{ID: 1, Name: "Any"},
			legacyResult: &team.TeamDTO{ID: 1, UID: "team-uid-1", OrgID: 1},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:         "returns error when requester is not set in context",
			cmd:          &team.UpdateTeamCommand{ID: 1, Name: "Any"},
			legacyResult: &team.TeamDTO{ID: 1, UID: "team-uid-1", OrgID: 1},
			nilProvider:  true,
			expectErr:    true,
		},
		{
			name:           "uses orgId from context instead of command",
			requesterOrgID: 5,
			cmd: &team.UpdateTeamCommand{
				ID:    1,
				OrgID: 99,
				Name:  "Updated Team",
			},
			legacyResult: &team.TeamDTO{ID: 1, UID: "team-uid-1", OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.Path, "org-5")
				w.Header().Set("Content-Type", "application/json")
				switch r.Method {
				case http.MethodGet:
					resp := iamv0alpha1.Team{
						TypeMeta: metav1.TypeMeta{
							APIVersion: iamv0alpha1.GroupVersion.Identifier(),
							Kind:       "Team",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "team-uid-1",
							Namespace: "org-5",
						},
						Spec: iamv0alpha1.TeamSpec{Title: "Old Team"},
					}
					_ = json.NewEncoder(w).Encode(resp)
				case http.MethodPut:
					var body map[string]any
					_ = json.NewDecoder(r.Body).Decode(&body)
					_ = json.NewEncoder(w).Encode(body)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockLegacyService{
				getTeamByIDResult: tt.legacyResult,
				getTeamByIDErr:    tt.legacyErr,
			}

			var svc *TeamK8sService

			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, mock)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, mock)
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

			err := svc.UpdateTeam(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
		})
	}
}

type mockLegacyService struct {
	team.Service
	getTeamByIDResult *team.TeamDTO
	getTeamByIDErr    error
}

func (m *mockLegacyService) GetTeamByID(_ context.Context, _ *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	return m.getTeamByIDResult, m.getTeamByIDErr
}

type mockDirectRestConfigProvider struct {
	restConfig *clientrest.Config
}

func (m *mockDirectRestConfigProvider) GetDirectRestConfig(_ *contextmodel.ReqContext) *clientrest.Config {
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
