package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

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

	videosDir := fmt.Sprintf("/src/e2e/%s/videos", *suite)
	// *spec.ts.mp4
	c := RunSuite(d, svc, grafana, yarnCache, *suite)
	c, err = c.Sync(ctx)
	if err != nil {
		log.Fatalf("error running dagger: %s", err)
	}

	code, err := c.ExitCode(ctx)
	if err != nil {
		log.Fatalf("error getting exit code: %s", err)
	}

	log.Println("exit code:", code)

	// No sync error; export the videos dir
	if _, err := c.Directory(videosDir).Export(ctx, "videos"); err != nil {
		log.Fatalf("error getting videos: %s", err)
	}

	if code != 0 {
		log.Printf("tests failed: exit code %d", code)
	}

	os.Exit(code)
}
