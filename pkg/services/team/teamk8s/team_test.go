package teamk8s

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	clientrest "k8s.io/client-go/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
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
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, tracing.InitializeTracerForTest())
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
			name:           "successfully gets a team by ID using label selector",
			requesterOrgID: 1,
			query: &team.GetTeamByIDQuery{
				ID: 42,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				assert.Equal(t, "grafana.app/deprecatedInternalID=42", r.URL.Query().Get("labelSelector"))
				resp := teamListResponse("team-uid-42", "org-1", "Team From ID", "id@example.com")
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
			name:           "returns error when team not found via label selector",
			requesterOrgID: 1,
			query: &team.GetTeamByIDQuery{
				ID: 999,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				resp := map[string]any{
					"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
					"kind":       "TeamList",
					"metadata":   map[string]any{},
					"items":      []any{},
				}
				_ = json.NewEncoder(w).Encode(resp)
			},
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
			var svc *TeamK8sService

			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, tracing.InitializeTracerForTest())
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
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, tracing.InitializeTracerForTest())
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
		ctxUID         string
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
	}{
		{
			name:           "successfully updates a team by UID from context",
			requesterOrgID: 1,
			ctxUID:         "team-uid-from-ctx",
			cmd: &team.UpdateTeamCommand{
				ID:    1,
				Name:  "Updated Team",
				Email: "updated@example.com",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				assert.Empty(t, r.URL.Query().Get("labelSelector"))
				assert.Contains(t, r.URL.Path, "team-uid-from-ctx")
				if r.Method == http.MethodGet {
					resp := iamv0alpha1.Team{
						TypeMeta: metav1.TypeMeta{
							APIVersion: iamv0alpha1.GroupVersion.Identifier(),
							Kind:       "Team",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "team-uid-from-ctx",
							Namespace: "org-1",
						},
						Spec: iamv0alpha1.TeamSpec{Title: "Old Team", Email: "old@example.com"},
					}
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				assert.Equal(t, http.MethodPut, r.Method)
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				spec := body["spec"].(map[string]any)
				assert.Equal(t, "Updated Team", spec["title"])
				assert.Equal(t, "updated@example.com", spec["email"])
				_ = json.NewEncoder(w).Encode(body)
			},
		},
		{
			name:           "returns ErrTeamNotFound when k8s returns 404 for ctx UID",
			requesterOrgID: 1,
			ctxUID:         "missing-uid",
			cmd:            &team.UpdateTeamCommand{ID: 1, Name: "Any"},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Message:  "not found",
					Reason:   metav1.StatusReasonNotFound,
					Code:     http.StatusNotFound,
				})
			},
			expectErr: true,
		},
		{
			name:           "successfully updates a team via label selector",
			requesterOrgID: 1,
			cmd: &team.UpdateTeamCommand{
				ID:          1,
				Name:        "Updated Team",
				Email:       "updated@example.com",
				ExternalUID: "ext-uid-1",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponse("team-uid-1", "org-1", "Old Team", "old@example.com")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				assert.Equal(t, http.MethodPut, r.Method)
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				spec := body["spec"].(map[string]any)
				assert.Equal(t, "Updated Team", spec["title"])
				assert.Equal(t, "updated@example.com", spec["email"])
				assert.Equal(t, "ext-uid-1", spec["externalUID"])
				_ = json.NewEncoder(w).Encode(body)
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
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponseWithProvisioned("team-uid-2", "org-1", "Provisioned Team", "old@example.com")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				assert.Equal(t, http.MethodPut, r.Method)
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				spec := body["spec"].(map[string]any)
				assert.Equal(t, "Updated Provisioned Team", spec["title"])
				assert.Equal(t, "updated@example.com", spec["email"])
				assert.Equal(t, true, spec["provisioned"])
				_ = json.NewEncoder(w).Encode(body)
			},
		},
		{
			name:           "returns error when team not found via label selector",
			requesterOrgID: 1,
			cmd: &team.UpdateTeamCommand{
				ID:   999,
				Name: "Any",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(emptyTeamListResponse())
			},
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client on update",
			requesterOrgID: 1,
			cmd: &team.UpdateTeamCommand{
				ID:   1,
				Name: "Any",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponse("team-uid-1", "org-1", "Team", "")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
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
			nilProvider:    true,
			expectErr:      true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &team.UpdateTeamCommand{ID: 1, Name: "Any"},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when requester is not set in context",
			cmd:         &team.UpdateTeamCommand{ID: 1, Name: "Any"},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:           "uses orgId from context instead of command",
			requesterOrgID: 5,
			cmd: &team.UpdateTeamCommand{
				ID:    1,
				OrgID: 99,
				Name:  "Updated Team",
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.Path, "org-5")
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponse("team-uid-1", "org-5", "Old Team", "")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				assert.Equal(t, http.MethodPut, r.Method)
				var body map[string]any
				_ = json.NewDecoder(r.Body).Decode(&body)
				_ = json.NewEncoder(w).Encode(body)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService

			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, tracing.InitializeTracerForTest())
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

			err := svc.UpdateTeam(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestTeamK8sService_SearchTeams(t *testing.T) {
	tests := []struct {
		name           string
		query          *team.SearchTeamsQuery
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectResult   team.SearchTeamQueryResult
	}{
		{
			name: "successfully searches teams",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				Query: "test",
				Limit: 10,
				Page:  1,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "test", r.URL.Query().Get("query"))
				assert.Equal(t, "10", r.URL.Query().Get("limit"))
				assert.Equal(t, "1", r.URL.Query().Get("page"))
				assert.Equal(t, "true", r.URL.Query().Get("membercount"))
				assert.Empty(t, r.URL.Query().Get("accesscontrol"))

				memberCount1 := int64(3)
				memberCount2 := int64(0)
				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 2,
						Hits: []iamv0alpha1.GetSearchTeamsTeamHit{
							{Name: "uid-1", Title: "Team One", Email: "one@example.com", MemberCount: &memberCount1},
							{Name: "uid-2", Title: "Team Two", Email: "two@example.com", Provisioned: true, ExternalUID: "ext-2", MemberCount: &memberCount2},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 2,
				Page:       1,
				PerPage:    10,
				Teams: []*team.TeamDTO{
					{UID: "uid-1", OrgID: 1, Name: "Team One", Email: "one@example.com", MemberCount: 3},
					{UID: "uid-2", OrgID: 1, Name: "Team Two", Email: "two@example.com", IsProvisioned: true, ExternalUID: "ext-2", MemberCount: 0},
				},
			},
		},
		{
			name: "forwards accesscontrol parameter when WithAccessControl is set",
			query: &team.SearchTeamsQuery{
				OrgID:             1,
				Limit:             10,
				Page:              1,
				WithAccessControl: true,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "true", r.URL.Query().Get("accesscontrol"))

				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 1,
						Hits: []iamv0alpha1.GetSearchTeamsTeamHit{
							{
								Name:          "uid-1",
								Title:         "Team One",
								AccessControl: map[string]bool{"teams:read": true, "teams:write": true},
							},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 1,
				Page:       1,
				PerPage:    10,
				Teams: []*team.TeamDTO{
					{
						UID:           "uid-1",
						OrgID:         1,
						Name:          "Team One",
						AccessControl: map[string]bool{"teams:read": true, "teams:write": true},
					},
				},
			},
		},
		{
			name: "forwards title param when Name is set",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				Name:  "exact-name",
				Limit: 10,
				Page:  1,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "exact-name", r.URL.Query().Get("title"))

				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 1,
						Hits:      []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "uid-1", Title: "exact-name"}},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 1,
				Page:       1,
				PerPage:    10,
				Teams: []*team.TeamDTO{
					{UID: "uid-1", OrgID: 1, Name: "exact-name"},
				},
			},
		},
		{
			name: "forwards teamId params when TeamIds are set",
			query: &team.SearchTeamsQuery{
				OrgID:   1,
				TeamIds: []int64{1, 2},
				Limit:   10,
				Page:    1,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, []string{"1", "2"}, r.URL.Query()["teamId"])

				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 1,
						Hits:      []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "uid-1", Title: "Team One"}},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 1,
				Page:       1,
				PerPage:    10,
				Teams: []*team.TeamDTO{
					{UID: "uid-1", OrgID: 1, Name: "Team One"},
				},
			},
		},
		{
			name: "forwards uid params when UIDs are set",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				UIDs:  []string{"uid-1", "uid-2"},
				Limit: 10,
				Page:  1,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, []string{"uid-1", "uid-2"}, r.URL.Query()["uid"])

				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 1,
						Hits:      []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "uid-1", Title: "Team One"}},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 1,
				Page:       1,
				PerPage:    10,
				Teams: []*team.TeamDTO{
					{UID: "uid-1", OrgID: 1, Name: "Team One"},
				},
			},
		},
		{
			name: "forwards supported sort options as query params",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				Limit: 10,
				Page:  1,
				SortOpts: []model.SortOption{
					{Name: "name-desc"},
					{Name: "email-asc"},
				},
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				sortParams := r.URL.Query()["sort"]
				assert.Equal(t, []string{"-title", "email"}, sortParams)

				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 1,
						Hits: []iamv0alpha1.GetSearchTeamsTeamHit{
							{Name: "uid-1", Title: "Team One"},
						},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 1,
				Page:       1,
				PerPage:    10,
				Teams: []*team.TeamDTO{
					{UID: "uid-1", OrgID: 1, Name: "Team One"},
				},
			},
		},
		{
			name: "skips unsupported sort options",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				Limit: 10,
				Page:  1,
				SortOpts: []model.SortOption{
					{Name: "member_count-desc"},
				},
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Empty(t, r.URL.Query()["sort"])

				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 1,
						Hits:      []iamv0alpha1.GetSearchTeamsTeamHit{{Name: "uid-1", Title: "Team One"}},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 1,
				Page:       1,
				PerPage:    10,
				Teams: []*team.TeamDTO{
					{UID: "uid-1", OrgID: 1, Name: "Team One"},
				},
			},
		},
		{
			name: "handles empty results",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				Limit: 10,
				Page:  1,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				resp := iamv0alpha1.GetSearchTeamsResponse{
					GetSearchTeamsBody: iamv0alpha1.GetSearchTeamsBody{
						TotalHits: 0,
						Hits:      []iamv0alpha1.GetSearchTeamsTeamHit{},
					},
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
			},
			expectResult: team.SearchTeamQueryResult{
				TotalCount: 0,
				Page:       1,
				PerPage:    10,
				Teams:      []*team.TeamDTO{},
			},
		},
		{
			name: "returns error on server failure",
			query: &team.SearchTeamsQuery{
				OrgID: 1,
				Limit: 10,
				Page:  1,
			},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Message:  "server error",
					Code:     http.StatusInternalServerError,
				})
			},
			expectErr: true,
		},
		{
			name:        "returns error when config provider not initialized",
			query:       &team.SearchTeamsQuery{OrgID: 1, Limit: 10, Page: 1},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			query:        &team.SearchTeamsQuery{OrgID: 1, Limit: 10, Page: 1},
			noReqContext: true,
			expectErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService

			cfg := setting.NewCfg()

			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), cfg, nil, tracing.InitializeTracerForTest())
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
				svc = NewTeamK8sService(log.NewNopLogger(), cfg, provider, tracing.InitializeTracerForTest())
			}

			var ctx context.Context
			if tt.noReqContext {
				ctx = context.Background()
			} else {
				ctx = contextWithReqContext()
			}

			result, err := svc.SearchTeams(ctx, tt.query)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectResult.TotalCount, result.TotalCount)
			assert.Equal(t, tt.expectResult.Page, result.Page)
			assert.Equal(t, tt.expectResult.PerPage, result.PerPage)
			require.Len(t, result.Teams, len(tt.expectResult.Teams))
			for i, expected := range tt.expectResult.Teams {
				actual := result.Teams[i]
				assert.Equal(t, expected.UID, actual.UID)
				assert.Equal(t, expected.OrgID, actual.OrgID)
				assert.Equal(t, expected.Name, actual.Name)
				assert.Equal(t, expected.Email, actual.Email)
				assert.Equal(t, expected.IsProvisioned, actual.IsProvisioned)
				assert.Equal(t, expected.ExternalUID, actual.ExternalUID)
				assert.Equal(t, expected.ID, actual.ID)
				assert.Equal(t, expected.MemberCount, actual.MemberCount)
				assert.Equal(t, expected.AccessControl, actual.AccessControl)
			}
		})
	}
}

