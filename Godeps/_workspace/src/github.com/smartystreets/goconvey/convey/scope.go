package convey

import (
	"fmt"
	"strings"

	"github.com/smartystreets/goconvey/convey/reporting"
)

type scope struct {
	name       string
	title      string
	action     *action
	children   map[string]*scope
	birthOrder []*scope
	child      int
	resetOrder []string
	resets     map[string]*action
	panicked   bool
	reporter   reporting.Reporter
	report     *reporting.ScopeReport
}

func (parent *scope) adopt(child *scope) {
	i := parent.getChildIndex(child)

	if i == -1 {
		parent.children[child.name] = child
		parent.birthOrder = append(parent.birthOrder, child)
	} else {
		/* We need to replace the action to retain the closed over variables from
		   the specific invocation of the parent scope, enabling the enclosing
		   parent scope to serve as a set-up for the child scope */
		parent.birthOrder[i].action = child.action
	}
}

func (parent *scope) getChildIndex(child *scope) int {
	for i, ordered := range parent.birthOrder {
		if ordered.name == child.name && ordered.title == child.title {
			return i
		}
	}

	return -1
}

func (self *scope) registerReset(action *action) {
	self.resets[action.name] = action
	for _, name := range self.resetOrder {
		if name == action.name {
			return
		}
	}
	self.resetOrder = append(self.resetOrder, action.name)
}

func (self *scope) visited() bool {
	return self.panicked || self.child >= len(self.birthOrder)
}

func (parent *scope) visit(runner *runner) {
	runner.active = parent
	defer parent.exit()

	oldMode := runner.setFailureMode(parent.action.failureMode)
	defer runner.setFailureMode(oldMode)

	parent.reporter.Enter(parent.report)
	parent.action.Invoke()
	parent.visitNextChild(runner)
	parent.cleanup()
}
func (parent *scope) visitNextChild(runner *runner) {
	if len(parent.birthOrder) > parent.child {
		child := parent.birthOrder[parent.child]

		child.visit(runner)

		if child.visited() {
			parent.child++
		}
	}
}
func (parent *scope) cleanup() {
	for _, name := range parent.resetOrder {
		reset := parent.resets[name]
		reset.Invoke()
	}
}
func (parent *scope) exit() {
	if problem := recover(); problem != nil {
		if strings.HasPrefix(fmt.Sprintf("%v", problem), extraGoTest) {
			panic(problem)
		}
		if problem != failureHalt {
			parent.reporter.Report(reporting.NewErrorReport(problem))
		}
		parent.panicked = true
	}
	parent.reporter.Exit()
}

func newScope(entry *registration, reporter reporting.Reporter) *scope {
	return &scope{
		reporter:   reporter,
		name:       entry.action.name,
		title:      entry.Situation,
		action:     entry.action,
		children:   make(map[string]*scope),
		birthOrder: []*scope{},
		resetOrder: []string{},
		resets:     make(map[string]*action),
		report:     reporting.NewScopeReport(entry.Situation, entry.action.name),
	}
}
