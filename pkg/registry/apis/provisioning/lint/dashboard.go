package lint

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"

	"github.com/grafana/dashboard-linter/lint"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"gopkg.in/yaml.v3"
)

type DashboardLinterFactory struct{}

func NewDashboardLinterFactory() *DashboardLinterFactory {
	return &DashboardLinterFactory{}
}

func (f *DashboardLinterFactory) New() Linter {
	return &DashboardLinter{rules: lint.NewRuleSet()}
}

func (f *DashboardLinterFactory) NewFromConfig(cfg []byte) (Linter, error) {
	var lintCfg lint.ConfigurationFile
	if err := yaml.Unmarshal(cfg, &lintCfg); err != nil {
		return nil, fmt.Errorf("unmarshal linter config: %w", err)
	}

	return &DashboardLinter{rules: lint.NewRuleSet(), cfg: lintCfg}, nil
}

func (f *DashboardLinterFactory) IsEnabled() bool {
	lintingVal, ok := os.LookupEnv("GRAFANA_LINTING")
	linting := ok && lintingVal == "true"

	return linting
}

func (f *DashboardLinterFactory) ConfigPath() string {
	return ".dashboard-lint"
}

type DashboardLinter struct {
	rules lint.RuleSet
	cfg   lint.ConfigurationFile
}

// FIXME: what would be a good place to put all the schema validation?
type specData struct {
	Spec json.RawMessage `json:"spec"`
}

func NewDashboardLinter() *DashboardLinter {
	// TODO: read rules from configuration and pass to the lint function
	return &DashboardLinter{rules: lint.NewRuleSet()}
}

func (l *DashboardLinter) Lint(ctx context.Context, buf []byte) ([]provisioning.LintIssue, error) {
	var data specData
	// Try to parse the spec from data
	if err := json.Unmarshal(buf, &data); err == nil && len(data.Spec) > 0 {
		buf = data.Spec
	}

	dashboard, err := lint.NewDashboard(buf)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dashboard with linter: %v", err)
	}

	results, err := l.rules.Lint([]lint.Dashboard{dashboard})
	if err != nil {
		return nil, fmt.Errorf("failed to lint dashboard: %v", err)
	}

	results.Configure(&l.cfg)

	byRule := results.ByRule()
	rules := make([]string, 0, len(byRule))
	for r := range byRule {
		rules = append(rules, r)
	}
	sort.Strings(rules)

	issues := make([]provisioning.LintIssue, 0)
	for _, rule := range rules {
		for _, rr := range byRule[rule] {
			for _, r := range rr.Result.Results {
				if r.Severity != lint.Error && r.Severity != lint.Warning {
					continue
				}

				issues = append(issues, provisioning.LintIssue{
					Rule:     rule,
					Severity: toLintSeverity(r.Severity),
					Message:  r.Message,
				})
			}
		}
	}

	return issues, nil
}

func toLintSeverity(s lint.Severity) provisioning.LintSeverity {
	switch s {
	case lint.Error:
		return provisioning.LintSeverityError
	case lint.Exclude:
		return provisioning.LintSeverityExclude
	case lint.Fixed:
		return provisioning.LintSeverityFixed
	case lint.Quiet:
		return provisioning.LintSeverityQuiet
	case lint.Warning:
		return provisioning.LintSeverityWarning
	default:
	}
	return "" // unknown
}
