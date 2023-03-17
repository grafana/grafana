package validator

import "context"

type FakeUsageStatsValidator struct{}

func (uss *FakeUsageStatsValidator) ShouldBeReported(ctx context.Context, dsType string) bool {
	return true
}
