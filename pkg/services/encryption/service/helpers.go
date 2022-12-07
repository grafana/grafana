package service

import (
	"testing"

	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func SetupTestService(tb testing.TB) *Service {
	tb.Helper()

	provider := encryptionprovider.ProvideEncryptionProvider()

	service, err := ProvideEncryptionService(provider, setting.NewCfg())
	require.NoError(tb, err)

	return service
}
