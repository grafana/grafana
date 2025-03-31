package main

import (
	"context"
	"flag"
	"log"

	"dagger.io/dagger"
)

func main() {
	var (
		ctx         = context.Background()
		grafanaPath = flag.String("grafana-dir", ".", "Path to cloned grafana repo")
		targzPath   = flag.String("package", "grafana.tar.gz", "Path to grafana tar.gz package")
		suite       = flag.String("suite", "", "e2e suite name (used in arg to run-suite script)")
	)
	flag.Parse()

	d, err := dagger.Connect(ctx)
	if err != nil {
		panic(err)
	}

	yarnCache := d.CacheVolume("yarn")

	log.Println("grafana dir:", *grafanaPath)
	log.Println("targz:", *targzPath)

	grafana := d.Host().Directory(".", dagger.HostDirectoryOpts{
		Exclude: []string{".git", "node_modules", "*.tar.gz"},
	})

	targz := d.Host().File("grafana.tar.gz")

	svc, err := GrafanaService(ctx, d, GrafanaServiceOpts{
		GrafanaDir:   grafana,
		GrafanaTarGz: targz,
		YarnCache:    yarnCache,
	})
	if err != nil {
		panic(err)
	}

	// *spec.ts.mp4
	videos := RunSuiteVideos(d, svc, grafana, yarnCache, *suite)
	if _, err := videos.Export(ctx, "videos"); err != nil {
		panic(err)
	}
}
