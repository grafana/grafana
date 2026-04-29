package iam

import (
	"context"
	"errors"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func newTeam(namespace, name string, members ...iamv0.TeamTeamMember) *iamv0.Team {
	return &iamv0.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: iamv0.TeamSpec{
			Title:   name,
			Members: members,
		},
	}
}

func member(name string, perm iamv0.TeamTeamPermission) iamv0.TeamTeamMember {
	return iamv0.TeamTeamMember{
		Kind:       "User",
		Name:       name,
		Permission: perm,
	}
}

func TestAfterTeamCreate(t *testing.T) {
	t.Run("writes a tuple per spec member", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		team := newTeam("org-1", "team-1",
			member("user-1", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionAdmin),
		)

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 2)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamCreate(team, nil)
		wg.Wait()
	})

	t.Run("skips members with empty subject name", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		team := newTeam("org-2", "team-2",
			member("", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionAdmin),
		)

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Len(t, req.Operations, 1)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-2",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamCreate(team, nil)
		wg.Wait()
	})

	t.Run("does not call zanzana when there are no members", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamCreate(newTeam("org-3", "team-3"), nil)

		time.Sleep(50 * time.Millisecond)
		require.False(t, called)
	})

	t.Run("does not panic when zClient is nil", func(t *testing.T) {
		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
		}
		b.AfterTeamCreate(newTeam("org-4", "team-4", member("user-1", iamv0.TeamTeamPermissionMember)), nil)
	})

	t.Run("skips zanzana sync when team name is empty", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamCreate(newTeam("org-5", "", member("user-1", iamv0.TeamTeamPermissionMember)), nil)

		time.Sleep(50 * time.Millisecond)
		require.False(t, called, "Mutate must not be called when team name is empty")
	})

	t.Run("skips zanzana sync when team namespace is empty", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamCreate(newTeam("", "team-5", member("user-1", iamv0.TeamTeamPermissionMember)), nil)

		time.Sleep(50 * time.Millisecond)
		require.False(t, called, "Mutate must not be called when team namespace is empty")
	})

	t.Run("does not call zanzana when all members have empty names", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		team := newTeam("org-6", "team-6",
			member("", iamv0.TeamTeamPermissionMember),
			member("", iamv0.TeamTeamPermissionAdmin),
		)
		b.AfterTeamCreate(team, nil)

		time.Sleep(50 * time.Millisecond)
		require.False(t, called)
	})

	t.Run("logs and returns when obj is not a Team", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		require.NotPanics(t, func() {
			b.AfterTeamCreate(&iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "user-1", Namespace: "org-1"}}, nil)
		})

		time.Sleep(50 * time.Millisecond)
		require.False(t, called, "Mutate must not be called when obj is not a Team")
	})

	// Failure-path coverage: a Mutate error must not panic, must release the ticket,
	// and the success counters must not be incremented (we can't easily assert the
	// counters here, but we can assert no goroutine leak by re-issuing under the
	// same ticket budget).
	t.Run("does not panic when zanzana returns an error", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			defer wg.Done()
			return errors.New("zanzana write failed")
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		team := newTeam("org-7", "team-7", member("user-1", iamv0.TeamTeamPermissionMember))
		require.NotPanics(t, func() {
			b.AfterTeamCreate(team, nil)
		})
		wg.Wait()

		// Ticket must have been released — a follow-up call must be able to acquire one.
		// If the failure path forgot to release, this would deadlock the test.
		wg.Add(1)
		b.AfterTeamCreate(team, nil)
		wg.Wait()
	})
}

