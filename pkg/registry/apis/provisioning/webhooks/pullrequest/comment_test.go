package pullrequest

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestCommenter_Comment_FailedToComment(t *testing.T) {
	repo := NewMockPullRequestRepo(t)
	repo.On("CommentPullRequest", context.Background(), 1, mock.Anything).Return(errors.New("failed"))

	commenter := NewCommenter(false)
	err := commenter.Comment(context.Background(), repo, 1, changeInfo{})
	require.Error(t, err)
}

func TestGenerateComment(t *testing.T) {
	for _, tc := range []struct {
		Name  string
		Input changeInfo
	}{
		{"no changes", changeInfo{
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
		}},
		{"new dashboard", changeInfo{
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
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
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
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
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
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
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
			SkippedFiles:    5,
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
		{"single dashboard with error", changeInfo{
			GrafanaBaseURL: "http://host/",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "broken.json",
						},
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
						Action: v0alpha1.ResourceActionCreate,
					},
					Title:      "Broken Dashboard",
					PreviewURL: "http://grafana/admin/preview",
					Error:      "strict decoding error: unknown field \"spec.invalidField\"",
				},
			},
		}},
		{"single dashboard with stripped metadata", changeInfo{
			GrafanaBaseURL: "http://host/",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "dashboard.json",
						},
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
						Action: v0alpha1.ResourceActionUpdate,
					},
					Title:              "My Dashboard",
					GrafanaURL:         "http://grafana/d/uid",
					PreviewURL:         "http://grafana/admin/preview",
					HasRemovedMetadata: true,
				},
			},
		}},
		{"multiple files with stripped metadata", changeInfo{
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "good.json",
						},
						Action: v0alpha1.ResourceActionCreate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:      "Dashboard A",
					PreviewURL: "http://grafana/admin/preview",
				},
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "stripped.json",
						},
						Action: v0alpha1.ResourceActionUpdate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:              "Dashboard B",
					GrafanaURL:         "http://grafana/d/bbb",
					PreviewURL:         "http://grafana/admin/preview",
					HasRemovedMetadata: true,
				},
			},
		}},
		{"multiple files with errors", changeInfo{
			GrafanaBaseURL: "http://host/",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "good.json",
						},
						Action: v0alpha1.ResourceActionCreate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:      "Good Dashboard",
					PreviewURL: "http://grafana/admin/preview",
				},
				{
					Change: repository.VersionedFileChange{
						Path: "bad.json",
					},
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "bad.json",
						},
						Action: v0alpha1.ResourceActionUpdate,
						GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
					},
					Title:      "Bad Dashboard",
					GrafanaURL: "http://grafana/d/bad",
					PreviewURL: "http://grafana/admin/preview",
					Error:      "admission webhook denied: panel type \"unknown-panel\" is not installed",
				},
				{
					Change: repository.VersionedFileChange{
						Path: "invalid.yaml",
					},
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "invalid.yaml",
						},
						Action: v0alpha1.ResourceActionCreate,
						GVK:    schema.GroupVersionKind{Kind: "Playlist"},
					},
					Title: "Broken Playlist",
					Error: "strict decoding error: unknown field \"spec.extra\"",
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

			commenter := NewCommenter(false)
			err = commenter.Comment(context.Background(), repo, 1, tc.Input)
			require.NoError(t, err)
		})
	}
}

func TestGenerateComment_NilParsedDeletedInTableTemplate(t *testing.T) {
	repo := NewMockPullRequestRepo(t)

	var capturedComment string
	repo.On("CommentPullRequest", context.Background(), 1, mock.MatchedBy(func(comment string) bool {
		capturedComment = comment
		return true
	})).Return(nil)

	info := changeInfo{
		GrafanaBaseURL: "http://host/",
		Changes: []fileChangeInfo{
			{
				Parsed: &resources.ParsedResource{
					Info: &repository.FileInfo{
						Path: "valid.json",
					},
					Action: v0alpha1.ResourceActionCreate,
					GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
				},
				Title:      "Valid Dashboard",
				PreviewURL: "http://grafana/admin/preview",
			},
			{
				Change: repository.VersionedFileChange{
					Action: repository.FileActionDeleted,
					Path:   "deleted-file.json",
				},
			},
		},
	}

	commenter := NewCommenter(false)
	err := commenter.Comment(context.Background(), repo, 1, info)
	require.NoError(t, err)
	require.Contains(t, capturedComment, "2 changes")
	require.Contains(t, capturedComment, "deleted")
	require.Contains(t, capturedComment, ".json")
}

