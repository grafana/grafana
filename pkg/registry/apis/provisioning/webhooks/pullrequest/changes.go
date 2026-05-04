package pullrequest

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
	"github.com/prometheus/client_golang/prometheus"
)

type changeInfo struct {
	GrafanaBaseURL string

	// Attribution: identifies which provisioning repository posted this comment
	RepositoryName  string
	RepositoryTitle string

	// Files we tried to read
	Changes []fileChangeInfo

	// More files changed than we processed
	SkippedFiles int

	// Requested image render, but it is not available
	MissingImageRenderer bool
}

func (c changeInfo) GrafanaHost() string {
	u, err := url.Parse(c.GrafanaBaseURL)
	if err != nil || u.Host == "" {
		return c.GrafanaBaseURL
	}
	return u.Host
}

type fileChangeInfo struct {
	Change repository.VersionedFileChange
	Error  string

	// The parsed value
	Parsed *resources.ParsedResource

	// The title from inside the resource (or name if not found)
	Title string

	// The URL where this will appear (target)
	GrafanaURL           string
	GrafanaScreenshotURL string

	// URL where we can see a preview of this particular change
	PreviewURL           string
	PreviewScreenshotURL string

	// HasRemovedMetadata is true when the original file contains metadata
	// fields (namespace, labels, annotations) that will be removed when parsing the resource.
	HasRemovedMetadata bool
}

type evaluator struct {
	render      ScreenshotRenderer
	parsers     resources.ParserFactory
	urlProvider func(ctx context.Context, namespace string) string
	metrics     screenshotMetrics
}

func NewEvaluator(render ScreenshotRenderer, parsers resources.ParserFactory, urlProvider func(ctx context.Context, namespace string) string, registry prometheus.Registerer) Evaluator {
	metrics := registerScreenshotMetrics(registry)
	return &evaluator{
		render:      render,
		parsers:     parsers,
		urlProvider: urlProvider,
		metrics:     metrics,
	}
}

// This will process the list of versioned file changes into changeInfo
func (e *evaluator) Evaluate(ctx context.Context, repo repository.Reader, opts provisioning.PullRequestJobOptions, changes []repository.VersionedFileChange, progress jobs.JobProgressRecorder) (changeInfo, error) {
	cfg := repo.Config()
	parser, err := e.parsers.GetParser(ctx, repo)
	if err != nil {
		return changeInfo{}, fmt.Errorf("failed to get parser for %s: %w", cfg.Name, err)
	}

	rendererAvailable := e.render.IsAvailable(ctx)
	shouldRender := rendererAvailable && len(changes) == 1 && cfg.Spec.GitHub.GenerateDashboardPreviews
	info := changeInfo{
		GrafanaBaseURL:       e.urlProvider(ctx, cfg.Namespace),
		RepositoryName:       cfg.Name,
		RepositoryTitle:      cfg.Spec.Title,
		MissingImageRenderer: !rendererAvailable,
	}

	// Screenshots embedded in PR comments must be reachable from outside the
	// cluster. Prefer the per-repository spec.webhook.baseUrl when set, since the
	// internal AppURL/urlProvider value typically points at a cluster-internal
	// host that GitHub cannot fetch images from.
	screenshotBaseURL := info.GrafanaBaseURL
	if cfg.Spec.Webhook != nil && cfg.Spec.Webhook.BaseURL != "" {
		screenshotBaseURL = cfg.Spec.Webhook.BaseURL
	}

	logger := logging.FromContext(ctx)

	for i, change := range changes {
		// process maximum 10 files
		if i >= 10 {
			info.SkippedFiles = len(changes) - i
			logger.Info("skipping remaining files", "count", info.SkippedFiles)
			break
		}

		progress.SetMessage(ctx, fmt.Sprintf("process %s", change.Path))
		logger.With("action", change.Action).With("path", change.Path)
		info.Changes = append(info.Changes, e.evaluateFile(ctx, repo, info.GrafanaBaseURL, screenshotBaseURL, change, opts, parser, shouldRender))
	}

	return info, nil
}

var dashboardKind = dashboard.DashboardResourceInfo.GroupVersionKind().Kind

