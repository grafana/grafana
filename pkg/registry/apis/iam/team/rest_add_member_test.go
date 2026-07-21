package team

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// rvStore is an in-memory team store that enforces resource-version based
// optimistic concurrency, mirroring how unified storage rejects a write
// whose object was read at a stale RV. It is safe for concurrent use.
type rvStore struct {
	mu   sync.Mutex
	team *iamv0alpha1.Team
}

func (s *rvStore) New() runtime.Object { return &iamv0alpha1.Team{} }
func (s *rvStore) Destroy()            {}

func (s *rvStore) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.team.DeepCopy(), nil
}

func (s *rvStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	newObj, err := objInfo.UpdatedObject(ctx, s.team.DeepCopy())
	if err != nil {
		return nil, false, err
	}
	nt := newObj.(*iamv0alpha1.Team)
	if nt.ResourceVersion != s.team.ResourceVersion {
		return nil, false, apierrors.NewConflict(teamResource.GroupResource(), name,
			fmt.Errorf("resource version %q does not match %q", nt.ResourceVersion, s.team.ResourceVersion))
	}
	stored := nt.DeepCopy()
	rv, _ := strconv.Atoi(s.team.ResourceVersion)
	stored.ResourceVersion = strconv.Itoa(rv + 1)
	s.team = stored
	return stored, false, nil
}

// scriptedStore returns a canned error on the first len(updateErrs) Update
// calls, then applies the write. Used to exercise the retry path
// deterministically.
type scriptedStore struct {
	mu         sync.Mutex
	team       *iamv0alpha1.Team
	updateErrs []error
	calls      int
}

func (s *scriptedStore) New() runtime.Object { return &iamv0alpha1.Team{} }
func (s *scriptedStore) Destroy()            {}

func (s *scriptedStore) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.team.DeepCopy(), nil
}

func (s *scriptedStore) Update(ctx context.Context, _ string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.calls < len(s.updateErrs) {
		err := s.updateErrs[s.calls]
		s.calls++
		return nil, false, err
	}
	s.calls++
	newObj, err := objInfo.UpdatedObject(ctx, s.team.DeepCopy())
	if err != nil {
		return nil, false, err
	}
	s.team = newObj.(*iamv0alpha1.Team).DeepCopy()
	return s.team, false, nil
}

func addMemberRequest(t *testing.T, handler *TeamAddMemberREST, teamName, userUID, permission string) *mockResponder {
	t.Helper()
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
	responder := &mockResponder{}
	h, err := handler.Connect(ctx, teamName, nil, responder)
	require.NoError(t, err)
	body := strings.NewReader(fmt.Sprintf(`{"name":%q,"permission":%q}`, userUID, permission))
	req := httptest.NewRequest(http.MethodPost, "/addmember", body).WithContext(ctx)
	h.ServeHTTP(httptest.NewRecorder(), req)
	return responder
}

func TestTeamAddMemberREST_RetriesOnConflict(t *testing.T) {
	t.Run("retries a resource-version conflict then persists", func(t *testing.T) {
		store := &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t"},
			},
			updateErrs: []error{
				apierrors.NewConflict(teamResource.GroupResource(), "team1", fmt.Errorf("rv mismatch")),
				apierrors.NewConflict(teamResource.GroupResource(), "team1", fmt.Errorf("rv mismatch")),
			},
		}
		handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

		responder := addMemberRequest(t, handler, "team1", "user1", "member")

		require.True(t, responder.called)
		require.NoError(t, responder.err)
		require.Equal(t, http.StatusCreated, responder.code)
		require.Len(t, store.team.Spec.Members, 1)
		require.Equal(t, "user1", store.team.Spec.Members[0].Name)
	})

	t.Run("retries a rolled-back SQL deadlock then persists", func(t *testing.T) {
		store := &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t"},
			},
			// Stringified MySQL deadlock as unified storage would surface it —
			// a generic 500-shaped error, not an apierrors.Conflict.
			updateErrs: []error{fmt.Errorf("Exec: Error 1213: Deadlock found when trying to get lock")},
		}
		handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

		responder := addMemberRequest(t, handler, "team1", "user1", "admin")

		require.True(t, responder.called)
		require.NoError(t, responder.err)
		require.Len(t, store.team.Spec.Members, 1)
	})
}

