package reporting

import "io"

type Reporter interface {
	BeginStory(story *StoryReport)
	Enter(scope *ScopeReport)
	Report(r *AssertionResult)
	Exit()
	EndStory()
	io.Writer
}

type reporters struct{ collection []Reporter }

func (self *reporters) BeginStory(s *StoryReport) { self.foreach(func(r Reporter) { r.BeginStory(s) }) }
func (self *reporters) Enter(s *ScopeReport)      { self.foreach(func(r Reporter) { r.Enter(s) }) }
func (self *reporters) Report(a *AssertionResult) { self.foreach(func(r Reporter) { r.Report(a) }) }
func (self *reporters) Exit()                     { self.foreach(func(r Reporter) { r.Exit() }) }
func (self *reporters) EndStory()                 { self.foreach(func(r Reporter) { r.EndStory() }) }

func (self *reporters) Write(contents []byte) (written int, err error) {
	self.foreach(func(r Reporter) {
		written, err = r.Write(contents)
	})
	return written, err
}

func (self *reporters) foreach(action func(Reporter)) {
	for _, r := range self.collection {
		action(r)
	}
}

func NewReporters(collection ...Reporter) *reporters {
	self := new(reporters)
	self.collection = collection
	return self
}