func (e *evaluator) evaluateFile(ctx context.Context, repo repository.Reader, baseURL string, screenshotBaseURL string, change repository.VersionedFileChange, opts provisioning.PullRequestJobOptions, parser resources.Parser, shouldRender bool) fileChangeInfo {
	if change.Action == repository.FileActionDeleted {
		return e.evaluateDeletedFile(ctx, repo, baseURL, change, parser)
	}

	info := fileChangeInfo{Change: change}
	fileInfo, err := repo.Read(ctx, change.Path, change.Ref)
	if err != nil {
		logger.Info("unable to read file", "err", err)
		info.Error = err.Error()
		return info
	}

	// Read the file as a resource
	info.Parsed, err = parser.Parse(ctx, fileInfo)
	if err != nil {
		info.Error = err.Error()
		return info
	}

	if change.Action == repository.FileActionUpdated {
		// Detect metadata stripped by resource parser.
		// Read the file from the default branch (empty ref) and compare its
		// metadata against the PR-branch parsed version.
		baseFileInfo, baseErr := repo.Read(ctx, change.Path, "")
		if baseErr == nil && baseFileInfo != nil {
			baseObj, _, _, parseErr := resources.ParseFileResource(ctx, baseFileInfo)
			if parseErr == nil && baseObj != nil {
				info.HasRemovedMetadata = hasRemovedMetadata(baseObj, info.Parsed.Obj)
			}
		}
	}

	// Find a name within the file
	obj := info.Parsed.Obj
	info.Title = info.Parsed.Meta.FindTitle(obj.GetName())

	// Check what happens when we apply changes
	// NOTE: this will also invoke any server side validation
	err = info.Parsed.DryRun(ctx)
	if err != nil {
		info.Error = err.Error()
	}

	// Dashboards get special handling
	if info.Parsed.GVK.Kind == dashboardKind {
		// FIXME: extract the logic out of a dashboard URL builder/injector or similar
		// for testability and decoupling
		urlBuilder, err := url.Parse(baseURL)
		if err != nil {
			logger.Warn("Error parsing baseURL", "err", err)
			info.Error = err.Error()
			return info
		}

		if info.Parsed.Existing != nil {
			grafanaURL := urlBuilder.JoinPath("d", obj.GetName(), slugify.Slugify(info.Title))
			info.GrafanaURL = grafanaURL.String()
		}

		// Load this file directly
		previewURL := urlBuilder.JoinPath("admin/provisioning", info.Parsed.Repo.Name, "dashboard/preview", info.Parsed.Info.Path)
		info.PreviewURL = previewURL.String()

		query := url.Values{}
		query.Set("ref", info.Parsed.Info.Ref)
		if opts.URL != "" {
			query.Set("pull_request_url", url.QueryEscape(opts.URL))
		}
		info.PreviewURL += "?" + query.Encode()
		if shouldRender {
			if info.GrafanaURL != "" {
				info.GrafanaScreenshotURL, err = renderScreenshotFromGrafanaURL(ctx, screenshotBaseURL, e.render, info.Parsed.Repo, info.GrafanaURL, e.metrics)
				if err != nil {
					info.Error = err.Error()
				}
			}

			if info.PreviewURL != "" {
				info.PreviewScreenshotURL, err = renderScreenshotFromGrafanaURL(ctx, screenshotBaseURL, e.render, info.Parsed.Repo, info.PreviewURL, e.metrics)
				if err != nil {
					info.Error = err.Error()
				}
			}
		}
	}

	return info
}

// evaluateDeletedFile is best-effort: it tries to read and parse the file at
// the previous ref to extract metadata (kind, title, GrafanaURL)
func (e *evaluator) evaluateDeletedFile(ctx context.Context, repo repository.Reader, baseURL string, change repository.VersionedFileChange, parser resources.Parser) fileChangeInfo {
	info := fileChangeInfo{Change: change}

	fileInfo, err := repo.Read(ctx, change.Path, change.PreviousRef)
	if err != nil {
		return info
	}

	info.Parsed, err = parser.Parse(ctx, fileInfo)
	if err != nil {
		return info
	}

	obj := info.Parsed.Obj
	info.Title = info.Parsed.Meta.FindTitle(obj.GetName())

	if info.Parsed.GVK.Kind == dashboardKind {
		urlBuilder, err := url.Parse(baseURL)
		if err != nil {
			return info
		}
		if info.Parsed.Existing != nil {
			grafanaURL := urlBuilder.JoinPath("d", obj.GetName(), slugify.Slugify(info.Title))
			info.GrafanaURL = grafanaURL.String()
		}
	}

	return info
}

func renderScreenshotFromGrafanaURL(ctx context.Context,
	baseURL string,
	renderer ScreenshotRenderer,
	repo provisioning.ResourceRepositoryInfo,
	grafanaURL string,
	metrics screenshotMetrics,
) (string, error) {
	outcome := utils.ErrorOutcome
	duration := time.Now()
	defer func() {
		metrics.recordScreenshotDuration(outcome, time.Since(duration))
	}()
	parsed, err := url.Parse(grafanaURL)
	if err != nil {
		logging.FromContext(ctx).Warn("invalid", "url", grafanaURL, "err", err)
		return "", err
	}
	snap, err := renderer.RenderScreenshot(ctx, repo, strings.TrimPrefix(parsed.Path, "/"), parsed.Query())
	if err != nil {
		logging.FromContext(ctx).Warn("render failed", "url", grafanaURL, "err", err)
		return "", fmt.Errorf("error rendering screenshot: %w", err)
	}
	if strings.Contains(snap, "://") {
		return snap, nil // it is a full URL already (can happen when the blob storage returns CDN urls)
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		logger.Warn("invalid base", "url", baseURL, "err", err)
		return "", err
	}
	outcome = utils.SuccessOutcome
	return base.JoinPath(snap).String(), nil
}

// hasRemovedMetadata returns true if the original object (from the file)
// contains metadata fields (namespace, labels, annotations) that are absent
// or different in the parsed object (post-Parse).
func hasRemovedMetadata(original, parsed *unstructured.Unstructured) bool {
	if original.GetNamespace() != "" && parsed.GetNamespace() != original.GetNamespace() {
		return true
	}
	if len(original.GetLabels()) > 0 && hasMissingKeys(original.GetLabels(), parsed.GetLabels()) {
		return true
	}
	if len(original.GetAnnotations()) > 0 && hasMissingKeys(original.GetAnnotations(), parsed.GetAnnotations()) {
		return true
	}
	return false
}

// hasMissingKeys returns true if any key in original is absent from parsed.
func hasMissingKeys(original, parsed map[string]string) bool {
	for k := range original {
		if _, exists := parsed[k]; !exists {
			return true
		}
	}
	return false
}
