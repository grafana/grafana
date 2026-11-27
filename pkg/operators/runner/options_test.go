package runner

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

func TestParseOptions(t *testing.T) {
	defaults := Options{Workers: 2, Resync: 30 * time.Second, NATSResync: 5 * time.Minute, DrainTimeout: 10 * time.Second}

	t.Run("defaults without NATS", func(t *testing.T) {
		require.Equal(t, Options{Workers: 2, Resync: 30 * time.Second, DrainTimeout: 10 * time.Second}, parseOptions(setting.NewCfg(), defaults, true))
	})

	t.Run("NATS resync default", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.NATS.Enabled = true
		require.Equal(t, 5*time.Minute, parseOptions(cfg, defaults, true).Resync)
	})

	t.Run("unusable NATS keeps the re-list resync", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.NATS.Enabled = true
		require.Equal(t, 30*time.Second, parseOptions(cfg, defaults, false).Resync)
	})

	t.Run("configured keys win", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.NATS.Enabled = true
		sec := cfg.SectionWithEnvOverrides("operator")
		sec.Key("worker_count").SetValue("4")
		sec.Key("resync_interval").SetValue("1m")
		sec.Key("drain_timeout").SetValue("2s")
		require.Equal(t, Options{Workers: 4, Resync: time.Minute, DrainTimeout: 2 * time.Second}, parseOptions(cfg, defaults, true))
	})
}

func TestValidateExternalNATS(t *testing.T) {
	for _, tc := range []struct {
		name string
		nats setting.NATSSettings
		err  string
	}{
		{name: "disabled", nats: setting.NATSSettings{Mode: setting.NATSModeEmbedded}},
		{name: "external with URLs", nats: setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{"nats://nats:4222"}}},
		{name: "embedded", nats: setting.NATSSettings{Enabled: true, Mode: setting.NATSModeEmbedded}, err: `mode must be "external"`},
		{name: "external without URLs", nats: setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal}, err: "client_urls must be set"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.NATS = tc.nats
			err := validateExternalNATS(cfg)
			if tc.err == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, tc.err)
		})
	}
}

func TestRunRequireExternalNATS(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeEmbedded}
	built := false
	op := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
		built = true
		return nil, context.Canceled
	}}

	strict := op
	strict.RequireExternalNATS = true
	require.ErrorContains(t, strict.Run(t.Context(), server.OperatorDependencies{Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: server.NewHealthNotifier()}), `mode must be "external"`)
	require.False(t, built, "a strict operator must fail before building")

	require.ErrorIs(t, op.Run(t.Context(), server.OperatorDependencies{Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: server.NewHealthNotifier()}), context.Canceled)
	require.True(t, built, "other operators only warn")
}

func TestRunWithoutNATSURLsFallsBackToRelists(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal}
	ran := false
	op := Operator{
		Name:     "test",
		Defaults: Options{Resync: 30 * time.Second, NATSResync: 5 * time.Minute},
		Build: func(rt *Runtime) (*Parts, error) {
			require.Nil(t, rt.Subscriber, "an unusable subscriber must not be started")
			require.Equal(t, 30*time.Second, rt.Options.Resync)
			return &Parts{Run: func(_ context.Context, ready func()) error {
				ran = true
				ready()
				return nil
			}}, nil
		},
	}

	require.NoError(t, op.Run(t.Context(), server.OperatorDependencies{Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: server.NewHealthNotifier()}))
	require.True(t, ran, "the operator must reach Run")
}