func TestGenerateComment_SingleChangeNilParsed(t *testing.T) {
	repo := NewMockPullRequestRepo(t)

	var capturedComment string
	repo.On("CommentPullRequest", context.Background(), 1, mock.MatchedBy(func(comment string) bool {
		capturedComment = comment
		return true
	})).Return(nil)

	info := changeInfo{
		GrafanaBaseURL: "http://host/",
		Changes: []fileChangeInfo{
			{
				Change: repository.VersionedFileChange{
					Action: repository.FileActionCreated,
					Path:   "unparseable-file.json",
				},
				Error: "parse error",
			},
		},
	}

	commenter := NewCommenter(false)
	err := commenter.Comment(context.Background(), repo, 1, info)
	require.NoError(t, err)
	require.Contains(t, capturedComment, "1 changes")
	require.Contains(t, capturedComment, "created")
}

func TestGenerateComment_ParseFailureErrorSurfaced(t *testing.T) {
	repo := NewMockPullRequestRepo(t)

	var capturedComment string
	repo.On("CommentPullRequest", context.Background(), 1, mock.MatchedBy(func(comment string) bool {
		capturedComment = comment
		return true
	})).Return(nil)

	info := changeInfo{
		GrafanaBaseURL: "http://host/",
		Changes: []fileChangeInfo{
			{
				Parsed: &resources.ParsedResource{
					Info: &repository.FileInfo{
						Path: "valid.json",
					},
					Action: v0alpha1.ResourceActionCreate,
					GVK:    schema.GroupVersionKind{Kind: "Dashboard"},
				},
				Title:      "Valid Dashboard",
				PreviewURL: "http://grafana/admin/preview",
			},
			{
				Change: repository.VersionedFileChange{
					Action: repository.FileActionCreated,
					Path:   "broken.json",
				},
				Error: "unable to parse resource",
			},
		},
	}

	commenter := NewCommenter(false)
	err := commenter.Comment(context.Background(), repo, 1, info)
	require.NoError(t, err)
	require.Contains(t, capturedComment, "2 changes")
	require.Contains(t, capturedComment, "1 with issues")
	require.Contains(t, capturedComment, "Validation Issues")
	require.Contains(t, capturedComment, "broken.json")
	require.Contains(t, capturedComment, "unable to parse resource")
}

func TestCommenter_ShowImageRendererNote(t *testing.T) {
	t.Run("note appears when showImageRendererNote is true", func(t *testing.T) {
		repo := NewMockPullRequestRepo(t)
		info := changeInfo{
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
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
		}

		var capturedComment string
		repo.On("CommentPullRequest", context.Background(), 1, mock.MatchedBy(func(comment string) bool {
			capturedComment = comment
			return true
		})).Return(nil)

		commenter := NewCommenter(true)
		err := commenter.Comment(context.Background(), repo, 1, info)
		require.NoError(t, err)
		require.Contains(t, capturedComment, "NOTE: To enable dashboard previews")
		require.Contains(t, capturedComment, "https://grafana.com/docs/grafana/latest/observability-as-code/provision-resources/git-sync-setup/#configure-webhooks-and-image-rendering")
	})

	t.Run("note does not appear when showImageRendererNote is false", func(t *testing.T) {
		repo := NewMockPullRequestRepo(t)
		info := changeInfo{
			GrafanaBaseURL:  "http://host/",
			RepositoryName:  "my-repo",
			RepositoryTitle: "My Repo",
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
		}

		var capturedComment string
		repo.On("CommentPullRequest", context.Background(), 1, mock.MatchedBy(func(comment string) bool {
			capturedComment = comment
			return true
		})).Return(nil)

		commenter := NewCommenter(false)
		err := commenter.Comment(context.Background(), repo, 1, info)
		require.NoError(t, err)
		require.NotContains(t, capturedComment, "NOTE: To enable dashboard previews")
	})
}
