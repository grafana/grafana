package api

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"runtime"
	"time"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var (
	tracer = otel.Tracer("github.com/grafana/grafana/pkg/plugins/manager/sources/api")

	installRequestCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "plugins",
		Name:      "install_total",
		Help:      "The total amount of plugin installations",
	}, []string{"plugin_id", "version"})

	installRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "plugins",
		Name:      "install_duration_seconds",
		Help:      "Plugin installation duration",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
	}, []string{"plugin_id", "version"})
)

// InstallOrchestrator defines the interface for plugin installation orchestration
type InstallOrchestrator interface {
	// DownloadToDir downloads a plugin to a specific directory
	DownloadToDir(ctx context.Context, installPlugin install.PluginInstall, targetDir string) error
	// DownloadWithVersion downloads a plugin with version handling
	DownloadWithVersion(ctx context.Context, installPlugin install.PluginInstall) (string, error)
	// EnsureDependencies ensures all plugin dependencies are downloaded
	EnsureDependencies(ctx context.Context, archive *storage.ExtractedPluginArchive, ensureFunc func(context.Context, install.PluginInstall) (string, error)) error
}

// downloadOrchestrator coordinates plugin downloads and dependency resolution
type downloadOrchestrator struct {
	downloader   PluginDownloader
	cachePath    string
	buildVersion string
	log          log.Logger
}

// Ensure InstallOrchestrator implements InstallOrchestratorInterface
var _ InstallOrchestrator = (*downloadOrchestrator)(nil)

// PluginDownloader interface for downloading plugins
type PluginDownloader interface {
	Download(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error)
}

// NewDownloadOrchestrator creates a new install orchestrator
func NewDownloadOrchestrator(downloader PluginDownloader, cachePath, buildVersion string) InstallOrchestrator {
	return &downloadOrchestrator{
		downloader:   downloader,
		cachePath:    cachePath,
		buildVersion: buildVersion,
		log:          log.New("download.orchestrator"),
	}
}

// DownloadToDir downloads a plugin to a specific directory
func (d *downloadOrchestrator) DownloadToDir(ctx context.Context, installPlugin install.PluginInstall, targetDir string) error {
	ctx, span := tracer.Start(ctx, "InstallOrchestrator.DownloadToDir")
	defer span.End()

	span.SetAttributes(
		attribute.String("plugin.id", installPlugin.ID),
		attribute.String("plugin.version", installPlugin.Version),
		attribute.String("plugin.target_dir", targetDir),
	)

	start := time.Now()
	ctx = repo.WithRequestOrigin(ctx, "install")

	opts := plugins.NewAddOpts(d.buildVersion, runtime.GOOS, runtime.GOARCH, installPlugin.URL)
	dirFunc := func(pluginID string) string {
		return targetDir
	}
	opts = opts.WithCustomDirNameFunc(dirFunc)
	archive, err := d.downloader.Download(ctx, installPlugin.ID, installPlugin.Version, opts)
	if err != nil {
		var dupeErr plugins.DuplicateError
		if errors.As(err, &dupeErr) {
			span.AddEvent("plugin download already in progress", trace.WithAttributes(attribute.String("plugin.id", installPlugin.ID)))
			return err
		}
		return tracing.Errorf(span, "download failed: %w", err)
	}

	if archive == nil {
		return tracing.Errorf(span, "downloader returned nil archive")
	}

	span.SetStatus(codes.Ok, "plugin downloaded successfully")
	elapsed := time.Since(start)
	installRequestDuration.WithLabelValues(installPlugin.ID, archive.Version).Observe(elapsed.Seconds())
	installRequestCounter.WithLabelValues(installPlugin.ID, archive.Version).Inc()
	return nil
}

// DownloadWithVersion downloads a plugin with a known version to the versioned cache directory
func (d *downloadOrchestrator) DownloadWithVersion(ctx context.Context, installPlugin install.PluginInstall) (string, error) {
	versionedDir := fmt.Sprintf("%s-%s", installPlugin.ID, installPlugin.Version)
	err := d.DownloadToDir(ctx, installPlugin, versionedDir)
	if err != nil {
		return "", err
	}
	return filepath.Join(d.cachePath, versionedDir), nil
}

// EnsureDependencies handles dependency resolution for a plugin archive
func (d *downloadOrchestrator) EnsureDependencies(
	ctx context.Context,
	archive *storage.ExtractedPluginArchive,
	ensureFunc func(context.Context, install.PluginInstall) (string, error),
) error {
	ctx, span := tracer.Start(ctx, "InstallOrchestrator.EnsureDependencies")
	defer span.End()
	for _, dep := range archive.Dependencies {
		span.AddEvent("ensuring plugin dependency", trace.WithAttributes(
			attribute.String("dependency.id", dep.ID),
		))
		depPlugin := install.PluginInstall{
			ID:      dep.ID,
			Version: "",
			URL:     "",
		}

		_, err := ensureFunc(ctx, depPlugin)
		if err != nil {
			var dupeErr plugins.DuplicateError
			if errors.As(err, &dupeErr) {
				span.AddEvent("dependency already available", trace.WithAttributes(attribute.String("dependency.id", dep.ID)))
				continue
			}
			return tracing.Errorf(span, "failed to ensure dependency %s: %w", dep.ID, err)
		}
	}
	span.SetStatus(codes.Ok, "dependencies ensured successfully")
	return nil
}
