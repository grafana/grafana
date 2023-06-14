package main

import (
	"log"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/frontend"
	"github.com/grafana/grafana/pkg/build/syncutil"
	"github.com/urfave/cli/v2"
)

func BuildFrontendPackages(c *cli.Context) error {
	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}

	cfg, mode, err := frontend.GetConfig(c, metadata)
	if err != nil {
		return err
	}

	p := syncutil.NewWorkerPool(cfg.NumWorkers)
	defer p.Close()

	g, _ := errutil.GroupWithContext(c.Context)
	if err := frontend.BuildFrontendPackages(cfg.PackageVersion, mode, frontend.GrafanaDir, p, g); err != nil {
		return cli.Exit(err.Error(), 1)
	}
	if err := g.Wait(); err != nil {
		return cli.Exit(err.Error(), 1)
	}

	log.Println("Successfully built Grafana front-end packages!")

	return nil
}
