package v1

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ResourceUID string

type ResourceMetadata struct {
	UID        ResourceUID
	Version    string
	Provenance models.Provenance
}

type Matcher struct {
	Type  MatcherType
	Label string
	Value string
}

func (m Matcher) Validate() error {
	switch m.Type {
	case MatcherEqual, MatcherNotEqual, MatcherEqualRegex, MatcherNotEqualRegex:
	default:
		return fmt.Errorf("unknown matcher type: %s", m.Type)
	}
	if m.Type == MatcherEqualRegex || m.Type == MatcherNotEqualRegex {
		_, err := regexp.Compile("^(?:" + m.Value + ")$")
		if err != nil {
			return fmt.Errorf("invalid regex pattern: %w", err)
		}
	}
	return nil
}

func NewMatcher(t MatcherType, label, value string) Matcher {
	return Matcher{
		Type:  t,
		Label: label,
		Value: value,
	}
}

type MatcherType string

const (
	MatcherEqual         MatcherType = "="
	MatcherNotEqual      MatcherType = "!="
	MatcherEqualRegex    MatcherType = "=~"
	MatcherNotEqualRegex MatcherType = "!~"
)