func TestBeginTeamUpdate(t *testing.T) {
	t.Run("returns nil finish func when members are unchanged", func(t *testing.T) {
		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))

		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			require.Fail(t, "Mutate should not be called when members are identical")
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.Nil(t, finish)
	})

	t.Run("creates tuples for added members", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "team-1",
			member("user-1", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionAdmin),
		)

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 1)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.NotNil(t, finish)
		finish(context.Background(), true)
		wg.Wait()
	})

	t.Run("deletes tuples for removed members", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		old := newTeam("org-1", "team-1",
			member("user-1", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionAdmin),
		)
		next := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Len(t, req.Operations, 1)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.NotNil(t, finish)
		finish(context.Background(), true)
		wg.Wait()
	})

	t.Run("delete+create tuples when permission changes", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionAdmin))

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Len(t, req.Operations, 2)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.NotNil(t, finish)
		finish(context.Background(), true)
		wg.Wait()
	})

	t.Run("handles add, remove, and permission change in one update", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		old := newTeam("org-1", "team-1",
			member("user-1", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionMember),
		)
		next := newTeam("org-1", "team-1",
			member("user-2", iamv0.TeamTeamPermissionAdmin),
			member("user-3", iamv0.TeamTeamPermissionMember),
		)

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Len(t, req.Operations, 4)

			// user-1 removed
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))
			// user-2 promoted to admin (delete old + create new)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			// user-3 added
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-3",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.NotNil(t, finish)
		finish(context.Background(), true)
		wg.Wait()
	})

	t.Run("does not call zanzana when finish reports failure", func(t *testing.T) {
		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "team-1", member("user-2", iamv0.TeamTeamPermissionMember))

		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			require.Fail(t, "Mutate should not be called when update fails")
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.NotNil(t, finish)
		finish(context.Background(), false)
		time.Sleep(50 * time.Millisecond)
	})

	t.Run("returns nil finish func when zClient is nil", func(t *testing.T) {
		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
		}
		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "team-1", member("user-2", iamv0.TeamTeamPermissionMember))
		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.Nil(t, finish)
	})

	// Parity with the old "empty old binding subject" case: empty-subject members
	// in the old spec are filtered before diffing, so we never emit a Delete with
	// an empty SubjectName. New behavior is stricter than the old hook (which
	// would have sent a guaranteed-bad delete to Zanzana).
	t.Run("filters empty-subject members from the old spec when diffing", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		old := newTeam("org-1", "team-1",
			member("", iamv0.TeamTeamPermissionMember),
			member("user-1", iamv0.TeamTeamPermissionMember),
		)
		next := newTeam("org-1", "team-1",
			member("user-1", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionAdmin),
		)

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Len(t, req.Operations, 1, "should only emit the user-2 add; empty-subject member must be ignored")
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateTeamBinding{
					CreateTeamBinding: &v1.CreateTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.NotNil(t, finish)
		finish(context.Background(), true)
		wg.Wait()
	})

	// Parity with the old "empty new subject" / "empty new teamRef" cases: when
	// the only would-be addition has an empty subject, it gets filtered and the
	// diff collapses to nothing.
	t.Run("returns nil finish func when only diff is an empty-subject member added", func(t *testing.T) {
		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "team-1",
			member("user-1", iamv0.TeamTeamPermissionMember),
			member("", iamv0.TeamTeamPermissionAdmin),
		)

		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			require.Fail(t, "Mutate should not be called when the only diff is an empty-subject member")
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.Nil(t, finish)
	})

	t.Run("returns nil finish func when team name is empty", func(t *testing.T) {
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			require.Fail(t, "Mutate must not be called when team name is empty")
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		old := newTeam("org-1", "", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "", member("user-1", iamv0.TeamTeamPermissionAdmin))

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.Nil(t, finish)
	})

	t.Run("returns nil finish func when team namespace is empty", func(t *testing.T) {
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			require.Fail(t, "Mutate must not be called when team namespace is empty")
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		old := newTeam("", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("", "team-1", member("user-1", iamv0.TeamTeamPermissionAdmin))

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.Nil(t, finish)
	})

	t.Run("returns nil finish func when oldObj is not a Team", func(t *testing.T) {
		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{},
		}

		next := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		notATeam := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "user-1", Namespace: "org-1"}}

		finish, err := b.BeginTeamUpdate(context.Background(), next, notATeam, nil)
		require.NoError(t, err)
		require.Nil(t, finish)
	})

	t.Run("returns nil finish func when newObj is not a Team", func(t *testing.T) {
		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{},
		}

		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		notATeam := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "user-1", Namespace: "org-1"}}

		finish, err := b.BeginTeamUpdate(context.Background(), notATeam, old, nil)
		require.NoError(t, err)
		require.Nil(t, finish)
	})

	t.Run("does not panic when zanzana returns an error during finish", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			defer wg.Done()
			return errors.New("zanzana write failed")
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		old := newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember))
		next := newTeam("org-1", "team-1", member("user-2", iamv0.TeamTeamPermissionMember))

		finish, err := b.BeginTeamUpdate(context.Background(), next, old, nil)
		require.NoError(t, err)
		require.NotNil(t, finish)
		require.NotPanics(t, func() {
			finish(context.Background(), true)
		})
		wg.Wait()
	})
}

