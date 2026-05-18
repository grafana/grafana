package folders

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// descendantsBatchSize bounds how many parent UIDs are sent in a single
// Search `In` filter when walking a subtree. Keeps individual requests
// well under the default 4 MiB gRPC max message size on wide levels.
const descendantsBatchSize = 100

// descendantsPageSize bounds per-page hits when paginating a single Search.
const descendantsPageSize = 1000

// descendantsMaxLevels caps tree traversal depth. The visited map catches
// genuine cycles; this is a backstop against pathological depth that would
// blow up request counts.
const descendantsMaxLevels = 64

// recursiveTimeout caps the recursive subtree walk + final GetStats call.
// The walk's cost scales with subtree size, so on pathological trees we'd
// rather fail fast with 504 than hold the request indefinitely.
const recursiveTimeout = 10 * time.Second

type subCountREST struct {
	getter   rest.Getter
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

// NewConnectOptions advertises the typed DescendantCountsOptions to the
// apiserver. Returning a registered runtime.Object is what makes the
// `recursive` query parameter visible on the generated swagger spec — the
// apiserver reflects over the struct's json tags via AddObjectParams.
func (r *subCountREST) NewConnectOptions() (runtime.Object, bool, string) {
	return &folders.DescendantCountsOptions{}, false, ""
}

func (r *subCountREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	if _, err := r.getter.Get(ctx, name, &v1.GetOptions{}); err != nil {
		return nil, err
	}
	recursive := false
	if options, ok := opts.(*folders.DescendantCountsOptions); ok && options != nil {
		recursive = options.Recursive
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(err)
			return
		}

		folderList := []string{name}
		callCtx := ctx

		if recursive {
			var cancel context.CancelFunc
			callCtx, cancel = context.WithTimeout(ctx, recursiveTimeout)
			defer cancel()

			descendants, err := r.collectDescendantFolders(callCtx, ns.Value, name)
			if err != nil {
				if errors.Is(err, context.DeadlineExceeded) {
					responder.Error(apierrors.NewTimeoutError("recursive folder count exceeded deadline; retry without ?recursive for a shallow count", 0))
					return
				}
				responder.Error(err)
				return
			}
			folderList = append(folderList, descendants...)
		}

		stats, err := r.searcher.GetStats(callCtx, &resourcepb.ResourceStatsRequest{
			Namespace: ns.Value,
			Folder:    folderList,
		})
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) {
				responder.Error(apierrors.NewTimeoutError("recursive folder count exceeded deadline; retry without ?recursive for a shallow count", 0))
				return
			}
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

// convertURLValuesToDescendantCountsOptions is registered with the scheme so
// that ParameterCodec.DecodeParameters can turn the request URL into a typed
// DescendantCountsOptions object. The scheme's default URL-values converter
// would reject the bare `?recursive` form (empty string is not a valid bool);
// we want presence-as-truthy here, so we own the parsing.
//
// Semantics: absent → false; present + empty value (bare `?recursive`) → true;
// present + parseable bool → that bool; present + unparseable value → true
// (presence wins). Keep in sync with the swagger description on the type.
func convertURLValuesToDescendantCountsOptions(in interface{}, out interface{}, _ conversion.Scope) error {
	values := in.(*url.Values)
	opts := out.(*folders.DescendantCountsOptions)

	if !values.Has("recursive") {
		opts.Recursive = false
		return nil
	}
	raw := values.Get("recursive")
	if raw == "" {
		opts.Recursive = true
		return nil
	}
	b, err := strconv.ParseBool(raw)
	if err != nil {
		opts.Recursive = true
		return nil
	}
	opts.Recursive = b
	return nil
}

// collectDescendantFolders walks the folder tree under root via Search and
// returns every descendant folder UID (excluding root itself — the caller
// prepends root to the GetStats request). Returns nil when there are no
// descendants. Cost scales with subtree size, not org size.
//
// Only invoked on the recursive path; the caller bounds the supplied
// context with recursiveTimeout so a pathological subtree fails fast.
//
// Move/Delete confirmation dialogs need recursive counts: legacy
// /api/folders/:uid/counts walked the SQL folder table with a recursive CTE;
// the unified-storage backend only filters by direct parent, so we expand
// the subtree here before calling GetStats.
func (r *subCountREST) collectDescendantFolders(ctx context.Context, namespace, root string) ([]string, error) {
	if r.searcher == nil {
		return nil, nil
	}

	var out []string
	visited := map[string]bool{root: true}
	queue := []string{root}

	for level := 0; len(queue) > 0 && level < descendantsMaxLevels; level++ {
		parents := queue
		queue = nil

		for chunk := range slices.Chunk(parents, descendantsBatchSize) {
			children, err := r.searchChildren(ctx, namespace, chunk)
			if err != nil {
				return nil, err
			}
			for _, uid := range children {
				if visited[uid] {
					continue
				}
				visited[uid] = true
				out = append(out, uid)
				queue = append(queue, uid)
			}
		}
	}

	if len(out) == 0 {
		return nil, nil
	}
	return out, nil
}

// searchChildren returns all direct children of any of the given parent UIDs
// via Search (multi-value `In` filter on SEARCH_FIELD_FOLDER), paginating to
// exhaustion. Reuses getChildrenBatch from validate.go.
func (r *subCountREST) searchChildren(ctx context.Context, namespace string, parents []string) ([]string, error) {
	var all []string
	for offset := int64(0); ; {
		children, hasMore, err := getChildrenBatch(ctx, r.searcher, namespace, parents, descendantsPageSize, offset)
		if err != nil {
			return nil, err
		}
		all = append(all, children...)
		if !hasMore {
			return all, nil
		}
		offset += descendantsPageSize
	}
}
