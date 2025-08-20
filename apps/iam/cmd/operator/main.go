package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/iam/pkg/app"
)

func main() {
	// Configure the default logger to use slog
	logging.DefaultLogger = logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))

	//Load the config from the environment
	cfg, err := LoadConfigFromEnv()
	if err != nil {
		logging.DefaultLogger.With("error", err).Error("Unable to load config from environment")
		panic(err)
	}

	// Set up tracing
	if cfg.OTelConfig.Host != "" {
		err = simple.SetTraceProvider(simple.OpenTelemetryConfig{
			Host:        cfg.OTelConfig.Host,
			Port:        cfg.OTelConfig.Port,
			ConnType:    cfg.OTelConfig.ConnType,
			ServiceName: cfg.OTelConfig.ServiceName,
		})
		if err != nil {
			logging.DefaultLogger.With("error", err).Error("Unable to set trace provider")
			panic(err)
		}
	}

	// Create the operator config and the runner
	operatorConfig := operator.RunnerConfig{
		KubeConfig: cfg.KubeConfig.RestConfig,
		WebhookConfig: operator.RunnerWebhookConfig{
			Port: cfg.WebhookServer.Port,
			TLSConfig: k8s.TLSConfig{
				CertPath: cfg.WebhookServer.TLSCertPath,
				KeyPath:  cfg.WebhookServer.TLSKeyPath,
			},
		},
		MetricsConfig: operator.RunnerMetricsConfig{
			Enabled: true,
		},
	}

	runner, err := operator.NewRunner(operatorConfig)
	if err != nil {
		logging.DefaultLogger.With("error", err).Error("Unable to create operator runner")
		panic(err)
	}

	// Context and cancel for the operator's Run method
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, os.Kill)
	defer cancel()

	// Create app config from operator config
	appCfg := app.AppConfig{
		ZanzanaAddr:               cfg.ZanzanaClient.Addr,
		FolderReconcilerNamespace: cfg.FolderReconciler.Namespace,
	}

	// Run
	logging.DefaultLogger.Info("Starting operator")
	err = runner.Run(ctx, app.Provider(appCfg))
	if err != nil {
		logging.DefaultLogger.With("error", err).Error("Operator exited with error")
		panic(err)
	}
	logging.DefaultLogger.Info("Normal operator exit")
}