func TestTeamK8sService_DeleteTeam(t *testing.T) {
	tests := []struct {
		name           string
		cmd            *team.DeleteTeamCommand
		requesterOrgID int64
		ctxUID         string
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
	}{
		{
			name:           "successfully deletes a team by UID from context",
			requesterOrgID: 1,
			cmd:            &team.DeleteTeamCommand{ID: 1, OrgID: 1},
			ctxUID:         "team-uid-from-ctx",
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, http.MethodDelete, r.Method)
				assert.Contains(t, r.URL.Path, "team-uid-from-ctx")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusSuccess,
				})
			},
		},
		{
			name:           "successfully deletes a team",
			requesterOrgID: 1,
			cmd:            &team.DeleteTeamCommand{ID: 1, OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponse("team-uid-1", "org-1", "Team", "")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				assert.Equal(t, http.MethodDelete, r.Method)
				assert.Contains(t, r.URL.Path, "team-uid-1")
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusSuccess,
				})
			},
		},
		{
			name:           "returns error when team not found via label selector",
			requesterOrgID: 1,
			cmd:            &team.DeleteTeamCommand{ID: 999, OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(emptyTeamListResponse())
			},
			expectErr: true,
		},
		{
			name:           "returns ErrTeamNotFound when k8s returns 404",
			requesterOrgID: 1,
			cmd:            &team.DeleteTeamCommand{ID: 1, OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponse("team-uid-1", "org-1", "Team", "")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				w.WriteHeader(http.StatusNotFound)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusFailure,
					Message:  "not found",
					Reason:   metav1.StatusReasonNotFound,
					Code:     http.StatusNotFound,
				})
			},
			expectErr: true,
		},
		{
			name:           "propagates error from k8s client",
			requesterOrgID: 1,
			cmd:            &team.DeleteTeamCommand{ID: 1, OrgID: 1},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponse("team-uid-1", "org-1", "Team", "")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
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
			cmd:         &team.DeleteTeamCommand{ID: 1, OrgID: 1},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &team.DeleteTeamCommand{ID: 1, OrgID: 1},
			noReqContext: true,
			expectErr:    true,
		},
		{
			name:        "returns error when requester is not set in context",
			cmd:         &team.DeleteTeamCommand{ID: 1, OrgID: 1},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:           "uses orgId from context instead of command",
			requesterOrgID: 5,
			cmd:            &team.DeleteTeamCommand{ID: 1, OrgID: 99},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				assert.Contains(t, r.URL.Path, "org-5")
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Query().Get("labelSelector") != "" {
					resp := teamListResponse("team-uid-1", "org-5", "Team", "")
					_ = json.NewEncoder(w).Encode(resp)
					return
				}
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(metav1.Status{
					TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
					Status:   metav1.StatusSuccess,
				})
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService

			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, tracing.InitializeTracerForTest())
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

			err := svc.DeleteTeam(ctx, tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
		})
	}
}

