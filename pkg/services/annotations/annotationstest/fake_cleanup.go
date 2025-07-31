package annotationstest

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type fakeCleaner struct{}

func NewFakeCleaner() *fakeCleaner {
	return &fakeCleaner{}
}

func (f *fakeCleaner) Run(ctx context.Context, cfg *setting.Cfg) (int64, int64, error) {
	return 0, 0, nil
}
