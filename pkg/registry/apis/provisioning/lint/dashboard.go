package lint

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/dashboard-linter/lint"
)

type DashboardLinter struct {
	rules lint.RuleSet
}

// FIXME: what would be a good place to put all the schema validation?
type specData struct {
	Spec json.RawMessage `json:"spec"`
}

func NewDashboardLinter() *DashboardLinter {
	// TODO: read rules from configuration and pass to the lint function
	return &DashboardLinter{rules: lint.NewRuleSet()}
}

func (l *DashboardLinter) Lint(ctx context.Context, fileData []byte) ([]Issue, error) {
	var data specData
	if err := json.Unmarshal(fileData, &data); err != nil {
		return nil, fmt.Errorf("unmarshal file data into spec: %w", err)
	}

	dashboard, err := lint.NewDashboard(data.Spec)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dashboard with linter: %v", err)
	}

	results, err := l.rules.Lint([]lint.Dashboard{dashboard})
	if err != nil {
		return nil, fmt.Errorf("failed to lint dashboard: %v", err)
	}

	byRule := results.ByRule()
	rules := make([]string, 0, len(byRule))
	for r := range byRule {
		rules = append(rules, r)
	}
	sort.Strings(rules)

	issues := make([]Issue, 0)
	for _, rule := range rules {
		for _, rr := range byRule[rule] {
			for _, r := range rr.Result.Results {
				if r.Severity != lint.Error && r.Severity != lint.Warning {
					continue
				}

				issues = append(issues, Issue{
					Rule:     rule,
					Severity: r.Severity,
					Message:  r.Message,
				})
			}
		}
	}

	return issues, nil
}
