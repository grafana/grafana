package pullrequest

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	// RepositoryAdminURL links to the repository's management page in the
	// Grafana UI (…/admin/provisioning/<name>), so readers land where they
	// manage the sync rather than on the raw git remote. Empty only when the
	// Grafana base URL cannot be parsed.
	RepositoryAdminURL string

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

	// SourceURL links to the file in the git repository (empty when the
	// repository does not expose web URLs, e.g. non-GitHub backends)
	SourceURL string

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

// URLProvider yields the two base URLs Grafana uses when referring to itself
// from a PR comment. They split because consumers differ:
//
//   - Internal builds the dashboard view and preview URLs surfaced as
//     clickable links. Reviewers click these from their own browsers — usually
//     from inside the corp network — so the canonical AppURL works.
//   - Public prefixes screenshot images embedded in the same comment. These
//     images are fetched server-side by the Git provider's image proxy, so
//     the URL must be reachable from the public internet.
//
// Operator deployments that don't need the split can set both fields to the
// same closure.
type URLProvider struct {
	Internal func(ctx context.Context, namespace string) string
	Public   func(ctx context.Context, namespace string) string
}

type evaluator struct {
	render  ScreenshotRenderer
	parsers resources.ParserFactory
	urls    URLProvider
	metrics screenshotMetrics
}

func NewEvaluator(render ScreenshotRenderer, parsers resources.ParserFactory, urls URLProvider, registry prometheus.Registerer) Evaluator {
	metrics := registerScreenshotMetrics(registry)
	return &evaluator{
		render:  render,
		parsers: parsers,
		urls:    urls,
		metrics: metrics,
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
	shouldRender := rendererAvailable && len(changes) == 1 && cfg.ShouldGenerateDashboardPreviews()
	baseURL := e.urls.Internal(ctx, cfg.Namespace)
	orgID := orgIDForLinks(cfg.Namespace)
	info := changeInfo{
		GrafanaBaseURL:       baseURL,
		RepositoryName:       cfg.Name,
		RepositoryTitle:      cfg.Spec.Title,
		RepositoryAdminURL:   repositoryAdminURL(baseURL, cfg.Name, orgID),
		MissingImageRenderer: !rendererAvailable,
	}
	screenshotBaseURL := e.urls.Public(ctx, cfg.Namespace)

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
		info.Changes = append(info.Changes, e.evaluateFile(ctx, repo, info.GrafanaBaseURL, screenshotBaseURL, orgID, change, opts, parser, shouldRender))
	}

	return info, nil
}

var dashboardKind = dashboard.DashboardResourceInfo.GroupVersionKind().Kind
var folderKind = folder.FolderResourceInfo.GroupVersionKind().Kind

// grafanaResourceURL builds the Grafana UI link for a provisioned resource that
// already exists in Grafana. Dashboards live at /d/<uid>/<slug>; folders at
// /dashboards/f/<uid>/<slug>. Returns "" for kinds without a known view route
// (so the Resource column falls back to plain text) or when the base URL cannot
// be parsed.
func grafanaResourceURL(baseURL, kind, name, title string, orgID int64) string {
	var pathParts []string
	switch kind {
	case dashboardKind:
		pathParts = []string{"d", name, slugify.Slugify(title)}
	case folderKind:
		pathParts = []string{"dashboards", "f", name, slugify.Slugify(title)}
	default:
		return ""
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		return ""
	}
	u = u.JoinPath(pathParts...)
	if orgID > 0 {
		query := url.Values{}
		query.Set("orgId", strconv.FormatInt(orgID, 10))
		u.RawQuery = query.Encode()
	}
	return u.String()
}

// stripUserinfo removes any embedded credentials (userinfo) from a URL so a
// repository configured with an HTTPS URL like https://user:token@host/org/repo
// never renders that token into a public PR comment. Returns "" when the URL
// cannot be parsed, to avoid leaking a malformed credential-bearing string.
func stripUserinfo(raw string) string {
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	u.User = nil
	return u.String()
}

// repositoryAdminURL builds a link to the repository's management page in the
// Grafana UI (…/admin/provisioning/<name>), mirroring how GrafanaURL/PreviewURL
// are constructed. orgID pins the org for non-primary on-prem orgs the same way.
// Returns "" when the base URL cannot be parsed, so the footer falls back to
// plain text rather than rendering a broken link.
func repositoryAdminURL(baseURL, name string, orgID int64) string {
	u, err := url.Parse(baseURL)
	if err != nil {
		return ""
	}
	u = u.JoinPath("admin/provisioning", name)
	if orgID > 0 {
		query := url.Values{}
		query.Set("orgId", strconv.FormatInt(orgID, 10))
		u.RawQuery = query.Encode()
	}
	return u.String()
}

// orgIDForLinks returns the org to pin on PR-comment links when the repo lives
// in a non-primary org (on-prem org-N, N>=2). Main org (default), Cloud
// (stacks-N) and unresolved namespaces return 0, leaving links unscoped since
// the viewer's default org already resolves them.
func orgIDForLinks(namespace string) int64 {
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil || ns.OrgID <= 1 {
		return 0
	}
	return ns.OrgID
}