func mustToUnstructured(t *testing.T, obj any) map[string]any {
	t.Helper()
	result, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	require.NoError(t, err)
	return result
}

func TestTeamK8sService_GetTeamsByUser(t *testing.T) {
	tests := []struct {
		name           string
		query          *team.GetTeamsByUserQuery
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectTeams    int
		expectUID      string
	}{
		{
			name:           "returns teams for user",
			requesterOrgID: 1,
			query:          &team.GetTeamsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: membershipServerHandler(t),
			expectTeams:    1,
			expectUID:      "team-uid-1",
		},
		{
			name:           "returns empty list when user has no bindings",
			requesterOrgID: 1,
			query:          &team.GetTeamsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: membershipServerHandlerWithEmptyBindings(t),
			expectTeams:    0,
		},
		{
			name:           "returns empty list when user not found (matches legacy)",
			requesterOrgID: 1,
			query:          &team.GetTeamsByUserQuery{OrgID: 1, UserID: 999},
			serverResponse: userNotFoundHandler(t),
			expectTeams:    0,
		},
		{
			name:           "returns error when team list fails",
			requesterOrgID: 1,
			query:          &team.GetTeamsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: teamListErrorHandler(t),
			expectErr:      true,
		},
		{
			name:        "returns error when config provider not initialized",
			query:       &team.GetTeamsByUserQuery{OrgID: 1, UserID: 42},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			query:        &team.GetTeamsByUserQuery{OrgID: 1, UserID: 42},
			noReqContext: true,
			expectErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService
			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()
				provider := &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
				svc = NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), provider, tracing.InitializeTracerForTest())
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

			result, err := svc.GetTeamsByUser(ctx, tt.query)
			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Len(t, result, tt.expectTeams)
			if tt.expectUID != "" {
				assert.Equal(t, tt.expectUID, result[0].UID)
			}
		})
	}
}

