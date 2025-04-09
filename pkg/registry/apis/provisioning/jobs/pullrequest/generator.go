package pullrequest

import (
	"context"
	"html/template"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ChangeOptions struct {
	PullRequest     provisioning.PullRequestJobOptions
	Changes         []repository.VersionedFileChange
	Parser          resources.Parser
	Reader          repository.Reader
	Progress        jobs.JobProgressRecorder
	GeneratePreview bool
}

// CommentGenerator is a service for previewing dashboard changes in a pull request
//
//go:generate mockery --name CommentGenerator --structname MockCommentGenerator --inpackage --filename generator_mock.go --with-expecter
type CommentGenerator interface {
	PrepareChanges(ctx context.Context, opts ChangeOptions) (changeInfo, error)
	GenerateComment(ctx context.Context, info changeInfo) (string, error)
}

type generator struct {
	template    *template.Template
	urlProvider func(namespace string) string
	renderer    ScreenshotRenderer
}

var (
	_ CommentGenerator = (*generator)(nil)
)

func NewCommentGenerator(renderer ScreenshotRenderer, urlProvider func(namespace string) string) *generator {
	return &generator{
		template:    template.Must(template.New("comment").Parse(previewsCommentTemplate)),
		urlProvider: urlProvider,
		renderer:    renderer,
	}
}

// // GenerateComment creates a formatted comment for dashboard previews
// func (c *commenter) xenerateComment(preview resourcePreview) (string, error) {
// 	var buf bytes.Buffer
// 	if err := x.template.Execute(&buf, preview); err != nil {
// 		return "", fmt.Errorf("execute previews comment template: %w", err)
// 	}
// 	return buf.String(), nil
// }
