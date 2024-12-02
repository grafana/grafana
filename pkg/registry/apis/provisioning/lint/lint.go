package lint

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type Linter interface {
	ConfigPath() string
	Lint(ctx context.Context, cfg []byte, data []byte) ([]provisioning.LintIssue, error)
}
