package jwt

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/square/go-jose.v2/jwt"
)

func TestJWTGeneration(t *testing.T) {
	enableFeature := func(t *testing.T, cfg *setting.Cfg) {
		t.Helper()
		features = featuremgmt.WithFeatures(featuremgmt.FlagJwtTokenGeneration)
		t.Cleanup(func() {
			features = featuremgmt.WithFeatures()
		})
	}

	pluginScenario(t, "verifies a generated token when feature is enabled", func(t *testing.T, sc pluginScenarioContext) {
		token, err := sc.authJWTSvc.Generate(subject, "grafana-example-datasource")
		require.NoError(t, err)
		require.NotEmpty(t, token)
		_, err = sc.authJWTSvc.Verify(sc.ctx, token)
		require.NoError(t, err)
	}, enableFeature)

	pluginScenario(t, "rejects a token signed by another keyset", func(t *testing.T, sc pluginScenarioContext) {
		token := sign(t, &jwKeys[0], jwt.Claims{Subject: subject})
		_, err := sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	}, enableFeature)

	pluginScenario(t, "rejects a generated token when feature is disabled", func(t *testing.T, sc pluginScenarioContext) {
		token, err := sc.authJWTSvc.Generate(subject, "grafana-example-datasource")
		require.Error(t, err)
		require.Empty(t, token)
		_, err = sc.authJWTSvc.Verify(sc.ctx, token)
		require.Error(t, err)
	})
}

func pluginScenario(t *testing.T, desc string, fn pluginScenarioFunc, cbs ...configureFunc) {
	t.Helper()
	t.Run(desc, pluginScenarioRunner(fn, cbs...))
}

func initPluginAuthService(t *testing.T, cbs ...configureFunc) (*pluginAuthService, error) {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.JWTAuthEnabled = true
	cfg.JWTAuthExpectClaims = "{}"

	for _, cb := range cbs {
		cb(t, cfg)
	}

	service := newPluginAuthService(cfg, features, kvstore.NewFakeSecretsKVStore())
	err := service.init()
	return service, err
}

type pluginScenarioFunc func(*testing.T, pluginScenarioContext)

type pluginScenarioContext struct {
	ctx        context.Context
	authJWTSvc *pluginAuthService
	cfg        *setting.Cfg
}

func pluginScenarioRunner(fn pluginScenarioFunc, cbs ...configureFunc) func(t *testing.T) {
	return func(t *testing.T) {
		authJWTSvc, err := initPluginAuthService(t, cbs...)
		require.NoError(t, err)

		fn(t, pluginScenarioContext{
			ctx:        context.Background(),
			cfg:        authJWTSvc.Cfg,
			authJWTSvc: authJWTSvc,
		})
	}
}
