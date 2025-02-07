package pullrequest

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/blob"
)

type Renderer struct {
	cfg       *provisioning.Repository
	render    rendering.Service
	blobstore blob.PublicBlobStore
	id        identity.Requester
}

func NewRenderer(cfg *provisioning.Repository, render rendering.Service, blobstore blob.PublicBlobStore, id identity.Requester) *Renderer {
	return &Renderer{
		cfg:       cfg,
		render:    render,
		blobstore: blobstore,
		id:        id,
	}
}

func (r *Renderer) IsAvailable(ctx context.Context) bool {
	return r.render != nil && r.render.IsAvailable(ctx) && r.blobstore.IsAvailable()
}

func (r *Renderer) RenderDashboardPreview(ctx context.Context, path string, ref string) (string, error) {
	url := fmt.Sprintf("admin/provisioning/%s/dashboard/preview/%s?kiosk&ref=%s", r.cfg.Name, path, ref)
	// fmt.Printf("RENDER: http://localhost:3000/render/%s\n", url)

	renderContext := identity.WithRequester(context.Background(), r.id)
	result, err := r.render.Render(renderContext, rendering.RenderPNG, rendering.Opts{
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

	return r.blobstore.SaveBlob(ctx, r.cfg.Namespace, ext, body, map[string]string{
		"repo": r.cfg.Name,
		"path": path, // only used when saving in GCS/S3++
		"ref":  ref,
	})
}
