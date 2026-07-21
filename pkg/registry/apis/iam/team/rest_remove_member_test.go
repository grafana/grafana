package team

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func removeMemberRequest(t *testing.T, handler *TeamRemoveMemberREST, teamName, userUID string) *mockResponder {
	t.Helper()
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "default"})
	responder := &mockResponder{}
	h, err := handler.Connect(ctx, teamName, nil, responder)
	require.NoError(t, err)
	body := strings.NewReader(fmt.Sprintf(`{"name":%q}`, userUID))
	req := httptest.NewRequest(http.MethodPost, "/removemember", body).WithContext(ctx)
	h.ServeHTTP(httptest.NewRecorder(), req)
	return responder
}

func TestTeamRemoveMemberREST_RetriesOnConflict(t *testing.T) {
	t.Run("retries a resource-version conflict then persists removal", func(t *testing.T) {
		store := &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: []iamv0alpha1.TeamTeamMember{member("user1", "member", false)}},
			},
			updateErrs: []error{
				apierrors.NewConflict(teamResource.GroupResource(), "team1", fmt.Errorf("rv mismatch")),
				apierrors.NewConflict(teamResource.GroupResource(), "team1", fmt.Errorf("rv mismatch")),
			},
		}
		handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

		responder := removeMemberRequest(t, handler, "team1", "user1")

		require.True(t, responder.called)
		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		require.Empty(t, store.team.Spec.Members)
	})

	t.Run("retries a rolled-back SQL deadlock then persists", func(t *testing.T) {
		store := &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: []iamv0alpha1.TeamTeamMember{member("user1", "member", false)}},
			},
			// Stringified MySQL deadlock as unified storage would surface it —
			// a generic 500-shaped error, not an apierrors.Conflict.
			updateErrs: []error{fmt.Errorf("Exec: Error 1213: Deadlock found when trying to get lock")},
		}
		handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

		responder := removeMemberRequest(t, handler, "team1", "user1")

		require.True(t, responder.called)
		require.NoError(t, responder.err)
		require.Empty(t, store.team.Spec.Members)
	})

	t.Run("surfaces the conflict when retries are exhausted", func(t *testing.T) {
		errs := make([]error, 0, retry.DefaultRetry.Steps)
		for range retry.DefaultRetry.Steps {
			errs = append(errs, apierrors.NewConflict(teamResource.GroupResource(), "team1", fmt.Errorf("rv mismatch")))
		}
		store := &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: []iamv0alpha1.TeamTeamMember{member("user1", "member", false)}},
			},
			updateErrs: errs,
		}
		handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

		responder := removeMemberRequest(t, handler, "team1", "user1")

		require.True(t, responder.called)
		require.Error(t, responder.err)
		require.True(t, apierrors.IsConflict(responder.err), "exhausted retries must surface the conflict")
		require.Equal(t, retry.DefaultRetry.Steps, store.calls, "handler must retry exactly Steps times before giving up")
	})
}

func TestTeamRemoveMemberREST_Connect(t *testing.T) {
	newStore := func(members ...iamv0alpha1.TeamTeamMember) *scriptedStore {
		return &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: members},
			},
		}
	}

	t.Run("removes an existing member and returns 200", func(t *testing.T) {
		store := newStore(member("user1", "member", false), member("user2", "admin", false))
		handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

		responder := removeMemberRequest(t, handler, "team1", "user1")

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		require.Equal(t, 1, store.calls)
		require.Len(t, store.team.Spec.Members, 1)
		require.Equal(t, "user2", store.team.Spec.Members[0].Name)
	})

	t.Run("removing an absent user is idempotent: no write, returns 200", func(t *testing.T) {
		store := newStore(member("user1", "member", false))
		handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

		responder := removeMemberRequest(t, handler, "team1", "ghost")

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		require.Equal(t, 0, store.calls, "no Update expected when the user isn't a member")
		require.Len(t, store.team.Spec.Members, 1)
	})

	t.Run("non-retryable update error surfaces without retry", func(t *testing.T) {
		boom := apierrors.NewInternalError(fmt.Errorf("boom"))
		store := &scriptedStore{
			team: &iamv0alpha1.Team{
				ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
				Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: []iamv0alpha1.TeamTeamMember{member("user1", "member", false)}},
			},
			updateErrs: []error{boom},
		}
		handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

		responder := removeMemberRequest(t, handler, "team1", "user1")

		require.Error(t, responder.err)
		require.True(t, apierrors.IsInternalError(responder.err))
		require.Equal(t, 1, store.calls, "non-conflict errors must not be retried")
	})

	t.Run("rejects a missing user name with 400", func(t *testing.T) {
		store := newStore(member("user1", "member", false))
		handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

		responder := removeMemberRequest(t, handler, "team1", "")

		require.Error(t, responder.err)
		var se *apierrors.StatusError
		require.ErrorAs(t, responder.err, &se)
		require.Equal(t, int32(http.StatusBadRequest), se.ErrStatus.Code)
		require.Equal(t, 0, store.calls)
	})
}

// TestTeamRemoveMemberREST_ConcurrentRemoves mirrors the add-member race:
// many parallel remove-member requests for distinct users contending on the
// same team's resource version. With the retry loop, every removal must
// persist and none may fail.
func TestTeamRemoveMemberREST_ConcurrentRemoves(t *testing.T) {
	const n = 10
	members := make([]iamv0alpha1.TeamTeamMember, n)
	for i := range n {
		members[i] = member(fmt.Sprintf("user%d", i), "member", false)
	}
	store := &rvStore{
		team: &iamv0alpha1.Team{
			ObjectMeta: metav1.ObjectMeta{Name: "team1", Namespace: "default", ResourceVersion: "1"},
			Spec:       iamv0alpha1.TeamSpec{Title: "t", Members: members},
		},
	}
	handler := NewTeamRemoveMemberREST(store, tracing.NewNoopTracerService())

	var wg sync.WaitGroup
	responders := make([]*mockResponder, n)
	start := make(chan struct{})
	for i := range n {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			responders[i] = removeMemberRequest(t, handler, "team1", fmt.Sprintf("user%d", i))
		}(i)
	}
	close(start)
	wg.Wait()

	for i, r := range responders {
		require.Truef(t, r.called, "responder %d not called", i)
		require.NoErrorf(t, r.err, "remove for user%d failed", i)
	}
	require.Empty(t, store.team.Spec.Members, "all concurrent removes must persist")
}
