package pullrequest

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestGenerateComment(t *testing.T) {
	generator := NewCommentGenerator(nil, nil)

	for _, tc := range []struct {
		Name  string
		Input changeInfo
	}{
		{"single dashboard missing renderer", changeInfo{
			GrafanaBaseURL: "http://host/",
			Changes: []fileChangeInfo{
				{
					Parsed: &resources.ParsedResource{
						Info: &repository.FileInfo{
							Path: "file.json",
						},
						Action: v0alpha1.ResourceActionCreate,
					},
					Title:      "Title",
					GrafanaURL: "http://grafana/d/uid",
					PreviewURL: "http://grafana/admin/preview",
				},
			},
			MissingImageRenderer: true,
		}},
	} {
		t.Run(tc.Name, func(t *testing.T) {
			comment, err := generator.GenerateComment(context.Background(), tc.Input)
			require.NoError(t, err)

			fpath := filepath.Join("testdata", strings.ReplaceAll(tc.Name, " ", "-")+".md")
			update := false

			// We can ignore the gosec G304 because this is only for tests
			// nolint:gosec
			expect, err := os.ReadFile(fpath)
			if err != nil || len(expect) < 1 {
				update = true
				t.Error("missing " + fpath)
			} else {
				if diff := cmp.Diff(string(expect), comment); diff != "" {
					t.Errorf("%s: %s", fpath, diff)
					update = true
				}
			}
			if update {
				_ = os.WriteFile(fpath, []byte(comment), 0777)
			}
		})
	}
}