func TestTeamK8sService_GetTeamIDsByUser(t *testing.T) {
	tests := []struct {
		name           string
		query          *team.GetTeamIDsByUserQuery
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectIDs      []int64
		expectUIDs     []string
	}{
		{
			name:           "returns team IDs for user",
			requesterOrgID: 1,
			query:          &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: membershipServerHandler(t),
			expectIDs:      []int64{10},
			expectUIDs:     []string{"team-uid-1"},
		},
		{
			name:           "returns all team IDs when user is in multiple teams",
			requesterOrgID: 1,
			query:          &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: multiMembershipServerHandler(t),
			expectIDs:      []int64{10, 20},
			expectUIDs:     []string{"team-uid-1", "team-uid-2"},
		},
		{
			name:           "returns empty list when user has no bindings",
			requesterOrgID: 1,
			query:          &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: membershipServerHandlerWithEmptyBindings(t),
			expectIDs:      []int64{},
			expectUIDs:     []string{},
		},
		{
			name:           "sorts results by team id asc regardless of list order",
			requesterOrgID: 1,
			query:          &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: reversedMultiMembershipServerHandler(t),
			expectIDs:      []int64{10, 20},
			expectUIDs:     []string{"team-uid-1", "team-uid-2"},
		},
		{
			name:           "returns error when team list fails",
			requesterOrgID: 1,
			query:          &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 42},
			serverResponse: teamListErrorHandler(t),
			expectErr:      true,
		},
		{
			name:           "returns empty list when user not found (matches legacy)",
			requesterOrgID: 1,
			query:          &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 999},
			serverResponse: userNotFoundHandler(t),
			expectIDs:      []int64{},
			expectUIDs:     []string{},
		},
		{
			name:        "returns error when config provider not initialized",
			query:       &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 42},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			query:        &team.GetTeamIDsByUserQuery{OrgID: 1, UserID: 42},
			noReqContext: true,
			expectErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService
			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()
				provider := &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, tracing.InitializeTracerForTest())
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

			ids, uids, err := svc.GetTeamIDsByUser(ctx, tt.query)
			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			// Equal (not ElementsMatch): order is part of the contract and ids/uids must match in lockstep.
			assert.Equal(t, tt.expectIDs, ids)
			assert.Equal(t, tt.expectUIDs, uids)
		})
	}
}

func TestTeamK8sService_IsTeamMember(t *testing.T) {
	tests := []struct {
		name           string
		orgID          int64
		teamID         int64
		userID         int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		expectErr      bool
		expectMember   bool
	}{
		{
			name:           "returns true when user is a team member",
			orgID:          1,
			teamID:         10,
			userID:         42,
			serverResponse: membershipServerHandler(t),
			expectMember:   true,
		},
		{
			name:           "returns false when user has no bindings for team",
			orgID:          1,
			teamID:         10,
			userID:         42,
			serverResponse: membershipServerHandlerWithEmptyBindings(t),
			expectMember:   false,
		},
		{
			name:   "returns false when team not found (matches legacy)",
			orgID:  1,
			teamID: 999,
			userID: 42,
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/teams") && r.URL.Query().Get("labelSelector") != "" {
					_ = json.NewEncoder(w).Encode(emptyTeamListResponse())
					return
				}
				w.WriteHeader(http.StatusNotFound)
			},
			expectMember: false,
		},
		{
			name:   "returns false when user not found (matches legacy)",
			orgID:  1,
			teamID: 10,
			userID: 999,
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/teams") && r.URL.Query().Get("labelSelector") != "":
					_ = json.NewEncoder(w).Encode(teamListResponse("team-uid-10", "org-1", "Team Ten", ""))
				case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
					_ = json.NewEncoder(w).Encode(map[string]any{
						"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
						"kind":       "UserList",
						"metadata":   map[string]any{"resourceVersion": "1"},
						"items":      []any{},
					})
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectMember: false,
		},
		{
			name:   "skips non-User kind entries (matches legacy is_service_account=false)",
			orgID:  1,
			teamID: 10,
			userID: 42,
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				teamObj := iamv0alpha1.Team{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
					ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
					Spec: iamv0alpha1.TeamSpec{
						Title: "Team One",
						Members: []iamv0alpha1.TeamTeamMember{
							{Kind: "ServiceAccount", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionAdmin},
						},
					},
				}
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/teams") && r.URL.Query().Get("labelSelector") != "" && !strings.Contains(path, "/teams/"):
					_ = json.NewEncoder(w).Encode(map[string]any{
						"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
						"kind":       "TeamList",
						"metadata":   map[string]any{"resourceVersion": "1"},
						"items":      []any{mustToUnstructured(t, &teamObj)},
					})
				case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
					userObj := iamv0alpha1.User{
						TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
						ObjectMeta: metav1.ObjectMeta{Name: "user-uid-42", Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
					}
					_ = json.NewEncoder(w).Encode(map[string]any{
						"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
						"kind":       "UserList",
						"metadata":   map[string]any{"resourceVersion": "1"},
						"items":      []any{mustToUnstructured(t, &userObj)},
					})
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectMember: false,
		},
		{
			name:        "returns error when config provider not initialized",
			orgID:       1,
			teamID:      10,
			userID:      42,
			nilProvider: true,
			expectErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService
			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()
				provider := &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider, tracing.InitializeTracerForTest())
			}

			ctx := contextWithReqContext()
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: tt.orgID})

			result, err := svc.IsTeamMember(ctx, tt.orgID, tt.teamID, tt.userID)
			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expectMember, result)
		})
	}
}

