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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
)

func TestTeamK8sService_CreateTeam(t *testing.T) {
	tests := []struct {
		name           string
		cmd            *team.CreateTeamCommand
		serverResponse func(w http.ResponseWriter, r *http.Request)
		nilProvider    bool
		noReqContext   bool
		expectErr      bool
		expectTeam     team.Team
	}{
		{
			name: "successfully creates a team",
			cmd: &team.CreateTeamCommand{
				Name:  "Test Team",
				Email: "team@example.com",
				OrgID: 1,
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
			name: "maps ExternalUID and IsProvisioned fields",
			cmd: &team.CreateTeamCommand{
				Name:          "Provisioned Team",
				OrgID:         2,
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
			name: "propagates error from k8s client",
			cmd: &team.CreateTeamCommand{
				Name:  "Failing Team",
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
			cmd:         &team.CreateTeamCommand{Name: "Any Team", OrgID: 1},
			nilProvider: true,
			expectErr:   true,
		},
		{
			name:         "returns error when no request context",
			cmd:          &team.CreateTeamCommand{Name: "Any Team", OrgID: 1},
			noReqContext: true,
			expectErr:    true,
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
