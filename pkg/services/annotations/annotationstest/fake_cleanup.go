package annotationstest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/annotations"
)

type fakeCleaner struct {
}

func NewFakeCleaner() *fakeCleaner {
	return &fakeCleaner{}
}

func (f *fakeCleaner) Run(_ context.Context, _ annotations.CleanupSettings) (int64, int64, error) {
	return 0, 0, nil
}
