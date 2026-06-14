package builder

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	apifilters "github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
)

// reparentingConnecter wraps a rest.Connecter to re-parent the request context
// onto the upstream caller's trace before the underlying handler runs. This
// compensates for the k8s apiserver framework severing the trace SDK context
// during routing, while the original trace headers survive on the request.
//
// k8s asserts a number of optional interfaces on REST storages at install
// time (Scoper, StorageMetadata, SingularNameProvider, ...). Because Go can't
// "auto-forward" every interface the underlying might implement, we
// explicitly delegate the ones in use in this codebase. New interfaces would
// need to be added here. See wrapConnectersForTracing for the safety gate.
type reparentingConnecter struct {
	rest.Storage
	rest.Connecter
	underlying rest.Storage
}

func (c *reparentingConnecter) Connect(ctx context.Context, id string, opts runtime.Object, r rest.Responder) (http.Handler, error) {
	h, err := c.Connecter.Connect(ctx, id, opts, r)
	if err != nil {
		return nil, err
	}
	return apifilters.WithUpstreamSpanContext(h), nil
}

func (c *reparentingConnecter) NamespaceScoped() bool {
	if s, ok := c.underlying.(rest.Scoper); ok {
		return s.NamespaceScoped()
	}
	return false
}

func (c *reparentingConnecter) GetSingularName() string {
	if s, ok := c.underlying.(rest.SingularNameProvider); ok {
		return s.GetSingularName()
	}
	return ""
}

func (c *reparentingConnecter) ProducesMIMETypes(verb string) []string {
	if s, ok := c.underlying.(rest.StorageMetadata); ok {
		return s.ProducesMIMETypes(verb)
	}
	return nil
}

func (c *reparentingConnecter) ProducesObject(verb string) any {
	if s, ok := c.underlying.(rest.StorageMetadata); ok {
		return s.ProducesObject(verb)
	}
	return nil
}

// wrapConnectersForTracing walks an APIGroupInfo's storage map and wraps every
// rest.Connecter with reparentingConnecter so its returned http.Handler runs
// through the upstream trace context re-parenting middleware.
//
// Skips storages that also implement CRUD interfaces (Getter, Lister, Creater) —
// the wrapper does not forward those, so silently dropping them would break the
// resource.
func wrapConnectersForTracing(resources map[string]rest.Storage) {
	for name, s := range resources {
		c, ok := s.(rest.Connecter)
		if !ok {
			continue
		}
		if _, ok := s.(rest.Getter); ok {
			continue
		}
		if _, ok := s.(rest.Lister); ok {
			continue
		}
		if _, ok := s.(rest.Creater); ok {
			continue
		}
		resources[name] = &reparentingConnecter{Storage: s, Connecter: c, underlying: s}
	}
}
