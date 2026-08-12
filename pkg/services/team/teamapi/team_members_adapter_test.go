package teamapi

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/web"
)

func TestSetTeamMembershipsViaK8s(t *testing.T) {
	const (
		adminEmail    = "admin@example.com"
		memberEmail   = "member@example.com"
		newEmail      = "new@example.com"
		adminUID      = "user-admin-uid"
		memberUID     = "user-member-uid"
		newUID        = "user-new-uid"
		externalUID   = "user-external-uid"
		externalEmail = "external@example.com"
	)

	t.Run("upserts desired non-external users and drops omitted ones", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)
		s.mockUserByEmail(memberEmail, memberUID)

		// Existing: an admin user we'll keep, an old member we'll drop.
		s.mockTeamGet(makeTeam(s.teamUID,
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: adminUID, Permission: iamv0alpha1.TeamTeamPermissionMember},
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: "to-be-dropped", Permission: iamv0alpha1.TeamTeamPermissionMember},
		))
		s.mockTeamUpdate(func(t2 *iamv0alpha1.Team) {
			require.Len(t, t2.Spec.Members, 2)
			byName := membersByName(t2.Spec.Members)
			require.Contains(t, byName, adminUID)
			require.Contains(t, byName, memberUID)
			require.NotContains(t, byName, "to-be-dropped")
			assert.Equal(t, iamv0alpha1.TeamTeamPermissionAdmin, byName[adminUID].Permission)
			assert.Equal(t, iamv0alpha1.TeamTeamPermissionMember, byName[memberUID].Permission)
		})

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins:  []string{adminEmail},
			Members: []string{memberEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("drops external members not in the request (matches legacy SQL)", func(t *testing.T) {
		// Legacy SQL behavior: the bulk endpoint doesn't filter by External, so
		// an external member omitted from the request is removed. Team-sync
		// will re-add them on the next reconciliation, but the row is deleted
		// in the meantime.
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)

		s.mockTeamGet(makeTeam(s.teamUID,
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: externalUID, Permission: iamv0alpha1.TeamTeamPermissionMember, External: true},
		))
		s.mockTeamUpdate(func(t2 *iamv0alpha1.Team) {
			byName := membersByName(t2.Spec.Members)
			require.NotContains(t, byName, externalUID, "external member should be dropped when omitted")
			require.Contains(t, byName, adminUID)
		})

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("updates external member permission and preserves External flag", func(t *testing.T) {
		// Legacy SQL behavior: column-scoped Update on permission leaves the
		// External=true flag intact. The K8s path mirrors that — the member is
		// re-emitted with the new permission and External: true unchanged.
		s := setupTest(t)
		s.mockUserByEmail(externalEmail, externalUID)

		s.mockTeamGet(makeTeam(s.teamUID,
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: externalUID, Permission: iamv0alpha1.TeamTeamPermissionMember, External: true},
		))
		s.mockTeamUpdate(func(t2 *iamv0alpha1.Team) {
			byName := membersByName(t2.Spec.Members)
			require.Contains(t, byName, externalUID)
			assert.Equal(t, iamv0alpha1.TeamTeamPermissionAdmin, byName[externalUID].Permission, "permission should be flipped to Admin")
			assert.True(t, byName[externalUID].External, "External flag must be preserved")
		})

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{externalEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("404 with missing email list before any K8s call", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserMissing("ghost@example.com")

		// No Get/Update expected on the resource client.
		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{"ghost@example.com"},
		})
		assert.Equal(t, http.StatusNotFound, resp.Status())
		assert.Contains(t, string(resp.Body()), "ghost@example.com")
		s.mockResClient.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
		s.mockResClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("admin wins over member when same email is in both lists", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)

		s.mockTeamGet(makeTeam(s.teamUID))
		s.mockTeamUpdate(func(t2 *iamv0alpha1.Team) {
			require.Len(t, t2.Spec.Members, 1)
			assert.Equal(t, iamv0alpha1.TeamTeamPermissionAdmin, t2.Spec.Members[0].Permission)
		})

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins:  []string{adminEmail},
			Members: []string{adminEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("idempotent request triggers no Update", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)
		s.mockUserByEmail(memberEmail, memberUID)

		s.mockTeamGet(makeTeam(s.teamUID,
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: adminUID, Permission: iamv0alpha1.TeamTeamPermissionAdmin},
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: memberUID, Permission: iamv0alpha1.TeamTeamPermissionMember},
		))

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins:  []string{adminEmail},
			Members: []string{memberEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
		s.mockResClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("empty cmd on empty team triggers no Update", func(t *testing.T) {
		// Pins the slices.Equal(nil, []T{}) edge case: the rebuild produces an
		// empty slice and the input is nil; both must compare equal so the
		// no-op short-circuit fires.
		s := setupTest(t)
		s.mockTeamGet(makeTeam(s.teamUID))

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{})
		require.Equal(t, http.StatusOK, resp.Status())
		s.mockResClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("idempotent when external member is included in request with same permission", func(t *testing.T) {
		// External member listed with the same permission they already have →
		// rebuildSpecMembers re-emits the entry unchanged (External flag
		// preserved) and slices.Equal short-circuits the Update.
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)
		s.mockUserByEmail(externalEmail, externalUID)

		s.mockTeamGet(makeTeam(s.teamUID,
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: adminUID, Permission: iamv0alpha1.TeamTeamPermissionAdmin},
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: externalUID, Permission: iamv0alpha1.TeamTeamPermissionMember, External: true},
		))

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins:  []string{adminEmail},
			Members: []string{externalEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
		s.mockResClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("new user appended at end", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(newEmail, newUID)

		s.mockTeamGet(makeTeam(s.teamUID))
		s.mockTeamUpdate(func(t2 *iamv0alpha1.Team) {
			require.Len(t, t2.Spec.Members, 1)
			assert.Equal(t, newUID, t2.Spec.Members[0].Name)
		})

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Members: []string{newEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("empty admins+members removes all User members including external", func(t *testing.T) {
		// Matches legacy: an empty request is "the complete desired set is
		// nobody," and external members get swept along with the rest.
		s := setupTest(t)

		s.mockTeamGet(makeTeam(s.teamUID,
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: adminUID, Permission: iamv0alpha1.TeamTeamPermissionAdmin},
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: memberUID, Permission: iamv0alpha1.TeamTeamPermissionMember},
			iamv0alpha1.TeamTeamMember{Kind: "User", Name: externalUID, Permission: iamv0alpha1.TeamTeamPermissionMember, External: true},
			iamv0alpha1.TeamTeamMember{Kind: "ServiceAccount", Name: "sa-uid", Permission: iamv0alpha1.TeamTeamPermissionMember},
		))
		s.mockTeamUpdate(func(t2 *iamv0alpha1.Team) {
			require.Len(t, t2.Spec.Members, 1, "only ServiceAccount should remain — non-User entries pass through")
			assert.Equal(t, "ServiceAccount", t2.Spec.Members[0].Kind)
			assert.Equal(t, "sa-uid", t2.Spec.Members[0].Name)
		})

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{})
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("preserves non-user member kinds (e.g. ServiceAccount)", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)

		s.mockTeamGet(makeTeam(s.teamUID,
			iamv0alpha1.TeamTeamMember{Kind: "ServiceAccount", Name: "sa-uid", Permission: iamv0alpha1.TeamTeamPermissionMember},
		))
		s.mockTeamUpdate(func(t2 *iamv0alpha1.Team) {
			byName := membersByName(t2.Spec.Members)
			require.Contains(t, byName, "sa-uid", "service account member must be preserved")
			assert.Equal(t, "ServiceAccount", byName["sa-uid"].Kind)
			require.Contains(t, byName, adminUID)
		})

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status())
	})

	t.Run("retries on conflict and succeeds", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)

		// Fresh team per Get so a mutated Spec.Members from the first attempt
		// doesn't leak into the retry's read.
		s.mockResClient.On("Get", mock.Anything, resource.Identifier{Namespace: s.namespace, Name: s.teamUID}).
			Return(func(_ context.Context, _ resource.Identifier) resource.Object {
				return makeTeam(s.teamUID)
			}, nil)

		updateCalls := 0
		s.mockResClient.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(
				func(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.UpdateOptions) resource.Object {
					updateCalls++
					if updateCalls == 1 {
						return nil
					}
					return obj
				},
				func(_ context.Context, _ resource.Identifier, _ resource.Object, _ resource.UpdateOptions) error {
					if updateCalls == 1 {
						return k8serrors.NewConflict(schema.GroupResource{Group: "iam.grafana.app", Resource: "teams"}, s.teamUID, fmt.Errorf("rv mismatch"))
					}
					return nil
				},
			)

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		require.Equal(t, http.StatusOK, resp.Status(), "body=%s", string(resp.Body()))
		assert.Equal(t, 2, updateCalls, "should retry Update exactly once after conflict")
		s.mockResClient.AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("non-conflict Update error returns 500 without retry", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)

		s.mockResClient.On("Get", mock.Anything, resource.Identifier{Namespace: s.namespace, Name: s.teamUID}).
			Return(makeTeam(s.teamUID), nil).Once()
		s.mockResClient.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("apiserver unavailable")).Once()

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		assert.Equal(t, http.StatusInternalServerError, resp.Status())
		s.mockResClient.AssertNumberOfCalls(t, "Get", 1)
		s.mockResClient.AssertNumberOfCalls(t, "Update", 1)
	})

	t.Run("non-NotFound user lookup error returns 500 before any K8s call", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserSvc.On("GetByEmail", mock.Anything, &user.GetUserByEmailQuery{Email: adminEmail}).
			Return(nil, fmt.Errorf("user store unavailable"))

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		assert.Equal(t, http.StatusInternalServerError, resp.Status())
		s.mockResClient.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
		s.mockResClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("teamService.GetTeamByID error returns 404", func(t *testing.T) {
		s := setupTest(t)
		s.mockTeamSvc.ExpectedError = team.ErrTeamNotFound
		// Ensure no K8s call is attempted.
		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		assert.Equal(t, http.StatusNotFound, resp.Status())
		s.mockResClient.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
	})

	t.Run("teamClientFactory error returns 503", func(t *testing.T) {
		s := setupTest(t)
		// Factory check runs before resolveDesiredMembers, so userService is not
		// touched on this path.
		failingFactory := NewMockTeamClientFactory(t)
		failingFactory.On("GetClient", mock.Anything).Return(nil, fmt.Errorf("rest config not available"))
		s.tapi.teamClientFactory = failingFactory

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		assert.Equal(t, http.StatusServiceUnavailable, resp.Status())
		s.mockResClient.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
	})

	t.Run("teamClient.Get NotFound returns 404", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)
		s.mockResClient.On("Get", mock.Anything, resource.Identifier{Namespace: s.namespace, Name: s.teamUID}).
			Return(nil, k8serrors.NewNotFound(schema.GroupResource{Group: "iam.grafana.app", Resource: "teams"}, s.teamUID))

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		assert.Equal(t, http.StatusNotFound, resp.Status())
		s.mockResClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("teamClient.Get non-conflict error does not retry", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)
		s.mockResClient.On("Get", mock.Anything, resource.Identifier{Namespace: s.namespace, Name: s.teamUID}).
			Return(nil, fmt.Errorf("apiserver unavailable")).Once()

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		assert.Equal(t, http.StatusInternalServerError, resp.Status())
		s.mockResClient.AssertNumberOfCalls(t, "Get", 1)
		s.mockResClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("retry exhaustion returns 500", func(t *testing.T) {
		s := setupTest(t)
		s.mockUserByEmail(adminEmail, adminUID)
		s.mockResClient.On("Get", mock.Anything, resource.Identifier{Namespace: s.namespace, Name: s.teamUID}).
			Return(func(_ context.Context, _ resource.Identifier) resource.Object {
				return makeTeam(s.teamUID)
			}, nil)
		s.mockResClient.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, k8serrors.NewConflict(schema.GroupResource{Group: "iam.grafana.app", Resource: "teams"}, s.teamUID, fmt.Errorf("rv mismatch")))

		resp := s.tapi.setTeamMembershipsViaK8s(s.reqContext, s.teamID, team.SetTeamMembershipsCommand{
			Admins: []string{adminEmail},
		})
		assert.Equal(t, http.StatusInternalServerError, resp.Status())
		// retry.DefaultRetry attempts up to 5 times. Assert we tried more than once.
		updateCalls := len(s.mockResClient.Calls) // includes Get + Update; close enough as a smoke check.
		assert.Greater(t, updateCalls, 2, "retry should have attempted Update more than once")
	})

	t.Run("deterministic ordering when appending new members", func(t *testing.T) {
		// Run rebuildSpecMembers many times with the same input — output order must be stable.
		desired := map[string]iamv0alpha1.TeamTeamPermission{
			"uid-c": iamv0alpha1.TeamTeamPermissionMember,
			"uid-a": iamv0alpha1.TeamTeamPermissionAdmin,
			"uid-b": iamv0alpha1.TeamTeamPermissionMember,
		}
		first := rebuildSpecMembers(nil, desired)
		for range 50 {
			got := rebuildSpecMembers(nil, desired)
			require.Equal(t, first, got, "rebuildSpecMembers must be deterministic for the same input")
		}
		// Sanity: sorted by UID.
		names := []string{first[0].Name, first[1].Name, first[2].Name}
		assert.Equal(t, []string{"uid-a", "uid-b", "uid-c"}, names)
	})
}

