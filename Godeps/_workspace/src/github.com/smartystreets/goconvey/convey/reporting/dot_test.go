package reporting

import (
	"errors"
	"testing"
)

func TestDotReporterAssertionPrinting(t *testing.T) {
	monochrome()
	file := newMemoryFile()
	printer := NewPrinter(file)
	reporter := NewDotReporter(printer)

	reporter.Report(NewSuccessReport())
	reporter.Report(NewFailureReport("failed"))
	reporter.Report(NewErrorReport(errors.New("error")))
	reporter.Report(NewSkipReport())

	expected := dotSuccess + dotFailure + dotError + dotSkip

	if file.buffer != expected {
		t.Errorf("\nExpected: '%s'\nActual:  '%s'", expected, file.buffer)
	}
}

func TestDotReporterOnlyReportsAssertions(t *testing.T) {
	monochrome()
	file := newMemoryFile()
	printer := NewPrinter(file)
	reporter := NewDotReporter(printer)

	reporter.BeginStory(nil)
	reporter.Enter(nil)
	reporter.Exit()
	reporter.EndStory()

	if file.buffer != "" {
		t.Errorf("\nExpected: '(blank)'\nActual:  '%s'", file.buffer)
	}
}
