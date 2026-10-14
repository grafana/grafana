package search

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// GlobalHybridSearchFor preserves internal resources' HTTP opt-in and authorization.
// External groups use the storage service's existing allowlist and authorization.
func (h *HybridHandler) GlobalHybridSearchFor(targets map[schema.GroupResource]schema.GroupVersionKind, auth authorizer.Authorizer) http.HandlerFunc {
	kinds := make(map[schema.GroupResource]string, len(targets))
	for gr, gvk := range targets {
		kinds[gr] = gvk.Kind
	}
	gvr := GlobalSearchGVR()
	kind := kindRef{group: gvr.Group, version: gvr.Version, resource: gvr.Resource, kinds: kinds}
	return h.hybridSearchFor(kind, func(ctx context.Context, q *searchv0.HybridSearchQuery, namespace string) (*resourcepb.HybridSearchRequest, field.ErrorList, error) {
		req, errs := TranslateGlobalHybridSearchQuery(q, namespace)
		if len(errs) > 0 {
			return nil, errs, nil
		}
		for i, target := range q.Resources {
			if strings.HasSuffix(target.Group, ".ext.grafana.app") {
				continue
			}
			gr := schema.GroupResource{Group: target.Group, Resource: target.Resource}
			if _, ok := targets[gr]; !ok {
				errs = append(errs, field.Invalid(field.NewPath("resources").Index(i), target, "resource does not expose hybrid search"))
			}
		}
		if len(errs) > 0 {
			return nil, errs, nil
		}
		user, _ := request.UserFrom(ctx)
		for _, target := range q.Resources {
			// Externally pushed collections use this suffix and need no app API route.
			if strings.HasSuffix(target.Group, ".ext.grafana.app") {
				continue
			}
			gr := schema.GroupResource{Group: target.Group, Resource: target.Resource}
			gvk := targets[gr]
			// Match the attributes of the resource's own hybrid route after the
			// authorization chain translates POST into list.
			decision, _, err := auth.Authorize(ctx, authorizer.AttributesRecord{
				User: user, Verb: "list", Namespace: namespace,
				APIGroup: gr.Group, APIVersion: gvk.Version, Resource: gr.Resource,
				ResourceRequest: true,
				Path:            "/apis/" + gr.Group + "/" + gvk.Version + "/namespaces/" + namespace + "/" + gr.Resource + "/search/hybrid",
			})
			if err != nil {
				return nil, nil, apierrors.NewInternalError(err)
			}
			if decision != authorizer.DecisionAllow {
				return nil, nil, apierrors.NewForbidden(gr, "", fmt.Errorf("not authorized to search this resource"))
			}
		}
		return req, nil, nil
	})
}
