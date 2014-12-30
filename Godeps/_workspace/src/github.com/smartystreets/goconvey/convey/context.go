// Oh the stack trace scanning!
// The density of comments in this file is evidence that
// the code doesn't exactly explain itself. Tread with care...
package convey

import (
	"errors"
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"sync"
)

const (
	missingGoTest string = `Top-level calls to Convey(...) need a reference to the *testing.T. 
		Hint: Convey("description here", t, func() { /* notice that the second argument was the *testing.T (t)! */ }) `
	extraGoTest string = `Only the top-level call to Convey(...) needs a reference to the *testing.T.`
)

// suiteContext magically handles all coordination of reporter, runners as they handle calls
// to Convey, So, and the like. It does this via runtime call stack inspection, making sure
// that each test function has its own runner, and routes all live registrations
// to the appropriate runner.
type suiteContext struct {
	lock    sync.Mutex
	runners map[string]*runner // key: testName;

	// stores a correlation to the actual runner for outside-of-stack scenaios
	locations map[string]string // key: file:line; value: testName (key to runners)
}

func (self *suiteContext) Run(entry *registration) {
	if self.current() != nil {
		panic(extraGoTest)
	}

	runner := newRunner(buildReporter())

	testName, location, _ := suiteAnchor()

	self.setRunner(location, testName, runner)

	runner.Run(entry)

	self.unsetRunner(location, testName)
}

func (self *suiteContext) Current() *runner {
	if runner := self.current(); runner != nil {
		return runner
	}
	panic(missingGoTest)
}
func (self *suiteContext) current() *runner {
	self.lock.Lock()
	defer self.lock.Unlock()

	if testName, _, err := suiteAnchor(); err == nil {
		return self.runners[testName]
	}

	return self.runners[correlate(self.locations)]
}
func (self *suiteContext) setRunner(location string, testName string, runner *runner) {
	self.lock.Lock()
	defer self.lock.Unlock()

	self.locations[location] = testName
	self.runners[testName] = runner
}
func (self *suiteContext) unsetRunner(location string, testName string) {
	self.lock.Lock()
	defer self.lock.Unlock()

	delete(self.locations, location)
	delete(self.runners, testName)
}

func newSuiteContext() *suiteContext {
	return &suiteContext{
		locations: map[string]string{},
		runners:   map[string]*runner{},
	}
}

//////////////////// Helper Functions ///////////////////////

// suiteAnchor returns the enclosing test function name (including package) and the
// file:line combination of the top-level Convey. It does this by traversing the
// call stack in reverse, looking for the go testing harnass call ("testing.tRunner")
// and then grabs the very next entry.
func suiteAnchor() (testName, location string, err error) {
	callers := runtime.Callers(0, callStack)

	for y := callers; y > 0; y-- {
		callerId, file, conveyLine, found := runtime.Caller(y)
		if !found {
			continue
		}

		if name := runtime.FuncForPC(callerId).Name(); name != goTestHarness {
			continue
		}

		callerId, file, conveyLine, _ = runtime.Caller(y - 1)
		testName = runtime.FuncForPC(callerId).Name()
		location = fmt.Sprintf("%s:%d", file, conveyLine)
		return
	}
	return "", "", errors.New("Can't resolve test method name! Are you calling Convey() from a `*_test.go` file and a `Test*` method (because you should be)?")
}

// correlate links the current stack with the appropriate
// top-level Convey by comparing line numbers in its own stack trace
// with the registered file:line combo. It's come to this.
func correlate(locations map[string]string) (testName string) {
	file, line := resolveTestFileAndLine()
	closest := -1

	for location, registeredTestName := range locations {
		locationFile, rawLocationLine := splitFileAndLine(location)

		if locationFile != file {
			continue
		}

		locationLine, err := strconv.Atoi(rawLocationLine)
		if err != nil || locationLine < line {
			continue
		}

		if closest == -1 || locationLine < closest {
			closest = locationLine
			testName = registeredTestName
		}
	}
	return
}

// splitFileAndLine receives a path and a line number in a single string,
// separated by a colon and splits them.
func splitFileAndLine(value string) (file, line string) {
	parts := strings.Split(value, ":")
	if len(parts) == 2 {
		file = parts[0]
		line = parts[1]
	} else if len(parts) > 2 {
		// 'C:/blah.go:123' (windows drive letter has two colons
		// '-:--------:---'  instead of just one to separate file and line)
		file = strings.Join(parts[:2], ":")
		line = parts[2]
	}
	return
}

// resolveTestFileAndLine is used as a last-ditch effort to correlate an
// assertion with the right executor and runner.
func resolveTestFileAndLine() (file string, line int) {
	callers := runtime.Callers(0, callStack)
	var found bool

	for y := callers; y > 0; y-- {
		_, file, line, found = runtime.Caller(y)
		if !found {
			continue
		}

		if strings.HasSuffix(file, "_test.go") {
			return
		}
	}
	return "", 0
}

const maxStackDepth = 100               // This had better be enough...
const goTestHarness = "testing.tRunner" // I hope this doesn't change...

var callStack []uintptr = make([]uintptr, maxStackDepth, maxStackDepth)
