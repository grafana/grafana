package teamapi

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSetTeamMembershipsViaK8s_Success(t *testing.T) {
	const (
		adminEmail     = "admin@example.com"
		memberEmail    = "member@example.com"
		oldMemberEmail = "old-member@example.com"
		adminUserID    = int64(10)
		memberUserID   = int64(20)
		oldMemberID    = int64(30)
	)

	s := setupTest(t)

	cmd := team.SetTeamMembershipsCommand{
		Admins:  []string{adminEmail},
		Members: []string{memberEmail},
	}
	s.mockUserExists(adminEmail, adminUserID)
	s.mockUserExists(memberEmail, memberUserID)

	s.mockUserExistsForGetByID(oldMemberID, oldMemberEmail)

	existingBindings := &iamv0alpha1.TeamBindingList{
		Items: []iamv0alpha1.TeamBinding{
			s.createExistingBinding(oldMemberID, iamv0alpha1.TeamBindingTeamPermissionMember),
		},
	}
	s.mockListBindings(existingBindings)

	s.mockCreateBinding(adminUserID, iamv0alpha1.TeamBindingTeamPermissionAdmin, nil)
	s.mockCreateBinding(memberUserID, iamv0alpha1.TeamBindingTeamPermissionMember, nil)

	oldBindingName := fmt.Sprintf("tb-%s-%d", s.teamName, oldMemberID)
	s.mockDeleteBinding(oldBindingName)

	resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, cmd)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusOK, resp.Status())

	bodyBytes := resp.Body()
	bodyStr := string(bodyBytes)
	assert.Contains(t, bodyStr, "Team memberships have been updated")

	s.mockResClient.AssertExpectations(t)

	s.mockResClient.AssertCalled(t, "List", mock.Anything, s.namespace, mock.Anything)
	s.mockResClient.AssertCalled(t, "Delete", mock.Anything, resource.Identifier{
		Namespace: s.namespace,
		Name:      oldBindingName,
	}, resource.DeleteOptions{})

	// Verify we created exactly 2 bindings (1 admin, 1 member)
	s.mockResClient.AssertNumberOfCalls(t, "Create", 2)
	// Verify we deleted exactly 1 binding
	s.mockResClient.AssertNumberOfCalls(t, "Delete", 1)
}

func TestCheckAndCreateBindingUpdate(t *testing.T) {
	tests := []struct {
		name             string
		binding          iamv0alpha1.TeamBinding
		userEmail        string
		emailsMap        map[string]struct{}
		targetPermission iamv0alpha1.TeamBindingTeamPermission
		expectWasFound   bool
		expectMapEmpty   bool
	}{
		{
			name: "user not in map",
			binding: iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Permission: iamv0alpha1.TeamBindingTeamPermissionMember,
				},
			},
			userEmail:        "user@example.com",
			emailsMap:        map[string]struct{}{},
			targetPermission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
			expectWasFound:   false,
			expectMapEmpty:   true,
		},
		{
			name: "user in map, permission matches",
			binding: iamv0alpha1.TeamBinding{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "tb-1-1",
					Namespace: "org-1",
				},
				Spec: iamv0alpha1.TeamBindingSpec{
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			userEmail: "user@example.com",
			emailsMap: map[string]struct{}{
				"user@example.com": {},
			},
			targetPermission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
			expectWasFound:   true,
			expectMapEmpty:   true,
		},
		{
			name: "user in map, permission differs - needs update",
			binding: iamv0alpha1.TeamBinding{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "tb-1-1",
					Namespace: "org-1",
				},
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Name: "1",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionMember,
				},
			},
			userEmail: "user@example.com",
			emailsMap: map[string]struct{}{
				"user@example.com": {},
			},
			targetPermission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
			expectWasFound:   true,
			expectMapEmpty:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wasFound, update := checkAndCreateBindingUpdate(
				tt.binding,
				tt.userEmail,
				tt.emailsMap,
				tt.targetPermission,
			)

			assert.Equal(t, tt.expectWasFound, wasFound, "wasFound mismatch")

			if tt.expectMapEmpty {
				assert.Empty(t, tt.emailsMap, "emailsMap should be empty after processing")
			}

			if update != nil {
				assert.NotNil(t, update, "updated binding should not be nil")
				assert.Equal(t, tt.targetPermission, update.Spec.Permission, "permission should be updated")
			}
		})
	}
}

// testSetup contains common test setup for setTeamMembershipsViaK8s tests
type testSetup struct {
	ctx               context.Context
	teamID            int64
	orgID             int64
	namespace         string
	teamName          string
	mockResClient     *mockResourceClient
	mockUserSvc       *usertest.MockService
	teamBindingClient *iamv0alpha1.TeamBindingClient
	tapi              *TeamAPI
	reqContext        *contextmodel.ReqContext
}

