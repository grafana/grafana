package teamk8s

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/team"
)

func TestTeamK8sService_CreateTeam(t *testing.T) {
	tests := []struct {
		name       string
		cmd        *team.CreateTeamCommand
		setupMock  func(*mockResourceClient)
		nilClient  bool
		expectErr  bool
		expectTeam team.Team
	}{
		{
			name: "successfully creates a team",
			cmd: &team.CreateTeamCommand{
				Name:  "Test Team",
				Email: "team@example.com",
				OrgID: 1,
			},
			setupMock: func(m *mockResourceClient) {
				now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
				returnedTeam := &iamv0alpha1.Team{
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
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, resource.CreateOptions{}).
					Return(returnedTeam, nil)
			},
			expectTeam: team.Team{
				UID:     "some-uid",
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
			setupMock: func(m *mockResourceClient) {
				returnedTeam := &iamv0alpha1.Team{
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
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, resource.CreateOptions{}).
					Return(returnedTeam, nil)
			},
			expectTeam: team.Team{
				UID:           "new-uid",
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
			setupMock: func(m *mockResourceClient) {
				m.On("Create", mock.Anything, mock.Anything, mock.Anything, resource.CreateOptions{}).
					Return(nil, errors.New("k8s error"))
			},
			expectErr: true,
		},
		{
			name:      "returns error when client is not initialized",
			cmd:       &team.CreateTeamCommand{Name: "Any Team", OrgID: 1},
			nilClient: true,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := NewTeamK8sService(log.NewNopLogger(), nil, nil)

			if !tt.nilClient {
				mockClient := new(mockResourceClient)
				tt.setupMock(mockClient)
				svc.teamClient = iamv0alpha1.NewTeamClient(mockClient)
				defer mockClient.AssertExpectations(t)
			}

			result, err := svc.CreateTeam(context.Background(), tt.cmd)

			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectTeam.UID, result.UID)
			assert.Equal(t, tt.expectTeam.OrgID, result.OrgID)
			assert.Equal(t, tt.expectTeam.Name, result.Name)
			assert.Equal(t, tt.expectTeam.Email, result.Email)
			assert.Equal(t, tt.expectTeam.ExternalUID, result.ExternalUID)
			assert.Equal(t, tt.expectTeam.IsProvisioned, result.IsProvisioned)
			assert.Equal(t, tt.expectTeam.Created, result.Created)
		})
	}
}

// mockResourceClient implements resource.Client for testing.
type mockResourceClient struct {
	mock.Mock
}

func (m *mockResourceClient) Get(ctx context.Context, identifier resource.Identifier) (resource.Object, error) {
	args := m.Called(ctx, identifier)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(resource.Object), args.Error(1)
}

func (m *mockResourceClient) GetInto(ctx context.Context, identifier resource.Identifier, into resource.Object) error {
	args := m.Called(ctx, identifier, into)
	return args.Error(0)
}

func (m *mockResourceClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error) {
	args := m.Called(ctx, namespace, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(resource.ListObject), args.Error(1)
}

func (m *mockResourceClient) ListInto(ctx context.Context, namespace string, opts resource.ListOptions, into resource.ListObject) error {
	args := m.Called(ctx, namespace, opts, into)
	return args.Error(0)
}

func (m *mockResourceClient) Create(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
	args := m.Called(ctx, identifier, obj, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(resource.Object), args.Error(1)
}

func (m *mockResourceClient) CreateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.CreateOptions, into resource.Object) error {
	args := m.Called(ctx, identifier, obj, opts, into)
	return args.Error(0)
}

func (m *mockResourceClient) Update(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	args := m.Called(ctx, identifier, obj, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(resource.Object), args.Error(1)
}

func (m *mockResourceClient) UpdateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.UpdateOptions, into resource.Object) error {
	args := m.Called(ctx, identifier, obj, opts, into)
	return args.Error(0)
}

func (m *mockResourceClient) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, opts resource.PatchOptions) (resource.Object, error) {
	args := m.Called(ctx, identifier, patch, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(resource.Object), args.Error(1)
}

func (m *mockResourceClient) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, opts resource.PatchOptions, into resource.Object) error {
	args := m.Called(ctx, identifier, patch, opts, into)
	return args.Error(0)
}

func (m *mockResourceClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	args := m.Called(ctx, identifier, opts)
	return args.Error(0)
}

func (m *mockResourceClient) Watch(_ context.Context, _ string, _ resource.WatchOptions) (resource.WatchResponse, error) {
	return nil, nil
}

func (m *mockResourceClient) SubresourceRequest(ctx context.Context, identifier resource.Identifier, opts resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, nil
}
