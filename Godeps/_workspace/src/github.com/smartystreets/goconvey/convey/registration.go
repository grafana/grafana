package convey

import (
	"reflect"
	"runtime"

	"github.com/smartystreets/goconvey/convey/gotest"
)

type registration struct {
	Situation string
	action    *action
	Test      t
	File      string
	Line      int
	Focus     bool
}

func (self *registration) ShouldBeTopLevel() bool {
	return self.Test != nil
}

func newRegistration(situation string, action *action, test t) *registration {
	file, line, _ := gotest.ResolveExternalCaller()

	return &registration{
		Situation: situation,
		action:    action,
		Test:      test,
		File:      file,
		Line:      line,
	}
}

////////////////////////// action ///////////////////////

type action struct {
	wrapped     func()
	name        string
	failureMode FailureMode
}

func (self *action) Invoke() {
	self.wrapped()
}

func newAction(wrapped func(), mode FailureMode) *action {
	return &action{
		name:        functionName(wrapped),
		wrapped:     wrapped,
		failureMode: mode,
	}
}

func newSkippedAction(wrapped func(), mode FailureMode) *action {
	// The choice to use the filename and line number as the action name
	// reflects the need for something unique but also that corresponds
	// in a determinist way to the action itself.
	return &action{
		name:        gotest.FormatExternalFileAndLine(),
		wrapped:     wrapped,
		failureMode: mode,
	}
}

///////////////////////// helpers //////////////////////////////

func functionName(action func()) string {
	return runtime.FuncForPC(functionId(action)).Name()
}

func functionId(action func()) uintptr {
	return reflect.ValueOf(action).Pointer()
}
