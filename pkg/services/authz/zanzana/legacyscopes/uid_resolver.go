package legacyscopes

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/authlib/types"
	"golang.org/x/sync/singleflight"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
)

var (
	teamGVR = iamv0.TeamResourceInfo.GroupVersionResource()
	userGVR = iamv0.UserResourceInfo.GroupVersionResource()
)

// UID→internal-ID mappings are immutable for an object's lifetime, so a long TTL is safe;
// the bound just caps memory and tolerates the rare deleted-then-absent UID.
const uidToIDCacheTTL = 1 * time.Hour

// Bounds shared IAM fetches independently of any one caller, so a hung
// List or Get cannot block all followers indefinitely.
const uidToIDFetchTimeout = 10 * time.Second

type UIDResolver struct {
	mu             sync.RWMutex
	clients        map[schema.GroupVersionResource]dynamic.NamespaceableResourceInterface
	configProvider restcfg.RestConfigProvider
	// The same UIDs recur across actions and requests. Cache successful mappings
	// and completed namespace loads; share concurrent List and Get fetches with sf.
	cache *localcache.CacheService
	sf    singleflight.Group
}

func NewUIDResolver(configProvider restcfg.RestConfigProvider) *UIDResolver {
	return &UIDResolver{
		clients:        make(map[schema.GroupVersionResource]dynamic.NamespaceableResourceInterface),
		configProvider: configProvider,
		cache:          localcache.New(uidToIDCacheTTL, 10*time.Minute),
	}
}

func (r *UIDResolver) getDynamicClient(ctx context.Context, nsInfo types.NamespaceInfo, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	r.mu.RLock()
	cli, ok := r.clients[gvr]
	r.mu.RUnlock()
	if ok {
		return cli.Namespace(nsInfo.Value), nil
	}

	if r.configProvider == nil {
		return nil, errors.New("config provider not initialized")
	}

	restCfg, err := r.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, err
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, err
	}
	cli = dyn.Resource(gvr)

	r.mu.Lock()
	r.clients[gvr] = cli
	r.mu.Unlock()

	return cli.Namespace(nsInfo.Value), nil
}

func (r *UIDResolver) getObjectID(ctx context.Context, nsInfo types.NamespaceInfo, gvr schema.GroupVersionResource, name string) (int64, error) {
	// Key by resource type so team/user UIDs can't collide, and by the namespace value the
	// fetch actually scopes the Get on (cli.Namespace(nsInfo.Value) in fetchObjectID), so
	// tenants stay isolated. Don't key on OrgID: multiple namespaces can share an OrgID
	// (every cloud stacks-N namespace parses to OrgID 1), which would collide their entries
	// and collapse cross-tenant resolutions into a single singleflight fetch.
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	key := uidCacheKey(gvr, nsInfo, name)
	if v, ok := r.cache.Get(key); ok {
		return v.(int64), nil
	}

	ch := r.sf.DoChan(key, func() (any, error) {
		// Re-check under the flight: a concurrent resolution may have populated the cache
		// while we were waiting for the singleflight slot.
		if v, ok := r.cache.Get(key); ok {
			return v.(int64), nil
		}
		// Detach from the caller's context so one caller cancelling (request timeout, client
		// disconnect) does not fail the shared fetch for every other caller on this flight.
		// A bounded timeout still prevents a hung Get from blocking the flight forever.
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), uidToIDFetchTimeout)
		defer cancel()
		id, err := r.fetchObjectID(fetchCtx, nsInfo, gvr, name)
		if err != nil {
			return 0, err
		}
		// Only cache successful lookups, and skip id == 0: that is the sentinel returned when the
		// deprecated internal-ID label is missing/unparseable (e.g. a dual-write window), so caching
		// it would pin a bogus value for the full TTL instead of re-resolving once it's populated.
		if id != 0 {
			r.cache.Set(key, id, uidToIDCacheTTL)
		}
		return id, nil
	})

	// Wait on this caller's own context so a cancelled caller returns promptly while the
	// shared fetch continues for everyone else.
	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			return 0, res.Err
		}
		return res.Val.(int64), nil
	}
}

func (r *UIDResolver) fetchObjectID(ctx context.Context, nsInfo types.NamespaceInfo, gvr schema.GroupVersionResource, name string) (int64, error) {
	cli, err := r.getDynamicClient(ctx, nsInfo, gvr)
	if err != nil {
		return 0, err
	}

	srvCtx := identity.WithServiceIdentityContext(ctx, nsInfo.OrgID)
	result, err := cli.Get(srvCtx, name, metav1.GetOptions{})
	if err != nil {
		return 0, err
	}

	meta, err := utils.MetaAccessor(result)
	if err != nil {
		return 0, err
	}
	return meta.GetDeprecatedInternalID(), nil // nolint:staticcheck
}

func (r *UIDResolver) GetTeamIDByUID(ctx context.Context, nsInfo types.NamespaceInfo, uid string) (int64, error) {
	return r.getObjectID(ctx, nsInfo, teamGVR, uid)
}

func (r *UIDResolver) GetUserIDByUID(ctx context.Context, nsInfo types.NamespaceInfo, uid string) (int64, error) {
	return r.getObjectID(ctx, nsInfo, userGVR, uid)
}
