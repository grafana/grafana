package folders

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type subCountREST struct {
	getter   rest.Getter
	lister   rest.Lister
	searcher resourcepb.ResourceIndexClient
}

var (
	_ = rest.Connecter(&subCountREST{})
	_ = rest.StorageMetadata(&subCountREST{})
)

func (r *subCountREST) New() runtime.Object {
	return &folders.DescendantCounts{}
}

func (r *subCountREST) Destroy() {
}

func (r *subCountREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subCountREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subCountREST) ProducesObject(verb string) interface{} {
	return &folders.DescendantCounts{}
}

func (r *subCountREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subCountREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	if _, err := r.getter.Get(ctx, name, &v1.GetOptions{}); err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(err)
			return
		}

		descendants, err := r.collectDescendantFolders(ctx, name)
		if err != nil {
			responder.Error(err)
			return
		}

		stats, err := r.searcher.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: ns.Value,
			Folder:    name,
			Folders:   descendants,
		})
		if err != nil {
			responder.Error(err)
			return
		}
		rsp := &folders.DescendantCounts{
			Counts: make([]folders.ResourceStats, len(stats.Stats)),
		}
		for i, v := range stats.Stats {
			rsp.Counts[i] = folders.ResourceStats{
				Group:    v.Group,
				Resource: v.Resource,
				Count:    v.Count,
			}
		}
		responder.Object(200, rsp)
	}), nil
}

// collectDescendantFolders walks the folder tree under root and returns every
// descendant folder UID (excluding root itself — the root is passed to
// GetStats via the singular Folder field). Returns nil when there are no
// descendants, which falls back to a single-folder count.
//
// Move/Delete confirmation dialogs need recursive counts: legacy
// /api/folders/:uid/counts walked the SQL folder table with a recursive CTE;
// the unified-storage backend only filters by direct parent, so we expand
// the subtree here before calling GetStats.
func (r *subCountREST) collectDescendantFolders(ctx context.Context, root string) ([]string, error) {
	if r.lister == nil {
		return nil, nil
	}

	childrenOf := map[string][]string{}
	opts := &internalversion.ListOptions{}
	for {
		obj, err := r.lister.List(ctx, opts)
		if err != nil {
			return nil, err
		}
		page, ok := obj.(*folders.FolderList)
		if !ok {
			return nil, fmt.Errorf("could not list folders")
		}
		for i := range page.Items {
			f := &page.Items[i]
			meta, err := utils.MetaAccessor(f)
			if err != nil {
				continue
			}
			parent := meta.GetFolder()
			childrenOf[parent] = append(childrenOf[parent], f.Name)
		}
		if page.Continue == "" {
			break
		}
		opts.Continue = page.Continue
	}

	if len(childrenOf[root]) == 0 {
		return nil, nil
	}

	var out []string
	queue := append([]string(nil), childrenOf[root]...)
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		out = append(out, cur)
		queue = append(queue, childrenOf[cur]...)
	}
	return out, nil
}
