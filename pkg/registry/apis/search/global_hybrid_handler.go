package search

import (
	"context"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// GlobalHybridSearchFor retains known API authorization policies while the
// backend checks manifest opt-in, collection enrollment, and result access.
func (h *HybridHandler) GlobalHybridSearchFor(targets map[schema.GroupResource]schema.GroupVersionKind, auth authorizer.Authorizer) http.HandlerFunc {
	kinds := make(map[schema.GroupResource]string, len(targets))
	for gr, gvk := range targets {
		kinds[gr] = gvk.Kind
	}
	gvr := GlobalSearchGVR()
	kind := kindRef{group: gvr.Group, version: gvr.Version, resource: gvr.Resource, kinds: kinds}
	return h.hybridSearchFor(kind, func(ctx context.Context, q *searchv0.HybridSearchQuery, namespace string) (*resourcepb.HybridSearchRequest, error) {
		req, errs := TranslateGlobalHybridSearchQuery(q, namespace)
		if len(errs) > 0 {
			return nil, apierrors.NewInvalid(schema.GroupKind{Group: searchv0.GROUP, Kind: searchv0.KindHybridSearchQuery}, "", errs)
		}
		user, _ := request.UserFrom(ctx)
		for _, target := range q.Resources {
			gr := schema.GroupResource{Group: target.Group, Resource: target.Resource}
			gvk, known := targets[gr]
			if !known {
				// Remote apps and pushed collections are validated by the backend.
				continue
			}
			// Match the attributes of the resource's own hybrid route after the
			// authorization chain translates POST into list.
			decision, _, err := auth.Authorize(ctx, authorizer.AttributesRecord{
				User: user, Verb: "list", Namespace: namespace,
				APIGroup: gr.Group, APIVersion: gvk.Version, Resource: gr.Resource,
				ResourceRequest: true,
				Path:            "/apis/" + gr.Group + "/" + gvk.Version + "/namespaces/" + namespace + "/" + gr.Resource + "/search/hybrid",
			})
			if err != nil {
				return nil, apierrors.NewInternalError(err)
			}
			if decision != authorizer.DecisionAllow {
				return nil, apierrors.NewForbidden(gr, "", fmt.Errorf("not authorized to search this resource"))
			}
		}
		return req, nil
	})
}