// --- test scaffolding ---

type testSetup struct {
	teamID        int64
	teamUID       string
	namespace     string
	mockResClient *mockResourceClient
	mockUserSvc   *usertest.MockService
	mockTeamSvc   *teamtest.FakeService
	tapi          *TeamAPI
	reqContext    *contextmodel.ReqContext
}

func setupTest(t *testing.T) *testSetup {
	t.Helper()
	ctx := context.Background()
	teamID := int64(1)
	teamUID := "team-test-uid"
	orgID := int64(1)
	namespace := fmt.Sprintf("org-%d", orgID)

	mockResClient := new(mockResourceClient)
	mockUserSvc := usertest.NewMockService(t)
	mockTeamSvc := &teamtest.FakeService{
		ExpectedTeamDTO: &team.TeamDTO{ID: teamID, UID: teamUID},
	}
	teamClient := iamv0alpha1.NewTeamClient(mockResClient)

	mockFactory := NewMockTeamClientFactory(t)
	mockFactory.On("GetClient", mock.Anything).Return(teamClient, nil).Maybe()

	tapi := &TeamAPI{
		teamClientFactory: mockFactory,
		userService:       mockUserSvc,
		teamService:       mockTeamSvc,
		logger:            log.NewNopLogger(),
	}

	reqContext := &contextmodel.ReqContext{
		Context: &web.Context{Req: &http.Request{}},
		SignedInUser: &user.SignedInUser{
			UserID: 1, OrgID: orgID, Namespace: namespace,
		},
	}
	reqContext.Req = reqContext.Req.WithContext(ctx)
	// Mirror what request middleware sets — the K8s client uses this namespace.
	reqContext.Namespace = namespace

	return &testSetup{
		teamID:        teamID,
		teamUID:       teamUID,
		namespace:     namespace,
		mockResClient: mockResClient,
		mockUserSvc:   mockUserSvc,
		mockTeamSvc:   mockTeamSvc,
		tapi:          tapi,
		reqContext:    reqContext,
	}
}