func (e *evaluator) evaluateFile(ctx context.Context, repo repository.Reader, baseURL string, screenshotBaseURL string, orgID int64, change repository.VersionedFileChange, opts provisioning.PullRequestJobOptions, parser resources.Parser, shouldRender bool) fileChangeInfo {
	if change.Action == repository.FileActionDeleted {
		return e.evaluateDeletedFile(ctx, repo, baseURL, orgID, change, parser)
	}

	info := fileChangeInfo{Change: change}
	fileInfo, err := repo.Read(ctx, change.Path, change.Ref)
	if err != nil {
		logger.Info("unable to read file", "err", err)
		info.Error = err.Error()
		return info
	}

	// Best-effort link back to the file in the git repository. Computed before
	// parsing so that parse/validation failures still link reviewers to the
	// source file. Repositories that don't expose web URLs (e.g. non-GitHub
	// backends) leave this empty.
	if urlsRepo, ok := repo.(repository.RepositoryWithURLs); ok {
		if urls, urlErr := urlsRepo.ResourceURLs(ctx, fileInfo); urlErr == nil && urls != nil {
			info.SourceURL = stripUserinfo(urls.SourceURL)
		}
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

	// Link back to the resource in Grafana when it already exists there.
	// Dashboards and folders both have view routes; other kinds fall back to
	// plain text in the comment.
	if info.Parsed.Existing != nil {
		info.GrafanaURL = grafanaResourceURL(baseURL, info.Parsed.GVK.Kind, obj.GetName(), info.Title, orgID)
	}

	// Dashboards additionally get a preview link and (optionally) screenshots.
	if info.Parsed.GVK.Kind == dashboardKind {
		// FIXME: extract the logic out of a dashboard URL builder/injector or similar
		// for testability and decoupling
		urlBuilder, err := url.Parse(baseURL)
		if err != nil {
			logger.Warn("Error parsing baseURL", "err", err)
			info.Error = err.Error()
			return info
		}

		// Load this file directly
		previewURL := urlBuilder.JoinPath("admin/provisioning", info.Parsed.Repo.Name, "dashboard/preview", info.Parsed.Info.Path)
		info.PreviewURL = previewURL.String()

		query := url.Values{}
		query.Set("ref", info.Parsed.Info.Ref)
		if opts.URL != "" {
			query.Set("pull_request_url", url.QueryEscape(opts.URL))
		}
		if orgID > 0 {
			query.Set("orgId", strconv.FormatInt(orgID, 10))
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
func (e *evaluator) evaluateDeletedFile(ctx context.Context, repo repository.Reader, baseURL string, orgID int64, change repository.VersionedFileChange, parser resources.Parser) fileChangeInfo {
	info := fileChangeInfo{Change: change}

	fileInfo, err := repo.Read(ctx, change.Path, change.PreviousRef)
	if err != nil {
		return info
	}

	// Best-effort link back to the file in the git repository. The file no
	// longer exists on the PR branch, so this points at the previous ref where
	// it still exists, letting reviewers see what was removed. Repositories that
	// don't expose web URLs (e.g. non-GitHub backends) leave this empty.
	if urlsRepo, ok := repo.(repository.RepositoryWithURLs); ok {
		if urls, urlErr := urlsRepo.ResourceURLs(ctx, fileInfo); urlErr == nil && urls != nil {
			info.SourceURL = stripUserinfo(urls.SourceURL)
		}
	}

	info.Parsed, err = parser.Parse(ctx, fileInfo)
	if err != nil {
		return info
	}

	obj := info.Parsed.Obj
	info.Title = info.Parsed.Meta.FindTitle(obj.GetName())

	// Parse only fills Parsed.Existing during DryRun/Run (via a live Get), and
	// deletions run neither. Fetch the live object directly so we can link back
	// to it in Grafana: at comment time the resource still exists because the
	// sync that removes it has not run yet. Best-effort — a missing object or a
	// permission error just leaves the Resource column as plain text.
	if info.Parsed.Client != nil {
		if idCtx, _, idErr := identity.WithProvisioningIdentity(ctx, obj.GetNamespace()); idErr == nil {
			if existing, getErr := info.Parsed.Client.Get(idCtx, obj.GetName(), metav1.GetOptions{}); getErr == nil {
				info.Parsed.Existing = existing
			}
		}
	}

	// Link back to the resource in Grafana when it still exists there (dashboards
	// and folders both have view routes); other kinds fall back to plain text.
	if info.Parsed.Existing != nil {
		info.GrafanaURL = grafanaResourceURL(baseURL, info.Parsed.GVK.Kind, obj.GetName(), info.Title, orgID)
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
	// orgId belongs only on the human-facing comment link, where OrgRedirect
	// switches the viewer's org on click. The render callback already
	// authenticates in the repository's org via the render-service identity, so
	// an orgId here would make OrgRedirect try to switch the render user instead.
	query := parsed.Query()
	query.Del("orgId")
	snap, err := renderer.RenderScreenshot(ctx, repo, strings.TrimPrefix(parsed.Path, "/"), query)
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
