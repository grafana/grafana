package main

import (
	"context"
	"log"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/gpg"
	"github.com/grafana/grafana/pkg/build/packaging"
	"github.com/grafana/grafana/pkg/build/syncutil"
)

func Package(c *cli.Context) error {
	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return err
	}

	edition := config.Edition(c.String("edition"))

	releaseMode, err := metadata.GetReleaseMode()
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	releaseModeConfig, err := config.GetBuildConfig(metadata.ReleaseMode.Mode)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	cfg := config.Config{
		NumWorkers:   c.Int("jobs"),
		SignPackages: c.Bool("sign"),
	}

	ctx := context.Background()

	variants := []config.Variant{}
	variantStrs := strings.Split(c.String("variants"), ",")
	if c.String("variants") != "" {
		for _, varStr := range variantStrs {
			if varStr == "" {
				continue
			}
			variants = append(variants, config.Variant(varStr))
		}
	} else {
		variants = releaseModeConfig.Variants
	}

	if len(variants) == 0 {
		variants = config.AllVariants
	}

	log.Printf("Packaging Grafana version %q, version mode %s, %s edition, variants %s", metadata.GrafanaVersion, releaseMode.Mode,
		edition, strings.Join(variantStrs, ","))

	if cfg.SignPackages {
		if err := gpg.LoadGPGKeys(&cfg); err != nil {
			return cli.Exit(err, 1)
		}
		defer gpg.RemoveGPGFiles(cfg)
		if err := gpg.Import(cfg); err != nil {
			return cli.Exit(err, 1)
		}
	}

	p := syncutil.NewWorkerPool(cfg.NumWorkers)
	defer p.Close()

	if err := packaging.PackageGrafana(ctx, metadata.GrafanaVersion, ".", cfg, edition, variants, releaseModeConfig.PluginSignature.Sign, p); err != nil {
		return cli.Exit(err, 1)
	}

	log.Println("Successfully packaged Grafana!")
	return nil
}