func (s *testSetup) mockUserByEmail(email, uid string) {
	s.mockUserSvc.On("GetByEmail", mock.Anything, &user.GetUserByEmailQuery{Email: email}).
		Return(&user.User{UID: uid, Email: email}, nil)
}

func (s *testSetup) mockUserMissing(email string) {
	s.mockUserSvc.On("GetByEmail", mock.Anything, &user.GetUserByEmailQuery{Email: email}).
		Return(nil, user.ErrUserNotFound)
}

func (s *testSetup) mockTeamGet(t *iamv0alpha1.Team) {
	s.mockResClient.On("Get", mock.Anything, resource.Identifier{Namespace: s.namespace, Name: s.teamUID}).
		Return(t, nil)
}

// mockTeamUpdate asserts an Update call and lets the test inspect the new Team object.
func (s *testSetup) mockTeamUpdate(inspect func(t *iamv0alpha1.Team)) {
	s.mockResClient.On("Update", mock.Anything, mock.Anything, mock.MatchedBy(func(obj resource.Object) bool {
		t, ok := obj.(*iamv0alpha1.Team)
		if !ok {
			return false
		}
		if inspect != nil {
			inspect(t)
		}
		return true
	}), mock.Anything).Return(func(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.UpdateOptions) resource.Object {
		return obj
	}, nil)
}