func TestTeamK8sService_GetUserTeamMemberships(t *testing.T) {
	tests := []struct {
		name           string
		orgID          int64
		userID         int64
		external       bool
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		expectErr      bool
		expectMembers  int
		validate       func(t *testing.T, result []*team.TeamMemberDTO)
	}{
		{
			name:           "returns memberships with user details",
			orgID:          1,
			userID:         42,
			serverResponse: membershipServerHandler(t),
			expectMembers:  1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, "user-uid-42", result[0].UserUID)
				assert.Equal(t, "team-uid-1", result[0].TeamUID)
				assert.Equal(t, team.PermissionTypeAdmin, result[0].Permission)
				assert.Equal(t, "test@example.com", result[0].Email)
				assert.Equal(t, "Test User", result[0].Name)
				assert.Equal(t, "testuser", result[0].Login)
				assert.Equal(t, int64(10), result[0].TeamID)
			},
		},
		{
			name:           "returns all memberships when user is in multiple teams",
			orgID:          1,
			userID:         42,
			serverResponse: multiMembershipServerHandler(t),
			expectMembers:  2,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				byTeamUID := map[string]*team.TeamMemberDTO{}
				for _, m := range result {
					byTeamUID[m.TeamUID] = m
				}
				require.Contains(t, byTeamUID, "team-uid-1")
				require.Contains(t, byTeamUID, "team-uid-2")
				assert.Equal(t, int64(10), byTeamUID["team-uid-1"].TeamID)
				assert.Equal(t, int64(20), byTeamUID["team-uid-2"].TeamID)
			},
		},
		{
			name:           "returns empty list when user has no bindings",
			orgID:          1,
			userID:         42,
			serverResponse: membershipServerHandlerWithEmptyBindings(t),
			expectMembers:  0,
		},
		{
			name:           "returns memberships with member permission",
			orgID:          1,
			userID:         42,
			serverResponse: membershipServerHandlerWithPermission(t, iamv0alpha1.TeamTeamPermissionMember),
			expectMembers:  1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, team.PermissionTypeMember, result[0].Permission)
			},
		},
		{
			name:           "returns empty list when user not found (matches legacy)",
			orgID:          1,
			userID:         999,
			serverResponse: userNotFoundHandler(t),
			expectMembers:  0,
		},
		{
			name:     "external=true filters out non-external memberships",
			orgID:    1,
			userID:   42,
			external: true,
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				userObj := iamv0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "user-uid-42", Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
					Spec:       iamv0alpha1.UserSpec{Login: "testuser", Email: "test@example.com", Title: "Test User"},
				}
				teamInternal := iamv0alpha1.Team{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
					ObjectMeta: metav1.ObjectMeta{Name: "team-internal", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
					Spec: iamv0alpha1.TeamSpec{
						Title:   "Internal",
						Members: []iamv0alpha1.TeamTeamMember{{Kind: "User", Name: "user-uid-42", External: false, Permission: iamv0alpha1.TeamTeamPermissionMember}},
					},
				}
				teamExternal := iamv0alpha1.Team{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
					ObjectMeta: metav1.ObjectMeta{Name: "team-external", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "20"}},
					Spec: iamv0alpha1.TeamSpec{
						Title:   "External",
						Members: []iamv0alpha1.TeamTeamMember{{Kind: "User", Name: "user-uid-42", External: true, Permission: iamv0alpha1.TeamTeamPermissionAdmin}},
					},
				}
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
					_ = json.NewEncoder(w).Encode(map[string]any{
						"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
						"kind":       "UserList",
						"metadata":   map[string]any{"resourceVersion": "1"},
						"items":      []any{mustToUnstructured(t, &userObj)},
					})
				case r.Method == http.MethodGet && strings.Contains(path, "/users/user-uid-42"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &userObj))
				case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
					_ = json.NewEncoder(w).Encode(map[string]any{
						"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
						"kind":       "TeamList",
						"metadata":   map[string]any{"resourceVersion": "1"},
						"items":      []any{mustToUnstructured(t, &teamInternal), mustToUnstructured(t, &teamExternal)},
					})
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectMembers: 1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, "team-external", result[0].TeamUID)
				assert.True(t, result[0].External)
			},
		},
		{
			name:   "returns error when team list fails",
			orgID:  1,
			userID: 42,
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				userObj := iamv0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "user-uid-42", Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
				}
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
					_ = json.NewEncoder(w).Encode(map[string]any{
						"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
						"kind":       "UserList",
						"metadata":   map[string]any{"resourceVersion": "1"},
						"items":      []any{mustToUnstructured(t, &userObj)},
					})
				case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Code: 500})
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectErr: true,
		},
		{
			name:        "returns error when config provider not initialized",
			orgID:       1,
			userID:      42,
			nilProvider: true,
			expectErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService
			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()
				provider := &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
				svc = NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), provider, tracing.InitializeTracerForTest())
			}

			ctx := contextWithReqContext()
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: tt.orgID})

			result, err := svc.GetUserTeamMemberships(ctx, tt.orgID, tt.userID, tt.external, false)
			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Len(t, result, tt.expectMembers)
			if tt.validate != nil {
				tt.validate(t, result)
			}
		})
	}
}

func TestTeamK8sService_GetUserTeamMemberships_Cache(t *testing.T) {
	newHandler := func(calls *int) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			*calls++
			w.Header().Set("Content-Type", "application/json")
			handler := membershipServerHandler(t)
			handler(w, r)
		}
	}

	newSvc := func(t *testing.T, h http.HandlerFunc) (*TeamK8sService, func()) {
		t.Helper()
		ts := httptest.NewServer(h)
		provider := &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
		svc := NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), provider, tracing.InitializeTracerForTest())
		return svc, ts.Close
	}

	ctx := contextWithReqContext()
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: 1})

	t.Run("second call with bypassCache=false hits cache", func(t *testing.T) {
		var calls int
		svc, closeServer := newSvc(t, newHandler(&calls))
		defer closeServer()

		first, err := svc.GetUserTeamMemberships(ctx, 1, 42, false, false)
		require.NoError(t, err)
		require.Len(t, first, 1)
		firstCalls := calls

		second, err := svc.GetUserTeamMemberships(ctx, 1, 42, false, false)
		require.NoError(t, err)
		require.Len(t, second, 1)

		assert.Equal(t, firstCalls, calls, "cache hit should not make additional server calls")
	})

	t.Run("bypassCache=true refetches", func(t *testing.T) {
		var calls int
		svc, closeServer := newSvc(t, newHandler(&calls))
		defer closeServer()

		_, err := svc.GetUserTeamMemberships(ctx, 1, 42, false, false)
		require.NoError(t, err)
		firstCalls := calls

		_, err = svc.GetUserTeamMemberships(ctx, 1, 42, false, true)
		require.NoError(t, err)

		assert.Greater(t, calls, firstCalls, "bypassCache=true should make additional server calls")
	})

	t.Run("cache key differs by external flag", func(t *testing.T) {
		var calls int
		svc, closeServer := newSvc(t, newHandler(&calls))
		defer closeServer()

		_, err := svc.GetUserTeamMemberships(ctx, 1, 42, false, false)
		require.NoError(t, err)
		firstCalls := calls

		_, err = svc.GetUserTeamMemberships(ctx, 1, 42, true, false)
		require.NoError(t, err)

		assert.Greater(t, calls, firstCalls, "different external flag should miss cache")
	})
}

