package pipelines

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"time"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/gcom"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
)

func VersionPayloadFromFileName(name string, opts *gcom.GCOMOpts) *gcom.GCOMVersionPayload {
	var (
		tarOpts      = TarOptsFromFileName(name)
		splitVersion = strings.Split(tarOpts.Version, ".")
		stable       = true
		nightly      = false
		beta         = false
	)

	if opts.Beta {
		stable = false
		beta = true
	}
	if opts.Nightly {
		stable = false
		beta = false
		nightly = true
	}

	return &gcom.GCOMVersionPayload{
		Version:         tarOpts.Version,
		ReleaseDate:     time.Now().Format(time.RFC3339Nano),
		Stable:          stable,
		Beta:            beta,
		Nightly:         nightly,
		WhatsNewURL:     fmt.Sprintf("https://grafana.com/docs/grafana/next/whatsnew/whats-new-in-v%s-%s/", splitVersion[0], splitVersion[1]),
		ReleaseNotesURL: "https://grafana.com/docs/grafana/next/release-notes/",
	}
}

func PackagePayloadFromFile(ctx context.Context, d *dagger.Client, name string, file *dagger.File, opts *gcom.GCOMOpts) (*gcom.GCOMPackagePayload, error) {
	tarOpts := TarOptsFromFileName(name)
	ext := filepath.Ext(name)
	os, _ := backend.OSAndArch(tarOpts.Distro)
	arch := strings.ReplaceAll(backend.FullArch(tarOpts.Distro), "/", "")

	if os == "windows" {
		os = "win"
	}

	if ext == ".deb" {
		os = "deb"
	}
	if ext == ".rpm" {
		os = "rhel"
	}
	if ext == ".exe" {
		os = "win-installer"
	}

	sha256, err := containers.Sha256(d, file).Contents(ctx)
	if err != nil {
		return nil, err
	}

	return &gcom.GCOMPackagePayload{
		OS:     os,
		URL:    opts.DownloadURL.JoinPath(name).String(),
		Sha256: sha256,
		Arch:   arch,
	}, nil
}

func PublishGCOM(ctx context.Context, d *dagger.Client, args PipelineArgs) error {
	var (
		opts = args.GCOMOpts
		wg   = &errgroup.Group{}
		sm   = semaphore.NewWeighted(args.ConcurrencyOpts.Parallel)
	)

	packages, err := containers.GetPackages(ctx, d, args.PackageInputOpts, args.GCPOpts)
	if err != nil {
		return err
	}

	// Extract the package versions
	versionPayloads := make(map[string]*gcom.GCOMVersionPayload)
	for _, name := range args.PackageInputOpts.Packages {
		tarOpts := TarOptsFromFileName(name)
		if _, ok := versionPayloads[tarOpts.Version]; !ok {
			log.Printf("[%s] Building version payload", tarOpts.Version)
			versionPayloads[tarOpts.Version] = VersionPayloadFromFileName(name, opts)
		}
	}

	// Publish each version only once
	for _, p := range versionPayloads {
		log.Printf("[%s] Attempting to publish version", p.Version)
		out, err := gcom.PublishGCOMVersion(ctx, d, p, opts)
		if err != nil {
			return err
		}
		log.Printf("[%s] Done publishing version", p.Version)
		if _, err := fmt.Fprintln(Stdout, strings.ReplaceAll(out, "\n", "")); err != nil {
			return fmt.Errorf("error writing to stdout: %w", err)
		}
	}

	// Publish the package(s)
	for i, name := range args.PackageInputOpts.Packages {
		wg.Go(PublishGCOMPackageFunc(ctx, sm, d, opts, name, packages[i]))
	}
	return wg.Wait()
}

func PublishGCOMPackageFunc(ctx context.Context, sm *semaphore.Weighted, d *dagger.Client, opts *gcom.GCOMOpts, path string, file *dagger.File) func() error {
	return func() error {
		name := filepath.Base(path)
		tarOpts := TarOptsFromFileName(name)
		log.Printf("[%s] Attempting to publish package", name)
		log.Printf("[%s] Acquiring semaphore", name)
		if err := sm.Acquire(ctx, 1); err != nil {
			return fmt.Errorf("failed to acquire semaphore: %w", err)
		}
		defer sm.Release(1)
		log.Printf("[%s] Acquired semaphore", name)

		log.Printf("[%s] Building package payload", name)
		packagePayload, err := PackagePayloadFromFile(ctx, d, name, file, opts)
		if err != nil {
			return fmt.Errorf("[%s] error: %w", name, err)
		}

		log.Printf("[%s] Publishing package", name)
		out, err := gcom.PublishGCOMPackage(ctx, d, packagePayload, opts, tarOpts.Version)
		if err != nil {
			return fmt.Errorf("[%s] error: %w", name, err)
		}
		log.Printf("[%s] Done publishing package", name)

		if _, err := fmt.Fprintln(Stdout, strings.ReplaceAll(out, "\n", "")); err != nil {
			return fmt.Errorf("error writing to stdout: %w", err)
		}
		return nil
	}
}