func makeTeam(uid string, members ...iamv0alpha1.TeamTeamMember) *iamv0alpha1.Team {
	return &iamv0alpha1.Team{
		TypeMeta: metav1.TypeMeta{
			APIVersion: iamv0alpha1.GroupVersion.Identifier(),
			Kind:       iamv0alpha1.TeamKind().Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{Name: uid, Namespace: "org-1", ResourceVersion: "42"},
		Spec:       iamv0alpha1.TeamSpec{Members: members},
	}
}

func membersByName(members []iamv0alpha1.TeamTeamMember) map[string]iamv0alpha1.TeamTeamMember {
	m := make(map[string]iamv0alpha1.TeamTeamMember, len(members))
	for _, member := range members {
		m[member.Name] = member
	}
	return m
}

type mockResourceClient struct {
	mock.Mock
}

func (m *mockResourceClient) Get(ctx context.Context, identifier resource.Identifier) (resource.Object, error) {
	args := m.Called(ctx, identifier)
	switch v := args.Get(0).(type) {
	case nil:
		return nil, args.Error(1)
	case func(context.Context, resource.Identifier) resource.Object:
		return v(ctx, identifier), args.Error(1)
	case resource.Object:
		return v, args.Error(1)
	}
	return nil, args.Error(1)
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

	var retObj resource.Object
	switch v := args.Get(0).(type) {
	case nil:
		retObj = nil
	case func(context.Context, resource.Identifier, resource.Object, resource.UpdateOptions) resource.Object:
		retObj = v(ctx, identifier, obj, opts)
	case resource.Object:
		retObj = v
	}

	switch v := args.Get(1).(type) {
	case nil:
		return retObj, nil
	case func(context.Context, resource.Identifier, resource.Object, resource.UpdateOptions) error:
		return retObj, v(ctx, identifier, obj, opts)
	case error:
		return retObj, v
	}
	return retObj, nil
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

func (m *mockResourceClient) SubresourceRequest(_ context.Context, _ resource.Identifier, _ resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, nil
}
