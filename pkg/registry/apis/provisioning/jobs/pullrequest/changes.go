package pullrequest

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type changeInfo struct {
	GrafanaBaseURL string

	// Files we tried to read
	Changes []fileChangeInfo

	// More files changed than we processed
	SkippedFiles int

	// Requested image render, but it is not available
	MissingImageRenderer bool
	HasScreenshot        bool
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
}

type changeOptions struct {
	grafanaBaseURL string
	pullRequest    provisioning.PullRequestJobOptions
	changes        []repository.VersionedFileChange
	parser         resources.Parser
	reader         repository.Reader
	progress       jobs.JobProgressRecorder
	render         ScreenshotRenderer // from config
}

// This will process the list of versioned file changes into changeInfo
func processChangedFiles(ctx context.Context, opts changeOptions) (changeInfo, error) {
	info := changeInfo{
		GrafanaBaseURL: opts.grafanaBaseURL,
	}

	if opts.render != nil {
		if !opts.render.IsAvailable(ctx) {
			info.MissingImageRenderer = true
			opts.render = nil
		}

		// Only render images when there is just one change
		if len(opts.changes) > 1 {
			opts.render = nil
		}
	}

	logger := logging.FromContext(ctx)
	for i, change := range opts.changes {
		// process maximum 10 files
		if i >= 10 {
			info.SkippedFiles = len(opts.changes) - i
			break
		}

		opts.progress.SetMessage(ctx, fmt.Sprintf("processing: %s", change.Path))
		logger.With("action", change.Action).With("path", change.Path)

		v, err := calculateFileChangeInfo(ctx, info.GrafanaBaseURL, change, opts)
		if err != nil {
			return info, fmt.Errorf("error calculating changes %w", err)
		}

		// If everything applied OK, then render screenshots
		if opts.render != nil && v.GrafanaURL != "" && v.Parsed != nil && v.Parsed.DryRunResponse != nil {
			opts.progress.SetMessage(ctx, fmt.Sprintf("rendering screenshots: %s", change.Path))
			if err = v.renderScreenshots(ctx, info.GrafanaBaseURL, opts.render); err != nil {
				info.MissingImageRenderer = true
				if v.Error == "" {
					v.Error = "Error running image rendering"
				}

				if v.GrafanaScreenshotURL != "" || v.PreviewScreenshotURL != "" {
					info.HasScreenshot = true
				}
			}
		}

		info.Changes = append(info.Changes, v)
	}
	return info, nil
}

var dashboardKind = dashboard.DashboardResourceInfo.GroupVersionKind().Kind

func calculateFileChangeInfo(ctx context.Context, baseURL string, change repository.VersionedFileChange, opts changeOptions) (fileChangeInfo, error) {
	if change.Action == repository.FileActionDeleted {
		return calculateFileDeleteInfo(ctx, baseURL, change, opts)
	}

	info := fileChangeInfo{Change: change}
	fileInfo, err := opts.reader.Read(ctx, change.Path, change.Ref)
	if err != nil {
		logger.Info("unable to read file", "err", err)
		info.Error = err.Error()
		return info, nil
	}

	// Read the file as a resource
	info.Parsed, err = opts.parser.Parse(ctx, fileInfo)
	if err != nil {
		info.Error = err.Error()
		return info, nil
	}

	// Find a name within the file
	obj := info.Parsed.Obj
	info.Title = info.Parsed.Meta.FindTitle(obj.GetName())

	// Check what happens when we apply changes
	// NOTE: this will also invoke any server side validation
	err = info.Parsed.DryRun(ctx)
	if err != nil {
		info.Error = err.Error()
		return info, nil
	}

	// Dashboards get special handling
	if info.Parsed.GVK.Kind == dashboardKind {
		if info.Parsed.Existing != nil {
			info.GrafanaURL = fmt.Sprintf("%sd/%s/%s", baseURL, obj.GetName(),
				slugify.Slugify(info.Title))
		}

		// Load this file directly
		info.PreviewURL = baseURL + path.Join("admin/provisioning",
			info.Parsed.Repo.Name, "dashboard/preview", info.Parsed.Info.Path)

		query := url.Values{}
		query.Set("ref", info.Parsed.Info.Ref)
		if opts.pullRequest.URL != "" {
			query.Set("pull_request_url", url.QueryEscape(opts.pullRequest.URL))
		}
		info.PreviewURL += "?" + query.Encode()
	}

	return info, nil
}

func calculateFileDeleteInfo(_ context.Context, _ string, change repository.VersionedFileChange, opts changeOptions) (fileChangeInfo, error) {
	// TODO -- read the old and verify
	return fileChangeInfo{Change: change, Error: "delete feedback not yet implemented"}, nil
}

// This will update render the linked screenshots and update the screenshotURLs
func (f *fileChangeInfo) renderScreenshots(ctx context.Context, baseURL string, renderer ScreenshotRenderer) (err error) {
	if f.GrafanaURL != "" {
		f.GrafanaScreenshotURL, err = renderScreenshotFromGrafanaURL(ctx, baseURL, renderer, f.Parsed.Repo, f.GrafanaURL)
		if err != nil {
			return err
		}
	}
	if f.PreviewURL != "" {
		f.PreviewScreenshotURL, err = renderScreenshotFromGrafanaURL(ctx, baseURL, renderer, f.Parsed.Repo, f.PreviewURL)
		if err != nil {
			return err
		}
	}
	return nil
}

func renderScreenshotFromGrafanaURL(ctx context.Context,
	baseURL string,
	renderer ScreenshotRenderer,
	repo provisioning.ResourceRepositoryInfo,
	grafanaURL string,
) (string, error) {
	parsed, err := url.Parse(grafanaURL)
	if err != nil {
		logging.FromContext(ctx).Warn("invalid", "url", grafanaURL, "err", err)
		return "", err
	}
	snap, err := renderer.RenderScreenshot(ctx, repo, strings.TrimPrefix(parsed.Path, "/"), parsed.Query())
	if err != nil {
		logging.FromContext(ctx).Warn("render failed", "url", grafanaURL, "err", err)
		return "", fmt.Errorf("error rendering screenshot %w", err)
	}
	if strings.Contains(snap, "://") {
		return snap, nil // it is a full URL already (can happen when the blob storage returns CDN urls)
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		logger.Warn("invalid base", "url", baseURL, "err", err)
		return "", err
	}
	return base.JoinPath(snap).String(), nil
}
