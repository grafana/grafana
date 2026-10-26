package router

import (
	"context"
	"net/http"
	"slices"
	"strings"

	lru "github.com/hashicorp/golang-lru/v2"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// GroupAccessFilter is an optional RoutesLoader interface for a loader that
// knows which plugins a requester may use. Discovery leaves out the groups of
// the others; their requests are still refused by the plugin's own backend.
type GroupAccessFilter interface {
	// HiddenGroups returns the groups in plugins (group to plugin ID) that
	// requester may not use.
	HiddenGroups(ctx context.Context, requester identity.Requester, plugins map[string]string) (map[string]bool, error)
}

// restrictedDocsCacheSize bounds the documents built for requesters who may
// not use every group. Permissions come from a few roles, so few hidden sets
// recur.
const restrictedDocsCacheSize = 256

// groupFilter is what one requester may see of the groups: a service sees
// every group, anyone else neither the service-only groups nor the hidden ones.
type groupFilter struct {
	service     bool
	serviceOnly map[string]bool
	hidden      map[string]bool
}

func (f groupFilter) allows(group string) bool {
	return f.service || (!f.serviceOnly[group] && !f.hidden[group])
}

// restricted reports whether the requester may not see some group the user
// documents list, so needs documents of its own.
func (f groupFilter) restricted() bool {
	return !f.service && len(f.hidden) > 0
}

// groupFilter builds req's filter, asking the loader's GroupAccessFilter,
// when it has one, about the served plugin groups. If it fails, every plugin
// group is hidden, and only those.
func (r *GrafanaRouter) groupFilter(req *http.Request) groupFilter {
	ctx := req.Context()
	f := groupFilter{service: isService(ctx), serviceOnly: r.serviceOnly}
	if f.service || r.groupAccess == nil {
		return f
	}
	requester, err := identity.GetRequester(ctx)
	if err != nil || requester == nil {
		return f // authenticate refused the request already
	}
	plugins := map[string]string{}
	for group, entry := range *r.snapshot.Load() {
		if entry.plugin != nil && entry.plugin.ID != "" {
			plugins[group] = entry.plugin.ID
		}
	}
	if len(plugins) == 0 {
		return f
	}
	if f.hidden, err = r.groupAccess.HiddenGroups(ctx, requester, plugins); err != nil {
		logging.FromContext(ctx).Warn("router: checking plugin access for discovery failed, hiding plugin groups", "err", err)
		f.hidden = make(map[string]bool, len(plugins))
		for group := range plugins {
			f.hidden[group] = true
		}
	}
	return f
}

// restrictedDocs are the user documents without one requester's hidden
// groups. backends and userDocs are what publish stored when they were built.
type restrictedDocs struct {
	backends *[]Backend
	userDocs *manifestDocs

	apiGroupList cachedDoc
	openapiIndex cachedDoc
	manifests    *manifestDocs
}

func newRestrictedDocsCache() *lru.Cache[string, *restrictedDocs] {
	cache, err := lru.New[string, *restrictedDocs](restrictedDocsCacheSize)
	if err != nil {
		panic(err) // only for a size that is not positive
	}
	return cache
}

// restrictedDocsFor returns the documents for a restricted filter, cached by
// its hidden groups. An entry built from documents publish has since
// replaced is built again.
func (r *GrafanaRouter) restrictedDocsFor(ctx context.Context, f groupFilter) *restrictedDocs {
	backends, manifests := r.userBackends.Load(), r.userManifestDocs.Load()
	hidden := make([]string, 0, len(f.hidden))
	for group := range f.hidden {
		hidden = append(hidden, group)
	}
	slices.Sort(hidden)
	key := strings.Join(hidden, "\x00")
	if docs, ok := r.restrictedDocs.Get(key); ok && docs.backends == backends && docs.userDocs == manifests {
		return docs
	}

	visible := make([]Backend, 0, len(*backends))
	for _, b := range *backends {
		if f.allows(b.Group().Name) {
			visible = append(visible, b)
		}
	}
	docs := &restrictedDocs{
		backends:     backends,
		userDocs:     manifests,
		apiGroupList: buildAPIGroupList(ctx, visible),
		openapiIndex: buildOpenAPIV3Index(ctx, visible),
		manifests:    manifests.filtered(f.allows),
	}
	r.restrictedDocs.Add(key, docs)
	return docs
}
