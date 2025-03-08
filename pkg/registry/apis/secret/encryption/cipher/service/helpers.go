package service

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/setting"
)

func SetupTestService(tb testing.TB) *Service {
	tb.Helper()

	usMock := &usagestats.UsageStatsMock{T: tb}
	settings := setting.NewCfg()

	service, err := ProvideEncryptionService(tracing.InitializeTracerForTest(), usMock, settings)
	require.NoError(tb, err)

	return service
}