func TestTeamK8sService_listAllTeams_Pagination(t *testing.T) {
	user42 := iamv0alpha1.User{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{Name: "user-uid-42", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
	}
	teamA := iamv0alpha1.Team{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{Name: "team-a", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
		Spec: iamv0alpha1.TeamSpec{
			Title:   "A",
			Members: []iamv0alpha1.TeamTeamMember{{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionMember}},
		},
	}
	teamB := iamv0alpha1.Team{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{Name: "team-b", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "20"}},
		Spec: iamv0alpha1.TeamSpec{
			Title:   "B",
			Members: []iamv0alpha1.TeamTeamMember{{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionMember}},
		},
	}

	var teamListCalls int
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path
		switch {
		case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "UserList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &user42)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
			teamListCalls++
			cont := r.URL.Query().Get("continue")
			if cont == "" {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
					"kind":       "TeamList",
					"metadata":   map[string]any{"resourceVersion": "1", "continue": "page-2"},
					"items":      []any{mustToUnstructured(t, &teamA)},
				})
			} else {
				assert.Equal(t, "page-2", cont, "second page request must echo the continue token")
				_ = json.NewEncoder(w).Encode(map[string]any{
					"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
					"kind":       "TeamList",
					"metadata":   map[string]any{"resourceVersion": "1"},
					"items":      []any{mustToUnstructured(t, &teamB)},
				})
			}
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}

	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()
	provider := &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
	svc := NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), provider, tracing.InitializeTracerForTest())

	ctx := contextWithReqContext()
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgID: 1})

	teams, err := svc.GetTeamsByUser(ctx, &team.GetTeamsByUserQuery{OrgID: 1, UserID: 42})
	require.NoError(t, err)
	assert.Equal(t, 2, teamListCalls, "listAllTeams must walk both pages")
	require.Len(t, teams, 2)
	uids := []string{teams[0].UID, teams[1].UID}
	assert.ElementsMatch(t, []string{"team-a", "team-b"}, uids)
}

