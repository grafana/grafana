package search

import (
	"context"
	"fmt"
	"maps"
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
// kinds names the results. targets only names types kinds lacks, because it
// holds the versions this process serves, and the name must not depend on that.
func (h *HybridHandler) GlobalHybridSearchFor(targets map[schema.GroupResource]schema.GroupVersionKind, kinds map[schema.GroupResource]string, auth authorizer.Authorizer, defaultResources []searchv0.HybridSearchResource) http.HandlerFunc {
	names := make(map[schema.GroupResource]string, len(kinds)+len(targets))
	for gr, gvk := range targets {
		names[gr] = gvk.Kind
	}
	maps.Copy(names, kinds)
	gvr := GlobalSearchGVR()
	kind := kindRef{group: gvr.Group, version: gvr.Version, resource: gvr.Resource, kinds: names}
	return h.hybridSearchFor(kind, func(ctx context.Context, q *searchv0.HybridSearchQuery, namespace string) (*resourcepb.HybridSearchRequest, error) {
		if len(q.Resources) == 0 {
			q.Resources = defaultResources
		}
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
