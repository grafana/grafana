package main

import (
	"log"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/frontend"
	"github.com/grafana/grafana/pkg/build/syncutil"
)

func BuildFrontendPackages(c *cli.Context) error {
	version := ""
	if c.NArg() == 1 {
		// Fixes scenario where an incompatible semver is provided to lerna, which will cause the step to fail.
		// When there is an invalid semver, a frontend package won't be published anyways.
		if strings.Count(version, ".") == 2 {
			version = strings.TrimPrefix(c.Args().Get(0), "v")
		}
	}

	cfg, mode, err := frontend.GetConfig(c, version)
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