func TestTeamK8sService_GetTeamMembers(t *testing.T) {
	tests := []struct {
		name           string
		query          *team.GetTeamMembersQuery
		requesterOrgID int64
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectMembers  int
		validate       func(t *testing.T, result []*team.TeamMemberDTO)
	}{
		{
			name:           "returns members by team ID",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamID: 10},
			serverResponse: membershipServerHandler(t),
			expectMembers:  1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, "user-uid-42", result[0].UserUID)
				assert.Equal(t, int64(42), result[0].UserID)
				assert.Equal(t, "team-uid-1", result[0].TeamUID)
				assert.Equal(t, int64(10), result[0].TeamID)
				assert.Equal(t, team.PermissionTypeAdmin, result[0].Permission)
				assert.Equal(t, "test@example.com", result[0].Email)
				assert.Equal(t, "Test User", result[0].Name)
				assert.Equal(t, "testuser", result[0].Login)
			},
		},
		{
			name:           "returns members by team UID with resolved team ID",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamUID: "team-uid-1"},
			serverResponse: membershipServerHandler(t),
			expectMembers:  1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, int64(10), result[0].TeamID)
				assert.Equal(t, "team-uid-1", result[0].TeamUID)
			},
		},
		{
			name:           "returns all members when team has multiple members",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamUID: "team-uid-1"},
			serverResponse: multiMembershipServerHandler(t),
			expectMembers:  2,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				byUserUID := map[string]*team.TeamMemberDTO{}
				for _, m := range result {
					byUserUID[m.UserUID] = m
				}
				require.Contains(t, byUserUID, "user-uid-42")
				require.Contains(t, byUserUID, "user-uid-99")
				assert.Equal(t, int64(42), byUserUID["user-uid-42"].UserID)
				assert.Equal(t, "user42@example.com", byUserUID["user-uid-42"].Email)
				assert.Equal(t, int64(99), byUserUID["user-uid-99"].UserID)
				assert.Equal(t, "user99@example.com", byUserUID["user-uid-99"].Email)
			},
		},
		{
			name:           "returns empty list when team has no bindings",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamID: 10},
			serverResponse: membershipServerHandlerWithEmptyBindings(t),
			expectMembers:  0,
		},
		{
			name:           "returns members with member permission",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamID: 10},
			serverResponse: membershipServerHandlerWithPermission(t, iamv0alpha1.TeamTeamPermissionMember),
			expectMembers:  1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, team.PermissionTypeMember, result[0].Permission)
			},
		},
		{
			name:           "filters out service-account members (matches legacy is_service_account=false join)",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamUID: "team-uid-1", TeamID: 10},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				userObj := iamv0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "user-uid-42", Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
					Spec:       iamv0alpha1.UserSpec{Login: "testuser", Email: "test@example.com", Title: "Test User"},
				}
				teamObj := iamv0alpha1.Team{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
					ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
					Spec: iamv0alpha1.TeamSpec{
						Title: "Team One",
						Members: []iamv0alpha1.TeamTeamMember{
							{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionMember},
							{Kind: "ServiceAccount", Name: "sa-uid-1", Permission: iamv0alpha1.TeamTeamPermissionMember},
						},
					},
				}
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/users/user-uid-42"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &userObj))
				case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-1"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &teamObj))
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectMembers: 1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, "user-uid-42", result[0].UserUID)
			},
		},
		{
			name:           "external=true filters out non-external members in-memory",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamUID: "team-uid-1", TeamID: 10, External: true},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				userObj := iamv0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "user-uid-99", Labels: map[string]string{"grafana.app/deprecatedInternalID": "99"}},
					Spec:       iamv0alpha1.UserSpec{Login: "extuser", Email: "ext@example.com"},
				}
				teamObj := iamv0alpha1.Team{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
					ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
					Spec: iamv0alpha1.TeamSpec{
						Title: "Team One",
						Members: []iamv0alpha1.TeamTeamMember{
							{Kind: "User", Name: "user-uid-42", External: false, Permission: iamv0alpha1.TeamTeamPermissionMember},
							{Kind: "User", Name: "user-uid-99", External: true, Permission: iamv0alpha1.TeamTeamPermissionMember},
						},
					},
				}
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-1"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &teamObj))
				case r.Method == http.MethodGet && strings.Contains(path, "/users/user-uid-99"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &userObj))
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectMembers: 1,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, "user-uid-99", result[0].UserUID)
				assert.True(t, result[0].External)
			},
		},
		{
			name:           "uses orgId from query",
			requesterOrgID: 5,
			query:          &team.GetTeamMembersQuery{OrgID: 99, TeamUID: "team-uid-1", TeamID: 10},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				assert.Contains(t, r.URL.Path, "org-99", "should use query.OrgID (99), not requester.OrgID (5)")
				if r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/teams/team-uid-1") {
					teamObj := iamv0alpha1.Team{
						TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
						ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "org-99", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
						Spec:       iamv0alpha1.TeamSpec{Title: "Team One"},
					}
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &teamObj))
					return
				}
				w.WriteHeader(http.StatusNotFound)
			},
			expectMembers: 0,
		},
		{
			name:           "sorts members by login then email",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamUID: "team-uid-1", TeamID: 10},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				userZ := iamv0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "user-z", Labels: map[string]string{"grafana.app/deprecatedInternalID": "1"}},
					Spec:       iamv0alpha1.UserSpec{Login: "zlogin", Email: "z@example.com"},
				}
				userA := iamv0alpha1.User{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
					ObjectMeta: metav1.ObjectMeta{Name: "user-a", Labels: map[string]string{"grafana.app/deprecatedInternalID": "2"}},
					Spec:       iamv0alpha1.UserSpec{Login: "alogin", Email: "a@example.com"},
				}
				teamObj := iamv0alpha1.Team{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
					ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
					Spec: iamv0alpha1.TeamSpec{
						Title: "Team One",
						// Insertion order is z, a — output must be a, z.
						Members: []iamv0alpha1.TeamTeamMember{
							{Kind: "User", Name: "user-z", Permission: iamv0alpha1.TeamTeamPermissionMember},
							{Kind: "User", Name: "user-a", Permission: iamv0alpha1.TeamTeamPermissionMember},
						},
					},
				}
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-1"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &teamObj))
				case r.Method == http.MethodGet && strings.Contains(path, "/users/user-z"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &userZ))
				case r.Method == http.MethodGet && strings.Contains(path, "/users/user-a"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &userA))
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectMembers: 2,
			validate: func(t *testing.T, result []*team.TeamMemberDTO) {
				assert.Equal(t, "alogin", result[0].Login)
				assert.Equal(t, "zlogin", result[1].Login)
			},
		},
		{
			name:           "returns error when listUsersByUIDs fails",
			requesterOrgID: 1,
			query:          &team.GetTeamMembersQuery{OrgID: 1, TeamUID: "team-uid-1", TeamID: 10},
			serverResponse: func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				path := r.URL.Path
				teamObj := iamv0alpha1.Team{
					TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
					ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
					Spec: iamv0alpha1.TeamSpec{
						Title:   "Team One",
						Members: []iamv0alpha1.TeamTeamMember{{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionMember}},
					},
				}
				switch {
				case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-1"):
					_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &teamObj))
				case r.Method == http.MethodGet && strings.Contains(path, "/users/user-uid-42"):
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Code: 500})
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			},
			expectErr: true,
		},
		{
			name:        "returns error when config provider not initialized",
			query:       &team.GetTeamMembersQuery{OrgID: 1, TeamID: 10},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			query:        &team.GetTeamMembersQuery{OrgID: 1, TeamID: 10},
			noReqContext: true,
			expectErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var svc *TeamK8sService
			if tt.nilProvider {
				svc = NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), nil, tracing.InitializeTracerForTest())
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()
				provider := &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
				svc = NewTeamK8sService(log.NewNopLogger(), setting.NewCfg(), provider, tracing.InitializeTracerForTest())
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

			result, err := svc.GetTeamMembers(ctx, tt.query)
			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Len(t, result, tt.expectMembers)
			if tt.validate != nil {
				tt.validate(t, result)
			}
		})
	}
}

func membershipServerHandler(t *testing.T) func(w http.ResponseWriter, r *http.Request) {
	t.Helper()
	return membershipServerHandlerWithPermission(t, iamv0alpha1.TeamTeamPermissionAdmin)
}

func membershipServerHandlerWithPermission(t *testing.T, perm iamv0alpha1.TeamTeamPermission) func(w http.ResponseWriter, r *http.Request) {
	t.Helper()

	userObj := iamv0alpha1.User{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "user-uid-42",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "42"},
		},
		Spec: iamv0alpha1.UserSpec{Login: "testuser", Email: "test@example.com", Title: "Test User"},
	}

	teamObj := iamv0alpha1.Team{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "team-uid-1",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "10"},
		},
		Spec: iamv0alpha1.TeamSpec{
			Title: "Team One",
			Email: "team@example.com",
			Members: []iamv0alpha1.TeamTeamMember{
				{Kind: "User", Name: "user-uid-42", Permission: perm, External: false},
			},
		},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path

		switch {
		case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "UserList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &userObj)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/users/user-uid-42"):
			_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &userObj))
		case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "TeamList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &teamObj)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-1"):
			_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &teamObj))
		default:
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Code: 404})
		}
	}
}