func TestAfterTeamDelete(t *testing.T) {
	t.Run("deletes a tuple for every member", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		team := newTeam("org-1", "team-1",
			member("user-1", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionAdmin),
		)

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Equal(t, "org-1", req.Namespace)
			require.Len(t, req.Operations, 2)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-1",
						TeamName:    "team-1",
						Permission:  "member",
					},
				},
			}))
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-1",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamDelete(team, nil)
		wg.Wait()
	})

	t.Run("does not call zanzana for empty team", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamDelete(newTeam("org-1", "team-1"), nil)

		time.Sleep(50 * time.Millisecond)
		require.False(t, called)
	})

	t.Run("does not panic when zClient is nil", func(t *testing.T) {
		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
		}
		b.AfterTeamDelete(newTeam("org-1", "team-1", member("user-1", iamv0.TeamTeamPermissionMember)), nil)
	})

	t.Run("skips members with empty subject name", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		team := newTeam("org-2", "team-2",
			member("", iamv0.TeamTeamPermissionMember),
			member("user-2", iamv0.TeamTeamPermissionAdmin),
		)

		callback := func(_ context.Context, req *v1.MutateRequest) error {
			defer wg.Done()
			require.Len(t, req.Operations, 1)
			require.True(t, containsTeamMemberOperation(req.Operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteTeamBinding{
					DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
						SubjectName: "user-2",
						TeamName:    "team-2",
						Permission:  "admin",
					},
				},
			}))
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamDelete(team, nil)
		wg.Wait()
	})

	t.Run("skips zanzana sync when team name is empty", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamDelete(newTeam("org-3", "", member("user-1", iamv0.TeamTeamPermissionMember)), nil)

		time.Sleep(50 * time.Millisecond)
		require.False(t, called, "Mutate must not be called when team name is empty")
	})

	t.Run("skips zanzana sync when team namespace is empty", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		b.AfterTeamDelete(newTeam("", "team-3", member("user-1", iamv0.TeamTeamPermissionMember)), nil)

		time.Sleep(50 * time.Millisecond)
		require.False(t, called, "Mutate must not be called when team namespace is empty")
	})

	t.Run("logs and returns when obj is not a Team", func(t *testing.T) {
		called := false
		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			called = true
			return nil
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		require.NotPanics(t, func() {
			b.AfterTeamDelete(&iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "user-1", Namespace: "org-1"}}, nil)
		})

		time.Sleep(50 * time.Millisecond)
		require.False(t, called, "Mutate must not be called when obj is not a Team")
	})

	t.Run("does not panic when zanzana returns an error", func(t *testing.T) {
		var wg sync.WaitGroup
		wg.Add(1)

		callback := func(_ context.Context, _ *v1.MutateRequest) error {
			defer wg.Done()
			return errors.New("zanzana delete failed")
		}

		b := &IdentityAccessManagementAPIBuilder{
			logger:   log.NewNopLogger(),
			zTickets: make(chan bool, 1),
			zClient:  &FakeZanzanaClient{mutateCallback: callback},
		}

		team := newTeam("org-4", "team-4", member("user-1", iamv0.TeamTeamPermissionMember))
		require.NotPanics(t, func() {
			b.AfterTeamDelete(team, nil)
		})
		wg.Wait()

		// Ticket must have been released even on failure — a follow-up call must not deadlock.
		wg.Add(1)
		b.AfterTeamDelete(team, nil)
		wg.Wait()
	})
}

func containsTeamMemberOperation(operations []*v1.MutateOperation, expected *v1.MutateOperation) bool {
	return slices.ContainsFunc(operations, func(o *v1.MutateOperation) bool {
		switch e := expected.Operation.(type) {
		case *v1.MutateOperation_DeleteTeamBinding:
			got, ok := o.Operation.(*v1.MutateOperation_DeleteTeamBinding)
			if !ok {
				return false
			}
			return got.DeleteTeamBinding.SubjectName == e.DeleteTeamBinding.SubjectName &&
				got.DeleteTeamBinding.TeamName == e.DeleteTeamBinding.TeamName &&
				got.DeleteTeamBinding.Permission == e.DeleteTeamBinding.Permission
		case *v1.MutateOperation_CreateTeamBinding:
			got, ok := o.Operation.(*v1.MutateOperation_CreateTeamBinding)
			if !ok {
				return false
			}
			return got.CreateTeamBinding.SubjectName == e.CreateTeamBinding.SubjectName &&
				got.CreateTeamBinding.TeamName == e.CreateTeamBinding.TeamName &&
				got.CreateTeamBinding.Permission == e.CreateTeamBinding.Permission
		}
		return false
	})
}
