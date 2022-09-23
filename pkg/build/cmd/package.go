package main

import (
	"context"
	"log"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/gpg"
	"github.com/grafana/grafana/pkg/build/packaging"
	"github.com/grafana/grafana/pkg/build/syncutil"
	"github.com/urfave/cli/v2"
)

func Package(c *cli.Context) error {
	metadata, err := GenerateMetadata(c)
	if err != nil {
		return err
	}

	edition := config.Edition(c.String("edition"))

	releaseMode, err := metadata.GetReleaseMode()
	if err != nil {
		return cli.NewExitError(err.Error(), 1)
	}

	releaseModeConfig, err := config.GetBuildConfig(metadata.ReleaseMode.Mode)
	if err != nil {
		return cli.NewExitError(err.Error(), 1)
	}

	cfg := config.Config{
		NumWorkers: c.Int("jobs"),
	}
	if err := gpg.LoadGPGKeys(&cfg); err != nil {
		return cli.Exit(err, 1)
	}
	defer gpg.RemoveGPGFiles(cfg)

	ctx := context.Background()

	variantStrs := strings.Split(c.String("variants"), ",")
	variants := []config.Variant{}
	for _, varStr := range variantStrs {
		if varStr == "" {
			continue
		}

		variants = append(variants, config.Variant(varStr))
	}

	if len(variants) == 0 {
		variants = config.AllVariants
	}

	log.Printf("Packaging Grafana version %q, version mode %s, %s edition, variants %s", metadata.GrafanaVersion, releaseMode.Mode,
		edition, strings.Join(variantStrs, ","))

	if err := gpg.Import(cfg); err != nil {
		return cli.Exit(err, 1)
	}

	p := syncutil.NewWorkerPool(cfg.NumWorkers)
	defer p.Close()

	if err := packaging.PackageGrafana(ctx, metadata.GrafanaVersion, ".", cfg, edition, variants, releaseModeConfig.PluginSignature.Sign, p); err != nil {
		return cli.Exit(err, 1)
	}

	log.Println("Successfully packaged Grafana!")
	return nil
}
