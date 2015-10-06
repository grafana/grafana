package reporting

import "fmt"

func (self *statistics) BeginStory(story *StoryReport) {}

func (self *statistics) Enter(scope *ScopeReport) {}

func (self *statistics) Report(report *AssertionResult) {
	if !self.failing && report.Failure != "" {
		self.failing = true
	}
	if !self.erroring && report.Error != nil {
		self.erroring = true
	}
	if report.Skipped {
		self.skipped += 1
	} else {
		self.total++
	}
}

func (self *statistics) Exit() {}

func (self *statistics) EndStory() {
	self.reportAssertions()
	self.reportSkippedSections()
	self.completeReport()
}
func (self *statistics) reportAssertions() {
	self.decideColor()
	self.out.Print("\n%d %s thus far", self.total, plural("assertion", self.total))
}
func (self *statistics) decideColor() {
	if self.failing && !self.erroring {
		fmt.Print(yellowColor)
	} else if self.erroring {
		fmt.Print(redColor)
	} else {
		fmt.Print(greenColor)
	}
}
func (self *statistics) reportSkippedSections() {
	if self.skipped > 0 {
		fmt.Print(yellowColor)
		self.out.Print(" (one or more sections skipped)")
		self.skipped = 0
	}
}
func (self *statistics) completeReport() {
	fmt.Print(resetColor)
	self.out.Print("\n")
	self.out.Print("\n")
}

func (self *statistics) Write(content []byte) (written int, err error) {
	return len(content), nil // no-op
}

func NewStatisticsReporter(out *Printer) *statistics {
	self := statistics{}
	self.out = out
	return &self
}

type statistics struct {
	out      *Printer
	total    int
	failing  bool
	erroring bool
	skipped  int
}

func plural(word string, count int) string {
	if count == 1 {
		return word
	}
	return word + "s"
}
