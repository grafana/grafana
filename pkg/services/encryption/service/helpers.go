package service

import (
	"testing"

	"github.com/stretchr/testify/require"

	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	"github.com/grafana/grafana/pkg/setting"
)

func SetupTestService(tb testing.TB) *Service {
	tb.Helper()

	provider := encryptionprovider.ProvideEncryptionProvider()
	settings := setting.NewCfg()

	service, err := ProvideEncryptionService(provider, settings)
	require.NoError(tb, err)

	return service
}
