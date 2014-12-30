// TODO: in order for this reporter to be completely honest
// we need to retrofit to be more like the json reporter such that:
// 1. it maintains ScopeResult collections, which count assertions
// 2. it reports only after EndStory(), so that all tick marks
//    are placed near the appropriate title.
// 3. Under unit test

package reporting

import "fmt"

type story struct {
	out        *Printer
	titlesById map[string]string
}

func (self *story) BeginStory(story *StoryReport) {}

func (self *story) Enter(scope *ScopeReport) {
	self.out.Indent()

	if _, found := self.titlesById[scope.ID]; !found {
		self.out.Println("")
		self.out.Print(scope.Title)
		self.out.Insert(" ")
		self.titlesById[scope.ID] = scope.Title
	}
}

func (self *story) Report(report *AssertionResult) {
	if report.Error != nil {
		fmt.Print(redColor)
		self.out.Insert(error_)
	} else if report.Failure != "" {
		fmt.Print(yellowColor)
		self.out.Insert(failure)
	} else if report.Skipped {
		fmt.Print(yellowColor)
		self.out.Insert(skip)
	} else {
		fmt.Print(greenColor)
		self.out.Insert(success)
	}
	fmt.Print(resetColor)
}

func (self *story) Exit() {
	self.out.Dedent()
}

func (self *story) EndStory() {
	self.titlesById = make(map[string]string)
	self.out.Println("\n")
}

func (self *story) Write(content []byte) (written int, err error) {
	return len(content), nil // no-op
}

func NewStoryReporter(out *Printer) *story {
	self := new(story)
	self.out = out
	self.titlesById = make(map[string]string)
	return self
}
