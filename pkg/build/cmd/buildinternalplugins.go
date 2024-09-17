package main

import (
	"context"
	"log"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/plugins"
	"github.com/grafana/grafana/pkg/build/syncutil"
)

func BuildInternalPlugins(c *cli.Context) error {
	cfg := config.Config{
		NumWorkers: c.Int("jobs"),
	}

	const grafanaDir = "."
	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}
	buildConfig, err := config.GetBuildConfig(metadata.ReleaseMode.Mode)
	if err != nil {
		return err
	}

	log.Println("Building internal Grafana plug-ins...")

	ctx := context.Background()

	p := syncutil.NewWorkerPool(cfg.NumWorkers)
	defer p.Close()

	var g *errutil.Group
	g, ctx = errutil.GroupWithContext(ctx)
	if err := plugins.Build(ctx, grafanaDir, p, g, buildConfig); err != nil {
		return cli.Exit(err.Error(), 1)
	}
	if err := g.Wait(); err != nil {
		return cli.Exit(err.Error(), 1)
	}

	if err := plugins.Download(ctx, grafanaDir, p); err != nil {
		return cli.Exit(err.Error(), 1)
	}

	log.Println("Successfully built Grafana plug-ins!")

	return nil
}
