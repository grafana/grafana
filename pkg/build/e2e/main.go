package main

import (
	"context"
	"flag"
	"log"
	"os"
	"path"

	"dagger.io/dagger"
)

func main() {
	var (
		ctx           = context.Background()
		grafanaPath   = flag.String("grafana-dir", ".", "Path to cloned grafana repo")
		targzPath     = flag.String("package", "grafana.tar.gz", "Path to grafana tar.gz package")
		suite         = flag.String("suite", "", "E2E test suite path (e.g. e2e/various-suite)")
		licensePath   = flag.String("license", "", "the path to the Grafana Enterprise license file (optional)")
		runnerFlags   = flag.String("flags", "", "flags to pass through to the e2e runner")
		imageRenderer = flag.Bool("image-renderer", false, "install the image renderer plugin")
	)
	flag.Parse()

	d, err := dagger.Connect(ctx)
	if err != nil {
		panic(err)
	}

	yarnCache := d.CacheVolume("yarn")

	log.Println("grafana dir:", *grafanaPath)
	log.Println("targz:", *targzPath)
	log.Println("license path:", *licensePath)

	grafana := d.Host().Directory(".", dagger.HostDirectoryOpts{
		Exclude: []string{"node_modules", "*.tar.gz"},
	})

	targz := d.Host().File("grafana.tar.gz")
	var license *dagger.File
	if *licensePath != "" {
		license = d.Host().File(*licensePath)
	}

	svc, err := GrafanaService(ctx, d, GrafanaServiceOpts{
		GrafanaDir:           grafana,
		GrafanaTarGz:         targz,
		YarnCache:            yarnCache,
		License:              license,
		InstallImageRenderer: *imageRenderer,
	})
	if err != nil {
		panic(err)
	}

	videosDir := path.Join("/src", *suite, "videos")
	// *spec.ts.mp4
	c := RunSuite(d, svc, grafana, yarnCache, *suite, *runnerFlags)
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
