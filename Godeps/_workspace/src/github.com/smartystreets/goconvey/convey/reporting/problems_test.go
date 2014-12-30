package reporting

import (
	"strings"
	"testing"
)

func TestNoopProblemReporterActions(t *testing.T) {
	file, reporter := setup()
	reporter.BeginStory(nil)
	reporter.Enter(nil)
	reporter.Exit()
	expected := ""
	actual := file.String()
	if expected != actual {
		t.Errorf("Expected: '(blank)'\nActual:  '%s'", actual)
	}
}

func TestReporterPrintsFailuresAndErrorsAtTheEndOfTheStory(t *testing.T) {
	file, reporter := setup()
	reporter.Report(NewFailureReport("failed"))
	reporter.Report(NewErrorReport("error"))
	reporter.Report(NewSuccessReport())
	reporter.EndStory()

	result := file.String()
	if !strings.Contains(result, "Errors:\n") {
		t.Errorf("Expected errors, found none.")
	}
	if !strings.Contains(result, "Failures:\n") {
		t.Errorf("Expected failures, found none.")
	}
	problemCount := strings.Count(result, "*")
	if problemCount != 2 {
		t.Errorf("Expected one failure and one error (total of 2 '*' characters). Got %d", problemCount)
	}
}

func setup() (file *memoryFile, reporter *problem) {
	monochrome()
	file = newMemoryFile()
	printer := NewPrinter(file)
	reporter = NewProblemReporter(printer)
	return
}
