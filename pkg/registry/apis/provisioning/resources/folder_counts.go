package resources

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// FolderCountsLegacyGroup is the group of counts that the folder API reads
// from legacy SQL tables instead of unified storage.
const FolderCountsLegacyGroup = "sql-fallback"

// GetFolderCounts returns the number of resources of each kind directly in
// the folder. It does not count resources in subfolders.
func GetFolderCounts(ctx context.Context, folderClient dynamic.ResourceInterface, folderUID string) ([]folderv1.ResourceStats, error) {
	obj, err := folderClient.Get(ctx, folderUID, metav1.GetOptions{}, "counts")
	if err != nil {
		return nil, fmt.Errorf("get counts for folder %q: %w", folderUID, err)
	}
	counts, err := folderv1.UnstructuredToDescendantCounts(obj)
	if err != nil {
		return nil, fmt.Errorf("decode counts for folder %q: %w", folderUID, err)
	}
	return counts.Counts, nil
}

// HasUnsupportedResources reports whether counts contains a resource that
// provisioning cannot migrate. Folders are not included: the caller decides
// about child folders.
func HasUnsupportedResources(counts []folderv1.ResourceStats, supported sets.Set[schema.GroupResource]) bool {
	for _, c := range counts {
		if c.Count == 0 {
			continue
		}
		// Legacy counts are for kinds that are not in unified storage, so
		// provisioning cannot migrate them.
		if c.Group == FolderCountsLegacyGroup {
			return true
		}
		gr := schema.GroupResource{Group: c.Group, Resource: c.Resource}
		if gr == FolderResource.GroupResource() {
			continue
		}
		if !supported.Has(gr) {
			return true
		}
	}
	return false
}

// SupportedFolderScopedResources returns the resources, other than folders,
// that provisioning can write into a folder.
func SupportedFolderScopedResources(ctx context.Context, clients ResourceClients) (sets.Set[schema.GroupResource], error) {
	supported := sets.New[schema.GroupResource]()
	for _, r := range clients.SupportedResources() {
		if r.GroupKind == FolderKind.GroupKind() || !r.IsFolderScoped() {
			continue
		}
		_, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: r.Group, Kind: r.Kind})
		if err != nil {
			return nil, fmt.Errorf("resolve resource for kind %s: %w", r.Kind, err)
		}
		supported.Insert(gvr.GroupResource())
	}
	return supported, nil
}
