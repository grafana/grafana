package managertest

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/kmsproviders"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats/usagestatstest"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

type provider[S any] func(tracing.Tracer, secrets.Store, kmsproviders.Service, encryption.Internal, *setting.Cfg, featuremgmt.FeatureToggles, usagestats.Service) (S, error)

func SetupService[S any](provide provider[S], tb testing.TB,
	store secrets.Store, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
) S {
	return SetupServiceWithFeatures(provide, tb, store, featuremgmt.WithFeatures())
}

func SetupServiceWithFeatures[S any](provide provider[S], tb testing.TB,
	store secrets.Store, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	features featuremgmt.FeatureToggles,
) S {
	tb.Helper()
	defaultKey := "SdlklWklckeLS"
	raw, err := ini.Load([]byte(`
		[security]
		secret_key = ` + defaultKey + `

		[security.encryption]
		data_keys_cache_ttl = 5m
		data_keys_cache_cleanup_interval = 1ns`))
	require.NoError(tb, err)

	cfg := &setting.Cfg{Raw: raw}

	encProvider := encryptionprovider.Provider{}
	usageStats := &usagestatstest.UsageStatsMock{}

	encryption, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encProvider, usageStats, cfg)
	require.NoError(tb, err)

	secretsService, err := provide(
		tracing.InitializeTracerForTest(),
		store,
		osskmsproviders.ProvideService(encryption, cfg, features),
		encryption,
		cfg,
		features,
		&usagestatstest.UsageStatsMock{T: tb},
	)
	require.NoError(tb, err)

	return secretsService
}
