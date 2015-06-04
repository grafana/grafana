package convey

import (
	"fmt"

	"github.com/jtolds/gls"
	"github.com/smartystreets/goconvey/convey/reporting"
)

type conveyErr struct {
	fmt    string
	params []interface{}
}

func (e *conveyErr) Error() string {
	return fmt.Sprintf(e.fmt, e.params...)
}

func conveyPanic(fmt string, params ...interface{}) {
	panic(&conveyErr{fmt, params})
}

const (
	missingGoTest = `Top-level calls to Convey(...) need a reference to the *testing.T.
		Hint: Convey("description here", t, func() { /* notice that the second argument was the *testing.T (t)! */ }) `
	extraGoTest    = `Only the top-level call to Convey(...) needs a reference to the *testing.T.`
	noStackContext = "Convey operation made without context on goroutine stack.\n" +
		"Hint: Perhaps you meant to use `Convey(..., func(c C){...})` ?"
	differentConveySituations = "Different set of Convey statements on subsequent pass!\nDid not expect %#v."
	multipleIdenticalConvey   = "Multiple convey suites with identical names: %#v"
)

const (
	failureHalt = "___FAILURE_HALT___"

	nodeKey = "node"
)

///////////////////////////////// Stack Context /////////////////////////////////

func getCurrentContext() *context {
	ctx, ok := ctxMgr.GetValue(nodeKey)
	if ok {
		return ctx.(*context)
	}
	return nil
}

func mustGetCurrentContext() *context {
	ctx := getCurrentContext()
	if ctx == nil {
		conveyPanic(noStackContext)
	}
	return ctx
}

//////////////////////////////////// Context ////////////////////////////////////

// context magically handles all coordination of Convey's and So assertions.
//
// It is tracked on the stack as goroutine-local-storage with the gls package,
// or explicitly if the user decides to call convey like:
//
//   Convey(..., func(c C) {
//     c.So(...)
//   })
//
// This implements the `C` interface.
type context struct {
	reporter reporting.Reporter

	children map[string]*context

	resets []func()

	executedOnce   bool
	expectChildRun *bool
	complete       bool

	focus       bool
	failureMode FailureMode
}

// rootConvey is the main entry point to a test suite. This is called when
// there's no context in the stack already, and items must contain a `t` object,
// or this panics.
func rootConvey(items ...interface{}) {
	entry := discover(items)

	if entry.Test == nil {
		conveyPanic(missingGoTest)
	}

	expectChildRun := true
	ctx := &context{
		reporter: buildReporter(),

		children: make(map[string]*context),

		expectChildRun: &expectChildRun,

		focus:       entry.Focus,
		failureMode: defaultFailureMode.combine(entry.FailMode),
	}
	ctxMgr.SetValues(gls.Values{nodeKey: ctx}, func() {
		ctx.reporter.BeginStory(reporting.NewStoryReport(entry.Test))
		defer ctx.reporter.EndStory()

		for ctx.shouldVisit() {
			ctx.conveyInner(entry.Situation, entry.Func)
			expectChildRun = true
		}
	})
}

//////////////////////////////////// Methods ////////////////////////////////////

func (ctx *context) SkipConvey(items ...interface{}) {
	ctx.Convey(items, skipConvey)
}

func (ctx *context) FocusConvey(items ...interface{}) {
	ctx.Convey(items, focusConvey)
}