func setupTest(t *testing.T) *testSetup {
	ctx := context.Background()
	teamID := int64(1)
	orgID := int64(1)

	mockResClient := new(mockResourceClient)
	mockUserSvc := usertest.NewMockService(t)
	teamBindingClient := iamv0alpha1.NewTeamBindingClient(mockResClient)

	mockFactory := NewMockTeamBindingClientFactory(t)
	mockFactory.On("GetClient", mock.Anything).Return(teamBindingClient, nil)

	tapi := &TeamAPI{
		teamBindingClientFactory: mockFactory,
		userService:              mockUserSvc,
		logger:                   log.NewNopLogger(),
	}

	reqContext := &contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{},
		},
		SignedInUser: &user.SignedInUser{
			UserID:    1,
			OrgID:     orgID,
			Namespace: fmt.Sprintf("org-%d", orgID),
		},
	}
	reqContext.Req = reqContext.Req.WithContext(ctx)

	return &testSetup{
		ctx:               ctx,
		teamID:            teamID,
		orgID:             orgID,
		namespace:         fmt.Sprintf("org-%d", orgID),
		teamName:          fmt.Sprintf("%d", teamID),
		mockResClient:     mockResClient,
		mockUserSvc:       mockUserSvc,
		teamBindingClient: teamBindingClient,
		tapi:              tapi,
		reqContext:        reqContext,
	}
}

func (s *testSetup) mockUserExists(email string, userID int64) {
	s.mockUserSvc.On("GetByEmail", mock.Anything, &user.GetUserByEmailQuery{Email: email}).
		Return(&user.User{ID: userID, Email: email}, nil)
}

func (s *testSetup) mockUserExistsForGetByID(userID int64, email string) {
	s.mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: userID}).
		Return(&user.User{ID: userID, Email: email}, nil)
}

func (s *testSetup) mockListBindings(bindings *iamv0alpha1.TeamBindingList) {
	s.mockResClient.On("List", mock.Anything, s.namespace, mock.MatchedBy(func(opts resource.ListOptions) bool {
		return len(opts.FieldSelectors) == 1 && opts.FieldSelectors[0] == fmt.Sprintf("spec.teamRef.name=%s", s.teamName)
	})).Return(bindings, nil)
}

func (s *testSetup) mockCreateBinding(userID int64, permission iamv0alpha1.TeamBindingTeamPermission, returnErr error) *iamv0alpha1.TeamBinding {
	binding := &iamv0alpha1.TeamBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("tb-%s-%d", s.teamName, userID),
			Namespace: s.namespace,
		},
		Spec: iamv0alpha1.TeamBindingSpec{
			Subject: iamv0alpha1.TeamBindingspecSubject{
				Name: fmt.Sprintf("%d", userID),
			},
			TeamRef: iamv0alpha1.TeamBindingTeamRef{
				Name: s.teamName,
			},
			Permission: permission,
			External:   false,
		},
	}

	userIDStr := fmt.Sprintf("%d", userID)
	s.mockResClient.On("Create", mock.Anything, mock.MatchedBy(func(id resource.Identifier) bool {
		return id.Namespace == s.namespace
	}), mock.MatchedBy(func(obj resource.Object) bool {
		if b, ok := obj.(*iamv0alpha1.TeamBinding); ok {
			return b.Spec.Subject.Name == userIDStr && b.Spec.Permission == permission
		}
		return false
	}), resource.CreateOptions{}).Return(binding, returnErr).Once()

	return binding
}

func (s *testSetup) mockDeleteBinding(bindingName string) {
	s.mockResClient.On("Delete", mock.Anything, resource.Identifier{
		Namespace: s.namespace,
		Name:      bindingName,
	}, resource.DeleteOptions{}).Return(nil).Once()
}

func (s *testSetup) createExistingBinding(userID int64, permission iamv0alpha1.TeamBindingTeamPermission) iamv0alpha1.TeamBinding {
	return iamv0alpha1.TeamBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("tb-%s-%d", s.teamName, userID),
			Namespace: s.namespace,
		},
		Spec: iamv0alpha1.TeamBindingSpec{
			Subject: iamv0alpha1.TeamBindingspecSubject{
				Name: fmt.Sprintf("%d", userID),
			},
			TeamRef: iamv0alpha1.TeamBindingTeamRef{
				Name: s.teamName,
			},
			Permission: permission,
		},
	}
}

// mockResourceClient wraps the mock to implement resource.Client interface
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

func (m *mockResourceClient) UpdateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.UpdateOptions, into resource.Object) error {
	args := m.Called(ctx, identifier, obj, opts, into)
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