func TestTeamAddMemberREST_Connect(t *testing.T) {
	newStore := func(members ...iamv0alpha1.TeamTeamMember) *scriptedStore {
		return &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: members},
			},
		}
	}

	t.Run("adds a new member and returns 201", func(t *testing.T) {
		store := newStore()
		handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

		responder := addMemberRequest(t, handler, "team1", "user1", "member")

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusCreated, responder.code)
		require.Equal(t, 1, store.calls)
		require.Len(t, store.team.Spec.Members, 1)
	})

	t.Run("idempotent re-add with same permission skips the write and returns 200", func(t *testing.T) {
		store := newStore(member("user1", "member", false))
		handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

		responder := addMemberRequest(t, handler, "team1", "user1", "member")

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		require.Equal(t, 0, store.calls, "no Update expected when nothing changes")
		require.Len(t, store.team.Spec.Members, 1)
	})

	t.Run("re-add with new permission updates it and returns 200", func(t *testing.T) {
		store := newStore(member("user1", "member", false))
		handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

		responder := addMemberRequest(t, handler, "team1", "user1", "admin")

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		require.Equal(t, 1, store.calls)
		require.Len(t, store.team.Spec.Members, 1)
		require.Equal(t, iamv0alpha1.TeamTeamPermission("admin"), store.team.Spec.Members[0].Permission)
	})

	t.Run("non-retryable update error surfaces without retry", func(t *testing.T) {
		boom := apierrors.NewInternalError(fmt.Errorf("boom"))
		store := &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t"},
			},
			updateErrs: []error{boom},
		}
		handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

		responder := addMemberRequest(t, handler, "team1", "user1", "member")

		require.Error(t, responder.err)
		require.True(t, apierrors.IsInternalError(responder.err))
		require.Equal(t, 1, store.calls, "non-conflict errors must not be retried")
	})

	t.Run("rejects an invalid permission with 400", func(t *testing.T) {
		store := newStore()
		handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

		responder := addMemberRequest(t, handler, "team1", "user1", "superadmin")

		require.Error(t, responder.err)
		var se *apierrors.StatusError
		require.ErrorAs(t, responder.err, &se)
		require.Equal(t, int32(http.StatusBadRequest), se.ErrStatus.Code)
		require.Equal(t, 0, store.calls)
	})
}

// TestTeamAddMemberREST_ConcurrentAdds reproduces the reported bug: many
// parallel add-member requests for distinct users racing on the same team's
// resource version. With the retry loop, every add must persist and none may
// fail.
func TestTeamAddMemberREST_ConcurrentAdds(t *testing.T) {
	store := &rvStore{
		team: &iamv0alpha1.Team{
			ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
			Spec:       iamv0alpha1.TeamSpec{Title: "t"},
		},
	}
	handler := NewTeamAddMemberREST(store, tracing.NewNoopTracerService())

	const n = 10
	var wg sync.WaitGroup
	responders := make([]*mockResponder, n)
	start := make(chan struct{})
	for i := range n {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			responders[i] = addMemberRequest(t, handler, "team1", fmt.Sprintf("user%d", i), "member")
		}(i)
	}
	close(start)
	wg.Wait()

	for i, r := range responders {
		require.Truef(t, r.called, "responder %d not called", i)
		require.NoErrorf(t, r.err, "add for user%d failed", i)
	}
	require.Len(t, store.team.Spec.Members, n, "all concurrent adds must persist")
	seen := map[string]bool{}
	for _, m := range store.team.Spec.Members {
		seen[m.Name] = true
	}
	for i := range n {
		require.Truef(t, seen[fmt.Sprintf("user%d", i)], "user%d was lost", i)
	}
}