func (ctx *context) Convey(items ...interface{}) {
	entry := discover(items)

	// we're a branch, or leaf (on the wind)
	if entry.Test != nil {
		conveyPanic(extraGoTest)
	}
	if ctx.focus && !entry.Focus {
		return
	}

	var inner_ctx *context
	if ctx.executedOnce {
		var ok bool
		inner_ctx, ok = ctx.children[entry.Situation]
		if !ok {
			conveyPanic(differentConveySituations, entry.Situation)
		}
	} else {
		if _, ok := ctx.children[entry.Situation]; ok {
			conveyPanic(multipleIdenticalConvey, entry.Situation)
		}
		inner_ctx = &context{
			reporter: ctx.reporter,

			children: make(map[string]*context),

			expectChildRun: ctx.expectChildRun,

			focus:       entry.Focus,
			failureMode: ctx.failureMode.combine(entry.FailMode),
		}
		ctx.children[entry.Situation] = inner_ctx
	}

	if inner_ctx.shouldVisit() {
		ctxMgr.SetValues(gls.Values{nodeKey: inner_ctx}, func() {
			inner_ctx.conveyInner(entry.Situation, entry.Func)
		})
	}
}

func (ctx *context) SkipSo(stuff ...interface{}) {
	ctx.assertionReport(reporting.NewSkipReport())
}

func (ctx *context) So(actual interface{}, assert assertion, expected ...interface{}) {
	if result := assert(actual, expected...); result == assertionSuccess {
		ctx.assertionReport(reporting.NewSuccessReport())
	} else {
		ctx.assertionReport(reporting.NewFailureReport(result))
	}
}

func (ctx *context) Reset(action func()) {
	/* TODO: Failure mode configuration */
	ctx.resets = append(ctx.resets, action)
}

func (ctx *context) Print(items ...interface{}) (int, error) {
	fmt.Fprint(ctx.reporter, items...)
	return fmt.Print(items...)
}

func (ctx *context) Println(items ...interface{}) (int, error) {
	fmt.Fprintln(ctx.reporter, items...)
	return fmt.Println(items...)
}

func (ctx *context) Printf(format string, items ...interface{}) (int, error) {
	fmt.Fprintf(ctx.reporter, format, items...)
	return fmt.Printf(format, items...)
}

//////////////////////////////////// Private ////////////////////////////////////

// shouldVisit returns true iff we should traverse down into a Convey. Note
// that just because we don't traverse a Convey this time, doesn't mean that
// we may not traverse it on a subsequent pass.
func (c *context) shouldVisit() bool {
	return !c.complete && *c.expectChildRun
}

// conveyInner is the function which actually executes the user's anonymous test
// function body. At this point, Convey or RootConvey has decided that this
// function should actually run.
func (ctx *context) conveyInner(situation string, f func(C)) {
	// Record/Reset state for next time.
	defer func() {
		ctx.executedOnce = true

		// This is only needed at the leaves, but there's no harm in also setting it
		// when returning from branch Convey's
		*ctx.expectChildRun = false
	}()

	// Set up+tear down our scope for the reporter
	ctx.reporter.Enter(reporting.NewScopeReport(situation))
	defer ctx.reporter.Exit()

	// Recover from any panics in f, and assign the `complete` status for this
	// node of the tree.
	defer func() {
		ctx.complete = true
		if problem := recover(); problem != nil {
			if problem, ok := problem.(*conveyErr); ok {
				panic(problem)
			}
			if problem != failureHalt {
				ctx.reporter.Report(reporting.NewErrorReport(problem))
			}
		} else {
			for _, child := range ctx.children {
				if !child.complete {
					ctx.complete = false
					return
				}
			}
		}
	}()

	// Resets are registered as the `f` function executes, so nil them here.
	// All resets are run in registration order (FIFO).
	ctx.resets = []func(){}
	defer func() {
		for _, r := range ctx.resets {
			// panics handled by the previous defer
			r()
		}
	}()

	if f == nil {
		// if f is nil, this was either a Convey(..., nil), or a SkipConvey
		ctx.reporter.Report(reporting.NewSkipReport())
	} else {
		f(ctx)
	}
}

// assertionReport is a helper for So and SkipSo which makes the report and
// then possibly panics, depending on the current context's failureMode.
func (ctx *context) assertionReport(r *reporting.AssertionResult) {
	ctx.reporter.Report(r)
	if r.Failure != "" && ctx.failureMode == FailureHalts {
		panic(failureHalt)
	}
}
