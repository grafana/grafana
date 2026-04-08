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
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider)
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
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil)
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
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider)
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
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
	}{
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
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider)
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
				svc = NewTeamK8sService(log.NewNopLogger(), cfg, nil)
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
				svc = NewTeamK8sService(log.NewNopLogger(), cfg, provider)
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
				svc = NewTeamK8sService(log.NewNopLogger(), nil, nil)
			} else {
				ts := httptest.NewServer(http.HandlerFunc(tt.serverResponse))
				defer ts.Close()

				provider := &mockDirectRestConfigProvider{
					restConfig: &clientrest.Config{Host: ts.URL},
				}
				svc = NewTeamK8sService(log.NewNopLogger(), nil, provider)
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
