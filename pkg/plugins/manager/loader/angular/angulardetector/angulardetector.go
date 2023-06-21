package angulardetector

import (
	"bytes"
	"regexp"
)

var (
	_ AngularDetector = &ContainsBytesDetector{}
	_ AngularDetector = &RegexDetector{}
)

// AngularDetector implements a check to see if a js file is using angular APIs.
type AngularDetector interface {
	// DetectAngular takes the content of a js file and returns true if the plugin is using Angular.
	DetectAngular(js []byte) bool
}

// ContainsBytesDetector is an AngularDetector that returns true if module.js contains the "pattern" string.
type ContainsBytesDetector struct {
	Pattern []byte
}

// DetectAngular returns true if moduleJs contains the byte slice d.pattern.
func (d *ContainsBytesDetector) DetectAngular(moduleJs []byte) bool {
	return bytes.Contains(moduleJs, d.Pattern)
}

// RegexDetector is an AngularDetector that returns true if the module.js content matches a regular expression.
type RegexDetector struct {
	Regex *regexp.Regexp
}

// DetectAngular returns true if moduleJs matches the regular expression d.regex.
func (d *RegexDetector) DetectAngular(moduleJs []byte) bool {
	return d.Regex.Match(moduleJs)
}
