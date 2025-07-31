package pullrequest

import (
	"context"
	"fmt"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"google.golang.org/grpc"
)

//go:generate mockery --name BlobStoreClient --structname MockBlobStoreClient --inpackage --filename blobstore_client_mock.go --with-expecter
type BlobStoreClient interface {
	PutBlob(ctx context.Context, in *resourcepb.PutBlobRequest, opts ...grpc.CallOption) (*resourcepb.PutBlobResponse, error)
}

// ScreenshotRenderer is an interface for rendering a preview of a file
//
//go:generate mockery --name ScreenshotRenderer --structname MockScreenshotRenderer --inpackage --filename render_mock.go --with-expecter
type ScreenshotRenderer interface {
	IsAvailable(ctx context.Context) bool
	RenderScreenshot(ctx context.Context, repo provisioning.ResourceRepositoryInfo, path string, values url.Values) (string, error)
}

type screenshotRenderer struct {
	render    rendering.Service
	blobstore BlobStoreClient
}

func NewScreenshotRenderer(render rendering.Service, blobstore BlobStoreClient) ScreenshotRenderer {
	return &screenshotRenderer{
		render:    render,
		blobstore: blobstore,
	}
}

func (r *screenshotRenderer) IsAvailable(ctx context.Context) bool {
	return r.render != nil && r.render.IsAvailable(ctx) && r.blobstore != nil
}

func (r *screenshotRenderer) RenderScreenshot(ctx context.Context, repo provisioning.ResourceRepositoryInfo, path string, values url.Values) (string, error) {
	if strings.Contains(path, "://") {
		return "", fmt.Errorf("path should be relative to the system root url")
	}
	if strings.HasPrefix(path, "/") {
		return "", fmt.Errorf("path should not start with slash")
	}
	if len(values) > 0 {
		path = path + "?" + values.Encode() + "&kiosk"
	} else {
		path = path + "?kiosk"
	}
	result, err := r.render.Render(ctx, rendering.RenderPNG, rendering.Opts{
		CommonOpts: rendering.CommonOpts{
			Path: path,
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

	rsp, err := r.blobstore.PutBlob(ctx, &resourcepb.PutBlobRequest{
		Resource: &resourcepb.ResourceKey{
			Namespace: repo.Namespace,
			Group:     provisioning.GROUP,
			Resource:  provisioning.RepositoryResourceInfo.GroupResource().Resource,
			Name:      repo.Name,
		},
		Method:      resourcepb.PutBlobRequest_GRPC,
		ContentType: mime.TypeByExtension(ext), // image/png
		Value:       body,
	})
	if err != nil {
		return "", err
	}
	if rsp.Url != "" {
		return rsp.Url, nil
	}
	return fmt.Sprintf("apis/%s/namespaces/%s/repositories/%s/render/%s",
		provisioning.APIVERSION, repo.Namespace, repo.Name, rsp.Uid), nil
}
