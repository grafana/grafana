package reporting

import "testing"

func TestReporterReceivesSuccessfulReport(t *testing.T) {
	reporter := NewGoTestReporter()
	test := new(fakeTest)
	reporter.BeginStory(NewStoryReport(test))
	reporter.Report(NewSuccessReport())

	if test.failed {
		t.Errorf("Should have have marked test as failed--the report reflected success.")
	}
}

func TestReporterReceivesFailureReport(t *testing.T) {
	reporter := NewGoTestReporter()
	test := new(fakeTest)
	reporter.BeginStory(NewStoryReport(test))
	reporter.Report(NewFailureReport("This is a failure."))

	if !test.failed {
		t.Errorf("Test should have been marked as failed (but it wasn't).")
	}
}

func TestReporterReceivesErrorReport(t *testing.T) {
	reporter := NewGoTestReporter()
	test := new(fakeTest)
	reporter.BeginStory(NewStoryReport(test))
	reporter.Report(NewErrorReport("This is an error."))

	if !test.failed {
		t.Errorf("Test should have been marked as failed (but it wasn't).")
	}
}

func TestReporterIsResetAtTheEndOfTheStory(t *testing.T) {
	defer catch(t)
	reporter := NewGoTestReporter()
	test := new(fakeTest)
	reporter.BeginStory(NewStoryReport(test))
	reporter.EndStory()

	reporter.Report(NewSuccessReport())
}

func TestReporterNoopMethods(t *testing.T) {
	reporter := NewGoTestReporter()
	reporter.Enter(NewScopeReport("title"))
	reporter.Exit()
}

func catch(t *testing.T) {
	if r := recover(); r != nil {
		t.Log("Getting to this point means we've passed (because we caught a panic appropriately).")
	}
}

type fakeTest struct {
	failed bool
}

func (self *fakeTest) Fail() {
	self.failed = true
}
