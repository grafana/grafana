package pullrequest

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestGenerateComment(t *testing.T) {
	for _, tc := range []struct {
		Name  string
		Input changeInfo
	}{
		{"new dashboard", changeInfo{
			GrafanaBaseURL: "http://host/",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "file.json",
						},
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
						Action: v0alpha1.ResourceActionCreate,
					},
					Title:                "New Dashboard",
					PreviewURL:           "http://grafana/admin/preview",
					PreviewScreenshotURL: getDummyRenderedURL("http://grafana/admin/preview"),
				},
			},
		}},
		{"update dashboard", changeInfo{
			GrafanaBaseURL: "http://host/",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "file.json",
						},
						Action: v0alpha1.ResourceActionUpdate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:      "Existing Dashboard",
					GrafanaURL: "http://grafana/d/uid",
					PreviewURL: "http://grafana/admin/preview",

					GrafanaScreenshotURL: getDummyRenderedURL("http://grafana/d/uid"),
					PreviewScreenshotURL: getDummyRenderedURL("http://grafana/admin/preview"),
				},
			},
		}},
		{"update dashboard missing renderer", changeInfo{
			GrafanaBaseURL: "http://host/",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "file.json",
						},
						Action: v0alpha1.ResourceActionUpdate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:      "Existing Dashboard",
					GrafanaURL: "http://grafana/d/uid",
					PreviewURL: "http://grafana/admin/preview",
				},
			},
			MissingImageRenderer: true,
		}},
		{"multiple files", changeInfo{
			GrafanaBaseURL: "http://host/",
			SkippedFiles:   5,
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "aaa.json",
						},
						Action: v0alpha1.ResourceActionCreate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:      "Dash A",
					PreviewURL: "http://grafana/admin/preview",
				},
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "bbb.json",
						},
						Action: v0alpha1.ResourceActionUpdate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:      "Dash B",
					GrafanaURL: "http://grafana/d/bbb",
					PreviewURL: "http://grafana/admin/preview",
				},
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "bbb.json",
						},
						Action: v0alpha1.ResourceActionCreate,
						GVK:    schema.GroupVersionKind{Kind: "Playlist"},
					},
					Title: "My Playlist",
				},
			},
		}},
	} {
		t.Run(tc.Name, func(t *testing.T) {
			repo := NewMockPullRequestRepo(t)

			// expectation on the comment
			fpath := filepath.Join("testdata", strings.ReplaceAll(tc.Name, " ", "-")+".md")
			// We can ignore the gosec G304 because this is only for tests
			// nolint:gosec
			expect, err := os.ReadFile(fpath)
			require.NoError(t, err)
			repo.On("CommentPullRequest", context.Background(), 1, string(expect)).Return(nil)

			commenter := NewCommenter()
			err = commenter.Comment(context.Background(), repo, 1, tc.Input)
			require.NoError(t, err)
		})
	}
}
