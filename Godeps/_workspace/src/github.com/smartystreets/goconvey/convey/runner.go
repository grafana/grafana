package convey

import (
	"github.com/smartystreets/goconvey/convey/reporting"
)

type runner struct {
	top         *scope
	active      *scope
	reporter    reporting.Reporter
	failureMode FailureMode
	focus       bool
}

func (self *runner) Register(entry *registration) {
	if self.focus && !entry.Focus {
		return
	}

	self.active.adopt(newScope(entry, self.reporter))
}

func (self *runner) RegisterReset(action *action) {
	self.active.registerReset(action)
}

func (self *runner) Run(entry *registration) {
	self.active = self.top
	self.focus = entry.Focus
	self.failureMode = defaultFailureMode

	self.Register(entry)
	self.reporter.BeginStory(reporting.NewStoryReport(entry.Test))

	for !self.top.visited() {
		self.top.visit(self)
	}

	self.reporter.EndStory()
}

func newRunner(reporter reporting.Reporter) *runner {
	// Top-level is always using a nilReporter
	scope := newScope(newRegistration(topLevel, newAction(func() {}, FailureInherits), nil), newNilReporter())

	return &runner{
		reporter: reporter,
		top:      scope,
		active:   scope,
	}
}

func (self *runner) Report(result *reporting.AssertionResult) {
	self.reporter.Report(result)

	if result.Failure != "" && self.failureMode == FailureHalts {
		panic(failureHalt)
	}
}

func (self *runner) Write(content []byte) (written int, err error) {
	return self.reporter.Write(content)
}

func (self *runner) setFailureMode(mode FailureMode) FailureMode {
	old := self.failureMode

	if mode != FailureInherits {
		self.failureMode = mode
	}

	return old
}

func last(group []string) string {
	return group[len(group)-1]
}

const topLevel = "TOP"
const failureHalt = "___FAILURE_HALT___"

//////////////////////// nilReporter /////////////////////////////

type nilReporter struct{}

func (self *nilReporter) BeginStory(story *reporting.StoryReport)  {}
func (self *nilReporter) Enter(scope *reporting.ScopeReport)       {}
func (self *nilReporter) Report(report *reporting.AssertionResult) {}
func (self *nilReporter) Exit()                                    {}
func (self *nilReporter) EndStory()                                {}
func (self *nilReporter) Write(p []byte) (int, error)              { return len(p), nil }
func newNilReporter() *nilReporter                                 { return &nilReporter{} }
