package lint

import (
	"context"

	"github.com/grafana/dashboard-linter/lint"
)

type Issue struct {
	Severity lint.Severity
	Rule     string
	Message  string
}

type Linter interface {
	Lint(ctx context.Context, data []byte) ([]Issue, error)
}
