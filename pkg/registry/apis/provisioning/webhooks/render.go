package webhooks

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// RenderExtraBuilder provides additional functionality for rendering images
type RenderExtraBuilder struct {
	// HACK: We need to wrap the builder to please wire so that it can uniquely identify the dependency
	provisioningapis.ExtraBuilder
}

func ProvidePreviewScreenshots(unified resource.ResourceClient) RenderExtraBuilder {
	return RenderExtraBuilder{
		ExtraBuilder: func(b *provisioningapis.APIBuilder) provisioningapis.Extra {
			return &renderConnector{
				unified: unified,
			}
		},
	}
}

type renderConnector struct {
	unified resource.ResourceClient
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

func (c *renderConnector) Authorize(_ context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	if a.GetResource() == provisioning.RepositoryResourceInfo.GetName() && a.GetSubresource() == "render" {
		return authorizer.DecisionAllow, "", nil
	}

	return authorizer.DecisionNoOpinion, "", nil
}

func (c *renderConnector) Mutate(ctx context.Context, r *provisioning.Repository) error {
	return nil
}

func (c *renderConnector) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	repoprefix := provisioning.RepositoryResourceInfo.GetName() + "/"
	sub := oas.Paths.Paths[repoprefix+"/render/{path}"]
	if sub != nil {
		sub.Get.Description = "get a rendered preview image"
		sub.Get.Responses = &spec3.Responses{
			ResponsesProps: spec3.ResponsesProps{
				StatusCodeResponses: map[int]*spec3.Response{
					200: {
						ResponseProps: spec3.ResponseProps{
							Content: map[string]*spec3.MediaType{
								"image/png": {},
							},
							Description: "OK",
						},
					},
				},
			},
		}

		// Replace {path} with {guid} (it is a GUID, but all k8s sub-resources are called path)
		for _, v := range sub.Parameters {
			if v.Name == "path" {
				v.Name = "guid"
				v.Description = "Image GUID"
				break
			}
		}

		delete(oas.Paths.Paths, repoprefix+"/render/{path}")
		oas.Paths.Paths[repoprefix+"/render/{guid}"] = sub
	}

	return nil
}

func (c *renderConnector) UpdateStorage(storage map[string]rest.Storage) error {
	storage[provisioning.RepositoryResourceInfo.StoragePath("render")] = c
	return nil
}

func (c *renderConnector) GetJobWorkers() []jobs.Worker {
	return []jobs.Worker{}
}

func (c *renderConnector) AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	return nil, nil
}

func (c *renderConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	return provisioningapis.WithTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

		rsp, err := c.unified.GetBlob(ctx, &resource.GetBlobRequest{
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
