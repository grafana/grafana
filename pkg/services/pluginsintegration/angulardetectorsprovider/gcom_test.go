package angulardetectorsprovider

import (
	"regexp"
	"testing"

	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/stretchr/testify/require"
)

func TestGCOMPatterns(t *testing.T) {
	t.Run("angularDetector", func(t *testing.T) {
		type tc struct {
			name     string
			pattern  GCOMPattern
			exp      func(t *testing.T, d angulardetector.AngularDetector)
			expError error
		}
		for _, c := range []tc{
			{
				name:    "contains",
				pattern: GCOMPattern{Name: "test", Pattern: "pattern", Type: GCOMPatternTypeContains},
				exp: func(t *testing.T, d angulardetector.AngularDetector) {
					require.Equal(t, &angulardetector.ContainsBytesDetector{Pattern: []byte("pattern")}, d)
				},
			},
			{
				name:    "regex",
				pattern: GCOMPattern{Name: "test", Pattern: `[0-9]+`, Type: GCOMPatternTypeRegex},
				exp: func(t *testing.T, d angulardetector.AngularDetector) {
					require.Equal(t, &angulardetector.RegexDetector{Regex: regexp.MustCompile(`[0-9]+`)}, d)
				},
			},
			{
				name:     "invalid regex returns errInvalidRegex",
				pattern:  GCOMPattern{Name: "test", Pattern: `[`, Type: GCOMPatternTypeRegex},
				expError: errInvalidRegex,
			},
			{
				name:     "invalid type returns errUnknownPatternType",
				pattern:  GCOMPattern{Name: "test", Pattern: "abc", Type: "unknown"},
				expError: errUnknownPatternType,
			},
		} {
			t.Run(c.name, func(t *testing.T) {
				d, err := c.pattern.angularDetector()
				if c.expError != nil {
					require.ErrorIs(t, err, c.expError)
				} else {
					c.exp(t, d)
				}
			})
		}
	})
}
