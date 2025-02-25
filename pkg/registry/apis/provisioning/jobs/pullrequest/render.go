package pullrequest

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/blob"
)

type screenshotRenderer struct {
	render    rendering.Service
	blobstore blob.PublicBlobStore
	isPublic  bool
}

func NewScreenshotRenderer(render rendering.Service, blobstore blob.PublicBlobStore, isPublic bool) *screenshotRenderer {
	return &screenshotRenderer{
		render:    render,
		blobstore: blobstore,
		isPublic:  isPublic,
	}
}

func (r *screenshotRenderer) IsAvailable(ctx context.Context) bool {
	return r.render != nil && r.render.IsAvailable(ctx) && r.blobstore.IsAvailable() && r.isPublic
}

func (r *screenshotRenderer) RenderDashboardPreview(ctx context.Context, namespace, repoName, path, ref string) (string, error) {
	url := fmt.Sprintf("admin/provisioning/%s/dashboard/preview/%s?kiosk&ref=%s", repoName, path, ref)

	// TODO: why were we using a different context?
	// renderContext := identity.WithRequester(context.Background(), r.id)
	result, err := r.render.Render(ctx, rendering.RenderPNG, rendering.Opts{
		CommonOpts: rendering.CommonOpts{
			Path: url,
			AuthOpts: rendering.AuthOpts{
				OrgID:   1, // TODO!!!, use the worker identity
				UserID:  1,
				OrgRole: identity.RoleAdmin,
			},
			TimeoutOpts: rendering.TimeoutOpts{
				Timeout: time.Second * 30,
			},
		},
		Theme:  models.ThemeDark, // from config?
		Width:  1024,
		Height: -1, // full page height
	}, nil)
	if err != nil {
		return "", err
	}

	ext := filepath.Ext(result.FilePath)
	body, err := os.ReadFile(result.FilePath)
	if err != nil {
		return "", err
	}

	return r.blobstore.SaveBlob(ctx, namespace, ext, body, map[string]string{
		"repo": repoName,
		"path": path, // only used when saving in GCS/S3++
		"ref":  ref,
	})
}
