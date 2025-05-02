package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type renderConnector struct {
	blob resource.BlobStoreClient
}

func (*renderConnector) New() runtime.Object {
	return &provisioning.Repository{}
}

func (*renderConnector) Destroy() {}

func (*renderConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *renderConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*renderConnector) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*renderConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (c *renderConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefix := fmt.Sprintf("/%s/render", name)
		idx := strings.Index(r.URL.Path, prefix)
		if idx == -1 {
			logger.Debug("failed to find a file path in the URL")
			responder.Error(apierrors.NewBadRequest("invalid request path"))
			return
		}
		blobID := strings.TrimPrefix(r.URL.Path[idx+len(prefix):], "/")
		if len(blobID) == 0 {
			responder.Error(apierrors.NewNotFound(provisioning.RepositoryResourceInfo.GroupResource(), "render"))
			return
		}
		if !validBlobID(blobID) {
			responder.Error(apierrors.NewBadRequest(fmt.Sprintf("invalid blob id: %s", blobID)))
			return
		}

		rsp, err := c.blob.GetBlob(ctx, &resource.GetBlobRequest{
			Resource: &resource.ResourceKey{
				Namespace: namespace,
				Group:     provisioning.GROUP,
				Resource:  provisioning.RepositoryResourceInfo.GroupResource().Resource,
				Name:      name,
			},
			MustProxyBytes: true,
			Uid:            blobID,
		})
		if err != nil {
			responder.Error(err)
			return
		}
		if rsp.Error != nil {
			responder.Error(resource.GetError(rsp.Error))
			return
		}

		if len(rsp.Value) > 0 {
			if rsp.ContentType != "" {
				w.Header().Add("Content-Type", rsp.ContentType)
			}
			_, err = w.Write(rsp.Value)
			if err != nil {
				responder.Error(err)
				return
			}
		} else {
			responder.Error(&apierrors.StatusError{
				ErrStatus: v1.Status{
					Code:    http.StatusNoContent,
					Message: "empty body",
				},
			})
		}
	}), 20*time.Second), nil
}

// validBlobID ensures the ID is valid for a blob.
// The ID is always a UUID. As such, this checks for something that can resemble a UUID.
// This does not check for the ID to be an actual UUID, as the blob store may change their ID format, which we do not wish to stand in the way of.
func validBlobID(id string) bool {
	for _, c := range id {
		// [a-zA-Z0-9\-] are valid characters.
		az := c >= 'a' && c <= 'z'
		AZ := c >= 'A' && c <= 'Z'
		digit := c >= '0' && c <= '9'
		if !az && !AZ && !digit && c != '-' {
			return false
		}
	}
	return true
}

var (
	_ rest.Connecter       = (*renderConnector)(nil)
	_ rest.Storage         = (*renderConnector)(nil)
	_ rest.StorageMetadata = (*renderConnector)(nil)
)
