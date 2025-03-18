package testutil

import (
	"context"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
)

const DefaultContextTimeout = time.Second

// TestContext is a context.Context that can be canceled with or without a
// cause. This is only relevant for testing purposes.
type TestContext interface {
	context.Context

	// Cancel cancels the context. The `Err` method and the `context.Cause`
	// function will return context.Canceled.
	Cancel()

	// CancelCause cancels the current context with the given cause. The `Err`
	// method will return context.Canceled and the `context.Cause` function will
	// return the given error.
	CancelCause(err error)

	// WithUser returns a derived user with the given user associated. To derive
	// a context without an associated user, pass a nil value.
	WithUser(*user.SignedInUser) TestContext
}

// NewDefaultTestContext calls NewTestContext with the provided `t` and a
// timeout of DefaultContextTimeout. This should work fine for most unit tests.
func NewDefaultTestContext(t T) TestContext {
	return NewTestContext(t, time.Now().Add(DefaultContextTimeout))
}

// NewTestCtx returns a new TestContext with the following features:
//  1. Provides a `deadline` argument which is especially useful in integration
//     tests.
//  2. It honours the `-timeout` flag of `go test` if it is given, so it will
//     actually timeout at the earliest deadline (either the one resulting from
//     the command line or the one resulting from the `deadline` argument).
//  3. By default it has an empty user (i.e. the user at the UI login), so most
//     of the code paths to be tested will not need any special setup, unless
//     you need to test permissions. In that case, you can use any of the test
//     users from the SignedInUser struct (all of them come from real payloads).
func NewTestContext(t T, deadline time.Time) TestContext {
	t.Helper()

	// if the test has a deadline and it happens before our previously
	// calculated deadline, then use it instead
	if td, ok := t.Deadline(); ok && td.Before(deadline) {
		deadline = td
	}

	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	t.Cleanup(cancel)

	ctx, cancelCause := context.WithCancelCause(ctx)

	tctx := testContextFunc(func() (context.Context, context.CancelFunc, context.CancelCauseFunc) {
		return ctx, cancel, cancelCause
	})

	user, err := SignedInUser{}.NewEmpty()
	require.NoError(t, err)

	// TODO: improve by adding a better anonymous user struct
	return tctx.WithUser(user)
}

type testContextFunc func() (context.Context, context.CancelFunc, context.CancelCauseFunc)

func (f testContextFunc) Deadline() (deadline time.Time, ok bool) {
	ctx, _, _ := f()
	return ctx.Deadline()
}

func (f testContextFunc) Done() <-chan struct{} {
	ctx, _, _ := f()
	return ctx.Done()
}

func (f testContextFunc) Err() error {
	ctx, _, _ := f()
	return ctx.Err()
}

func (f testContextFunc) Value(key any) any {
	ctx, _, _ := f()
	return ctx.Value(key)
}

func (f testContextFunc) Cancel() {
	_, c, _ := f()
	c()
}

func (f testContextFunc) CancelCause(err error) {
	_, _, cc := f()
	cc(err)
}

func (f testContextFunc) WithUser(usr *user.SignedInUser) TestContext {
	ctx := identity.WithRequester(f, usr)

	return testContextFunc(func() (context.Context, context.CancelFunc, context.CancelCauseFunc) {
		return ctx, f.Cancel, f.CancelCause
	})
}