func membershipServerHandlerWithEmptyBindings(t *testing.T) func(w http.ResponseWriter, r *http.Request) {
	t.Helper()

	userObj := iamv0alpha1.User{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "user-uid-42",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "42"},
		},
		Spec: iamv0alpha1.UserSpec{Login: "testuser", Email: "test@example.com", Title: "Test User"},
	}

	teamObj := iamv0alpha1.Team{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "team-uid-1",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "10"},
		},
		Spec: iamv0alpha1.TeamSpec{Title: "Team One", Email: "team@example.com"},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path

		switch {
		case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "UserList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &userObj)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "TeamList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &teamObj)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-1"):
			_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &teamObj))
		default:
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Code: 404})
		}
	}
}

func multiMembershipServerHandler(t *testing.T) func(w http.ResponseWriter, r *http.Request) {
	t.Helper()

	user42 := iamv0alpha1.User{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "user-uid-42",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "42"},
		},
		Spec: iamv0alpha1.UserSpec{Login: "user42", Email: "user42@example.com", Title: "User 42"},
	}
	user99 := iamv0alpha1.User{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "user-uid-99",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "99"},
		},
		Spec: iamv0alpha1.UserSpec{Login: "user99", Email: "user99@example.com", Title: "User 99"},
	}
	team1 := iamv0alpha1.Team{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "team-uid-1",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "10"},
		},
		Spec: iamv0alpha1.TeamSpec{
			Title: "Team One",
			Email: "team1@example.com",
			Members: []iamv0alpha1.TeamTeamMember{
				{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionAdmin},
				{Kind: "User", Name: "user-uid-99", Permission: iamv0alpha1.TeamTeamPermissionMember},
			},
		},
	}
	team2 := iamv0alpha1.Team{
		TypeMeta: metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "team-uid-2",
			Namespace: "org-1",
			Labels:    map[string]string{"grafana.app/deprecatedInternalID": "20"},
		},
		Spec: iamv0alpha1.TeamSpec{
			Title: "Team Two",
			Email: "team2@example.com",
			Members: []iamv0alpha1.TeamTeamMember{
				{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionMember},
			},
		},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path

		switch {
		case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "UserList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &user42)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/users/user-uid-42"):
			_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &user42))
		case r.Method == http.MethodGet && strings.Contains(path, "/users/user-uid-99"):
			_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &user99))
		case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-1"):
			_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &team1))
		case r.Method == http.MethodGet && strings.Contains(path, "/teams/team-uid-2"):
			_ = json.NewEncoder(w).Encode(mustToUnstructured(t, &team2))
		case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "TeamList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &team1), mustToUnstructured(t, &team2)},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Code: 404})
		}
	}
}

func teamListResponse(name, namespace, title, email string) map[string]any {
	return map[string]any{
		"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
		"kind":       "TeamList",
		"metadata":   map[string]any{},
		"items": []any{
			map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "Team",
				"metadata": map[string]any{
					"name":      name,
					"namespace": namespace,
				},
				"spec": map[string]any{
					"title": title,
					"email": email,
				},
			},
		},
	}
}

func teamListResponseWithProvisioned(name, namespace, title, email string) map[string]any {
	return map[string]any{
		"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
		"kind":       "TeamList",
		"metadata":   map[string]any{},
		"items": []any{
			map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "Team",
				"metadata": map[string]any{
					"name":      name,
					"namespace": namespace,
				},
				"spec": map[string]any{
					"title":       title,
					"email":       email,
					"provisioned": true,
				},
			},
		},
	}
}

func emptyTeamListResponse() map[string]any {
	return map[string]any{
		"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
		"kind":       "TeamList",
		"metadata":   map[string]any{},
		"items":      []any{},
	}
}

// reversedMultiMembershipServerHandler returns the team list in id-desc order
// so callers that expect id-asc output fail unless they sort.
func reversedMultiMembershipServerHandler(t *testing.T) func(w http.ResponseWriter, r *http.Request) {
	t.Helper()

	user42 := iamv0alpha1.User{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{Name: "user-uid-42", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
		Spec:       iamv0alpha1.UserSpec{Login: "user42", Email: "user42@example.com", Title: "User 42"},
	}
	team1 := iamv0alpha1.Team{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{Name: "team-uid-1", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "10"}},
		Spec: iamv0alpha1.TeamSpec{
			Title:   "Team One",
			Members: []iamv0alpha1.TeamTeamMember{{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionAdmin}},
		},
	}
	team2 := iamv0alpha1.Team{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{Name: "team-uid-2", Namespace: "org-1", Labels: map[string]string{"grafana.app/deprecatedInternalID": "20"}},
		Spec: iamv0alpha1.TeamSpec{
			Title:   "Team Two",
			Members: []iamv0alpha1.TeamTeamMember{{Kind: "User", Name: "user-uid-42", Permission: iamv0alpha1.TeamTeamPermissionMember}},
		},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path
		switch {
		case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "UserList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &user42)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "TeamList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &team2), mustToUnstructured(t, &team1)},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

func teamListErrorHandler(t *testing.T) func(w http.ResponseWriter, r *http.Request) {
	t.Helper()
	userObj := iamv0alpha1.User{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{Name: "user-uid-42", Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
	}
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path
		switch {
		case r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "UserList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{mustToUnstructured(t, &userObj)},
			})
		case r.Method == http.MethodGet && strings.Contains(path, "/teams") && !strings.Contains(path, "/teams/"):
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Code: 500})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

// userNotFoundHandler returns an empty UserList for any label-selector lookup
// so resolveUserUID yields user.ErrUserNotFound.
func userNotFoundHandler(t *testing.T) func(w http.ResponseWriter, r *http.Request) {
	t.Helper()
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path
		if r.Method == http.MethodGet && strings.Contains(path, "/users") && !strings.Contains(path, "/users/") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"apiVersion": iamv0alpha1.GroupVersion.Identifier(),
				"kind":       "UserList",
				"metadata":   map[string]any{"resourceVersion": "1"},
				"items":      []any{},
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}
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
