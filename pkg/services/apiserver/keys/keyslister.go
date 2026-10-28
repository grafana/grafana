package keys

import (
	"context"
	"errors"
	"iter"
	"strconv"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// DefaultPageSize is the page size a lister asks for when a caller sets none.
// It matches the server's own cap today, so it costs the fewest round trips a
// server will serve, but it is a client-side hint rather than a contract shared
// across the boundary: the server clamps to whatever its own cap is, and the two
// deploy separately.
const DefaultPageSize = 10000

// ErrUnsupported means the server did not answer with keys: over gRPC a
// server older than keys_only ignores the field and returns bodies, whose items
// carry no name, and over HTTP the endpoint is off and the route is absent.
// Either way the full-object list is the answer, so callers fall back on it.
var ErrUnsupported = errors.New("server did not serve a keys-only list")

// Key is a resource identity from a keys-only list: no body, just what the
// storage key carries. A caller that needs more reads the object on demand.
type Key struct {
	Namespace       string
	Name            string
	ResourceVersion string
	Folder          string
}

// Lister lists a kind's keys, identity only and no bodies. It returns the
// snapshot resourceVersion and a sequence that streams the keys, hiding the
// underlying paging.
//
// The projection carries nothing else, so a keys-only list cannot be filtered:
// the server rejects field and label selectors rather than silently dropping
// them, and serves the store source only. Page size is the one thing a caller
// tunes; see ListerConfig.
type Lister interface {
	ListKeys(ctx context.Context) (listRV int64, keys iter.Seq2[Key, error])
}

// ListerConfig tunes a keys lister.
type ListerConfig struct {
	// PageSize is how many keys one page asks for; zero means
	// DefaultPageSize. The server clamps to its own cap, so a larger value is
	// not an error. A smaller one trades round trips for a smaller page, which is
	// how a caller on a memory budget bounds a single response.
	PageSize int64
}

// ListerOption configures a keys lister.
type ListerOption func(*ListerConfig)

// WithPageSize sets how many keys one page asks for. See ListerConfig.
func WithPageSize(size int64) ListerOption {
	return func(c *ListerConfig) { c.PageSize = size }
}

// NewListerConfig resolves options into a config with defaults applied.
func NewListerConfig(opts ...ListerOption) ListerConfig {
	cfg := ListerConfig{}
	for _, opt := range opts {
		opt(&cfg)
	}
	if cfg.PageSize <= 0 {
		cfg.PageSize = DefaultPageSize
	}
	return cfg
}

// grpcLister reads keys from unified storage over gRPC.
type grpcLister struct {
	store resourcepb.ResourceStoreClient
	gvr   schema.GroupVersionResource
	cfg   ListerConfig
}

// NewGRPCLister returns a Lister backed by the unified-storage gRPC client, for
// a caller with a storage connection of its own.
func NewGRPCLister(store resourcepb.ResourceStoreClient, gvr schema.GroupVersionResource, opts ...ListerOption) Lister {
	return grpcLister{store: store, gvr: gvr, cfg: NewListerConfig(opts...)}
}

func (l grpcLister) page(ctx context.Context, token string) (*resourcepb.ListResponse, error) {
	resp, err := l.store.List(ctx, &resourcepb.ListRequest{
		KeysOnly:      true,
		Limit:         l.cfg.PageSize,
		NextPageToken: token,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Group: l.gvr.Group, Resource: l.gvr.Resource},
		},
	})
	return resp, resource.ErrorFromResponse(resp.GetError(), err)
}

func (l grpcLister) ListKeys(ctx context.Context) (int64, iter.Seq2[Key, error]) {
	// The in-process client reads identity from ctx; a background re-list has none, so set the service identity ("*").
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
				if it.GetName() == "" {
					yield(Key{}, ErrUnsupported)
					return
				}
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
func (l grpcLister) pages(ctx context.Context, first *resourcepb.ListResponse) iter.Seq2[*resourcepb.ListResponse, error] {
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
