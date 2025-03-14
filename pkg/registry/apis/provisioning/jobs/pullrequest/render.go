package pullrequest

import (
	"context"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type screenshotRenderer struct {
	render      rendering.Service
	blobstore   resource.BlobStoreClient
	urlProvider func(namespace string) string
	isPublic    bool
}

func NewScreenshotRenderer(render rendering.Service, blobstore resource.BlobStoreClient, isPublic bool, urlProvider func(namespace string) string) *screenshotRenderer {
	return &screenshotRenderer{
		render:      render,
		blobstore:   blobstore,
		urlProvider: urlProvider,
		isPublic:    isPublic,
	}
}

func (r *screenshotRenderer) IsAvailable(ctx context.Context) bool {
	return r.render != nil && r.render.IsAvailable(ctx) && r.blobstore != nil && r.isPublic
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

	rsp, err := r.blobstore.PutBlob(ctx, &resource.PutBlobRequest{
		Resource: &resource.ResourceKey{
			Namespace: namespace,
			Group:     provisioning.GROUP,
			Resource:  provisioning.RepositoryResourceInfo.GroupResource().Resource,
			Name:      repoName,
		},
		Method:      resource.PutBlobRequest_GRPC,
		ContentType: mime.TypeByExtension(ext), // image/png
		Value:       body,
	})
	if err != nil {
		return "", err
	}
	if rsp.Url != "" {
		return rsp.Url, nil
	}
	base := r.urlProvider(namespace)
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return fmt.Sprintf("%sapis/%s/namespaces/%s/repositories/%s/render/%s",
		base, provisioning.APIVERSION, namespace, repoName, rsp.Uid), nil
}
