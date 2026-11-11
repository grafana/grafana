package resources

import (
	"cmp"
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ResourceListerFromAPIs answers what a repository manages by reading only the versioned /apis
// surface: each configured kind is listed through the group that serves it and classified from
// the manager annotations, the same properties the managed-object index reports. It needs no
// search index, so a kind participates wherever it is stored as long as that storage round-trips
// metadata.annotations.
//
// The cost is one paginated LIST per kind with client-side filtering: annotations are neither
// label- nor field-selectable, so there is no server-side way to ask for just the managed objects.
type ResourceListerFromAPIs struct {
	clients ClientFactory
	// configured is the whole configured set, disabled entries included: a disabled kind is still
	// managed by a repository and cleanup has to find it.
	configured []SupportedResource
}

// NewAPIResourceLister returns a lister that reads only the versioned /apis surface.
func NewAPIResourceLister(clients ClientFactory, configured []SupportedResource) ResourceLister {
	return &ResourceListerFromAPIs{clients: clients, configured: configured}
}

// List implements ResourceLister.
func (o *ResourceListerFromAPIs) List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error) {
	var items []provisioning.ResourceListItem
	err := o.scan(ctx, namespace, func(obj *unstructured.Unstructured, _ SupportedResource, gvr schema.GroupVersionResource) {
		if item, ok := managedResourceItem(obj, gvr, repository); ok {
			items = append(items, item)
		}
	})
	if err != nil {
		return nil, err
	}
	// The index answers sorted by path; keep that so both listers are interchangeable.
	slices.SortFunc(items, func(a, b provisioning.ResourceListItem) int { return cmp.Compare(a.Path, b.Path) })
	return &provisioning.ResourceList{Items: items}, nil
}

// Stats implements ResourceLister. Managed counts come from the manager annotations and instance
// counts from the same scan, so unmanaged is a difference taken over one consistent read rather
// than across two endpoints.
func (o *ResourceListerFromAPIs) Stats(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error) {
	type managerKey struct {
		kind     utils.ManagerKind
		identity string
	}
	instance := map[schema.GroupResource]int64{}
	managed := map[managerKey]map[schema.GroupResource]int64{}

	err := o.scan(ctx, namespace, func(obj *unstructured.Unstructured, kind SupportedResource, gvr schema.GroupVersionResource) {
		gr := countedResource(kind, gvr)
		instance[gr]++
		m, err := utils.MetaAccessor(obj)
		if err != nil {
			return
		}
		manager, ok := m.GetManagerProperties()
		if !ok {
			return
		}
		key := managerKey{kind: manager.Kind, identity: manager.Identity}
		if managed[key] == nil {
			managed[key] = map[schema.GroupResource]int64{}
		}
		managed[key][gr]++
	})
	if err != nil {
		return nil, err
	}

	stats := &provisioning.ResourceStats{
		TypeMeta: metav1.TypeMeta{
			APIVersion: provisioning.SchemeGroupVersion.String(),
			Kind:       "ResourceStats",
		},
	}
	for key, counts := range managed {
		if repository != "" && (key.kind != utils.ManagerKindRepo || key.identity != repository) {
			continue
		}
		stats.Managed = append(stats.Managed, provisioning.ManagerStats{
			Kind:     key.kind,
			Identity: key.identity,
			Stats:    resourceCounts(counts),
		})
	}
	slices.SortFunc(stats.Managed, func(a, b provisioning.ManagerStats) int {
		return cmp.Or(cmp.Compare(a.Kind, b.Kind), cmp.Compare(a.Identity, b.Identity))
	})

	// When selecting an explicit repository, do not report instance-wide counts.
	if repository != "" {
		return stats, nil
	}

	unmanaged := map[schema.GroupResource]int64{}
	for gr, total := range instance {
		count := total
		for _, counts := range managed {
			count -= counts[gr]
		}
		if count > 0 {
			unmanaged[gr] = count
		}
	}
	stats.Instance = resourceCounts(instance)
	stats.Unmanaged = resourceCounts(unmanaged)
	return stats, nil
}

// countedResource is the group and resource a kind is counted under: a collection's members are
// aggregated to the collection, the way the managed-object index reports them, while the list
// keeps the served group so each object stays addressable.
func countedResource(kind SupportedResource, gvr schema.GroupVersionResource) schema.GroupResource {
	if kind.Collection != "" {
		return schema.GroupResource{Group: kind.Collection, Resource: gvr.Resource}
	}
	return gvr.GroupResource()
}

// scan visits every object of every addressable kind in the namespace.
func (o *ResourceListerFromAPIs) scan(ctx context.Context, namespace string, fn func(*unstructured.Unstructured, SupportedResource, schema.GroupVersionResource)) error {
	clients, err := o.clients.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("get clients: %w", err)
	}

	for _, supported := range addressableResources(o.configured, clients) {
		client, gvr, err := clients.ForKind(ctx, supported.WithVersion(""))
		if err != nil {
			// A kind the pipeline acts on must resolve; one that is only declared may name a group
			// this server does not serve, and reporting nothing for it is what the index does too.
			if supported.IsActive() || !meta.IsNoMatchError(err) {
				return fmt.Errorf("get client for %s: %w", supported.GroupKind, err)
			}
			logging.FromContext(ctx).Warn("skipping declared kind no API group serves",
				"group", supported.Group, "kind", supported.Kind)
			continue
		}
		err = ForEach(ctx, client, func(obj *unstructured.Unstructured) error {
			fn(obj, supported, gvr)
			return nil
		})
		if err != nil {
			return fmt.Errorf("list %s: %w", gvr, err)
		}
	}
	return nil
}

// resourceCounts flattens a per-kind tally into the API shape, ordered so two reads of the same
// instance compare equal.
func resourceCounts(counts map[schema.GroupResource]int64) []provisioning.ResourceCount {
	if len(counts) == 0 {
		return nil
	}
	out := make([]provisioning.ResourceCount, 0, len(counts))
	for gr, count := range counts {
		out = append(out, provisioning.ResourceCount{Group: gr.Group, Resource: gr.Resource, Count: count})
	}
	slices.SortFunc(out, func(a, b provisioning.ResourceCount) int {
		return cmp.Or(cmp.Compare(a.Group, b.Group), cmp.Compare(a.Resource, b.Resource))
	})
	return out
}
