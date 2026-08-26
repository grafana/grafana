package informer

import (
	"context"
	"iter"
	"strconv"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// keysListerPageLimit is the max keys_only page size (server cap).
const keysListerPageLimit = 10000

// Key is a resource identity from a keys-only list: no body, just what the KV
// key carries. The controller re-fetches the object on demand.
type Key struct {
	Namespace       string
	Name            string
	ResourceVersion string
	Folder          string
}

// KeysLister lists a kind's keys — identity only, no body — for an informer
// re-list. It returns the snapshot resourceVersion and a sequence that streams
// the keys, hiding the underlying paging.
type KeysLister interface {
	ListKeys(ctx context.Context) (listRV int64, keys iter.Seq2[Key, error])
}

// grpcKeysLister reads keys from unified storage over gRPC.
type grpcKeysLister struct {
	store resourcepb.ResourceStoreClient
	gvr   schema.GroupVersionResource
}

// NewGRPCKeysLister returns a KeysLister backed by the unified-storage gRPC client.
func NewGRPCKeysLister(store resourcepb.ResourceStoreClient, gvr schema.GroupVersionResource) KeysLister {
	return grpcKeysLister{store: store, gvr: gvr}
}

func (l grpcKeysLister) page(ctx context.Context, token string) (*resourcepb.ListResponse, error) {
	resp, err := l.store.List(ctx, &resourcepb.ListRequest{
		KeysOnly:      true,
		Limit:         keysListerPageLimit,
		NextPageToken: token,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Group: l.gvr.Group, Resource: l.gvr.Resource},
		},
	})
	return resp, resource.ErrorFromResponse(resp.GetError(), err)
}

func (l grpcKeysLister) ListKeys(ctx context.Context) (int64, iter.Seq2[Key, error]) {
	// The in-process client reads identity from ctx; the background re-list has none, so set the service identity ("*").
	ctx = identity.WithServiceIdentityContext(ctx, 1)

	// Fetch the first page eagerly to learn the snapshot RV (identical across pages).
	first, err := l.page(ctx, "")
	if err != nil {
		return 0, func(yield func(Key, error) bool) { yield(Key{}, err) }
	}

	return first.GetResourceVersion(), func(yield func(Key, error) bool) {
		for page, err := range l.pages(ctx, first) {
			if err != nil {
				yield(Key{}, err)
				return
			}
			for _, it := range page.GetItems() {
				k := Key{
					Namespace:       it.GetNamespace(),
					Name:            it.GetName(),
					ResourceVersion: strconv.FormatInt(it.GetResourceVersion(), 10),
					Folder:          it.GetFolder(),
				}
				if !yield(k, nil) {
					return
				}
			}
		}
	}
}

// pages yields successive list pages, starting from first, until the continue
// token is empty.
func (l grpcKeysLister) pages(ctx context.Context, first *resourcepb.ListResponse) iter.Seq2[*resourcepb.ListResponse, error] {
	return func(yield func(*resourcepb.ListResponse, error) bool) {
		for page := first; ; {
			if !yield(page, nil) {
				return
			}
			token := page.GetNextPageToken()
			if token == "" {
				return
			}
			next, err := l.page(ctx, token)
			if err != nil {
				yield(nil, err)
				return
			}
			page = next
		}
	}
}
