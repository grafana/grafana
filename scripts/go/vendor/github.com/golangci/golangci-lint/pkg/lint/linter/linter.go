package linter

import (
	"context"

	"github.com/golangci/golangci-lint/pkg/result"
)

type Linter interface {
	Run(ctx context.Context, lintCtx *Context) ([]result.Issue, error)
	Name() string
	Desc() string
}
