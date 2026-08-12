package validator

import (
	"context"
	"strings"
)

type FakeUsageStatsValidator struct{}

func (uss *FakeUsageStatsValidator) ShouldBeReported(ctx context.Context, s string) bool {
	return !strings.HasPrefix(s, "unknown")
}
