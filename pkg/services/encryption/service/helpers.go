package service

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func SetupTestService(tb testing.TB) *Service {
	tb.Helper()

	usMock := &usagestats.UsageStatsMock{T: tb}
	provider := encryptionprovider.ProvideEncryptionProvider()
	settings := &setting.OSSImpl{Cfg: setting.NewCfg()}

	service, err := ProvideEncryptionService(provider, usMock, settings)
	require.NoError(tb, err)

	return service
}
