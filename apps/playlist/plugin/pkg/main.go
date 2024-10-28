package main

import (
	"context"
	"os"
	"os/signal"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/plugin"
	pluginapp "github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/apps/playlist/pkg/app"
)

func main() {
	kubeConfigPath := ".kubeconfig"
	if p := os.Getenv("KUBECONFIG"); p != "" {
		kubeConfigPath = p
	}

	var restConfig operator.RestConfig
	err := operator.LoadOperatorRestConfig(kubeConfigPath, operator.RestConfigOptions{}, &restConfig)
	if err != nil {
		log.DefaultLogger.With("error", err).Error("Unable to load kubernetes configuration")
		panic(err)
	}

	pluginConfig := plugin.RunnerConfig{
		KubeConfig: restConfig,
		MetricsConfig: plugin.RunnerMetricsConfig{
			Enabled: true,
		},
	}
	runner := plugin.NewRunner(pluginConfig)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, os.Kill)
	defer cancel()

	log.DefaultLogger.Info("Starting plugin runner")
	go func() {
		err = runner.Run(ctx, app.Provider(nil))
		if err != nil {
			log.DefaultLogger.With("error", err).Error("plugin runner exited with error")
			panic(err)
		}
		log.DefaultLogger.Info("Normal operator exit")
	}()
	if err := pluginapp.Manage("grafana-playlist-app", runner.GetInstanceFactoryFunc(), pluginapp.ManageOpts{}); err != nil {
		log.DefaultLogger.With("error", err).Error("plugin runner exited with error")
		os.Exit(1)
	}
}
