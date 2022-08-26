package main

import (
	"log"
	"strings"

	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/frontend"
	"github.com/grafana/grafana/pkg/build/syncutil"
	"github.com/urfave/cli/v2"
)

func BuildFrontend(c *cli.Context) error {
	version := ""
	if c.NArg() == 1 {
		version = strings.TrimPrefix(c.Args().Get(0), "v")
	}

	cfg, mode, err := frontend.GetConfig(c, version)
	if err != nil {
		return err
	}

	p := syncutil.NewWorkerPool(cfg.NumWorkers)
	defer p.Close()

	g, _ := errutil.GroupWithContext(c.Context)
	if err := frontend.Build(mode, frontend.GrafanaDir, p, g); err != nil {
		return err
	}
	if err := g.Wait(); err != nil {
		return err
	}

	log.Println("Successfully built Grafana front-end!")

	return nil
}
