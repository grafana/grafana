package processors

import (
	"regexp"

	"github.com/golangci/golangci-lint/pkg/result"
)

type Exclude struct {
	pattern *regexp.Regexp
}

var _ Processor = Exclude{}

func NewExclude(pattern string) *Exclude {
	var patternRe *regexp.Regexp
	if pattern != "" {
		patternRe = regexp.MustCompile("(?i)" + pattern)
	}
	return &Exclude{
		pattern: patternRe,
	}
}

func (p Exclude) Name() string {
	return "exclude"
}

func (p Exclude) Process(issues []result.Issue) ([]result.Issue, error) {
	if p.pattern == nil {
		return issues, nil
	}

	return filterIssues(issues, func(i *result.Issue) bool {
		return !p.pattern.MatchString(i.Text)
	}), nil
}

func (p Exclude) Finish() {}
