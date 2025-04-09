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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

var dashboardKind = dashboard.DashboardResourceInfo.GroupVersionKind().Kind

type changeInfo struct {
	GrafanaBaseURL string

	Errors   []string
	Warnings []string

	// Files we tried to read
	Changes []fileChangeInfo

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

func (g *generator) PrepareChanges(ctx context.Context, opts ChangeOptions) (changeInfo, error) {
	info := changeInfo{
		GrafanaBaseURL: g.urlProvider(opts.Reader.Config().Namespace),
	}

	if opts.GeneratePreview {
		if g.renderer == nil || !g.renderer.IsAvailable(ctx) {
			info.MissingImageRenderer = true
			opts.GeneratePreview = false
		}

		// Only render images when there is just one change
		if len(opts.Changes) > 1 {
			opts.GeneratePreview = false
		}
	}

	logger := logging.FromContext(ctx)
	for _, change := range opts.Changes {
		opts.Progress.SetMessage(ctx, fmt.Sprintf("processing: %s", change.Path))
		logger.With("action", change.Action).With("path", change.Path)

		v, err := g.calculateChangeInfo(ctx, logger, info.GrafanaBaseURL, change, opts)
		if err != nil {
			return info, fmt.Errorf("error calculating changes")
		}

		// If everything applied OK, then render screenshots
		if opts.GeneratePreview && v.GrafanaURL != "" && v.Parsed != nil && v.Parsed.DryRunResponse != nil {
			opts.Progress.SetMessage(ctx, fmt.Sprintf("rendering screenshots: %s", change.Path))
			if err = g.renderScreenshots(ctx, logger, info.GrafanaBaseURL, &v); err != nil {
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

func (g *generator) calculateChangeInfo(ctx context.Context, logger logging.Logger, baseURL string, change repository.VersionedFileChange, opts ChangeOptions) (fileChangeInfo, error) {
	if change.Action == repository.FileActionDeleted {
		return g.calculateDeleteInfo(ctx, baseURL, change, opts)
	}

	info := fileChangeInfo{Change: change}
	fileInfo, err := opts.Reader.Read(ctx, change.Path, change.Ref)
	if err != nil {
		logger.Info("unable to read file", "err", err)
		info.Error = err.Error()
		return info, nil
	}

	// Read the file as a resource
	info.Parsed, err = opts.Parser.Parse(ctx, fileInfo)
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
		info.GrafanaURL = fmt.Sprintf("%sd/%s/%s", baseURL, obj.GetName(), info.Title)
		info.PreviewURL = baseURL + path.Join("admin/provisioning",
			info.Parsed.Repo.Name, "dashboard/preview", info.Parsed.Info.Path)

		query := url.Values{}
		query.Set("ref", info.Parsed.Info.Ref)
		if opts.PullRequest.URL != "" {
			query.Set("pull_request_url", url.QueryEscape(opts.PullRequest.URL))
		}
		info.PreviewURL += "?" + query.Encode()
	}

	return info, nil
}

func (g *generator) calculateDeleteInfo(ctx context.Context, baseURL string, change repository.VersionedFileChange, opts ChangeOptions) (fileChangeInfo, error) {
	// TODO -- read the old?
	return fileChangeInfo{Change: change}, nil
}

func (g *generator) renderScreenshots(ctx context.Context, logger logging.Logger, baseURL string, change *fileChangeInfo) (err error) {
	if change.GrafanaURL != "" {
		change.GrafanaScreenshotURL, err = g.renderScreenshot(ctx, logger, baseURL, change.Parsed.Repo, change.GrafanaURL)
		if err != nil {
			return err
		}
	}
	if change.PreviewURL != "" {
		change.PreviewScreenshotURL, err = g.renderScreenshot(ctx, logger, baseURL, change.Parsed.Repo, change.PreviewURL)
		if err != nil {
			return err
		}
	}
	return nil
}

func (g *generator) renderScreenshot(ctx context.Context,
	logger logging.Logger,
	baseURL string,
	repo provisioning.ResourceRepositoryInfo,
	request string,
) (string, error) {
	parsed, err := url.Parse(request)
	if err != nil {
		logger.Warn("invalid", "url", request, "err", err)
		return "", err
	}
	snap, err := g.renderer.RenderScreenshot(ctx, repo, strings.TrimPrefix(parsed.Path, "/"), parsed.Query())
	if err != nil {
		logger.Warn("render failed", "url", request, "err", err)
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

// Remove files we should not try to process
func onlySupportedFiles(files []repository.VersionedFileChange) (ret []repository.VersionedFileChange) {
	for _, file := range files {
		if file.Action == repository.FileActionIgnored {
			continue
		}

		if err := resources.IsPathSupported(file.Path); err == nil {
			ret = append(ret, file)
			continue
		}
		if file.PreviousPath != "" {
			if err := resources.IsPathSupported(file.PreviousPath); err != nil {
				ret = append(ret, file)
				continue
			}
		}
	}
	return
}
