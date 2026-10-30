package legacyscopes

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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
	teamGVR           = iamv0.TeamResourceInfo.GroupVersionResource()
	userGVR           = iamv0.UserResourceInfo.GroupVersionResource()
	serviceAccountGVR = iamv0.ServiceAccountResourceInfo.GroupVersionResource()
)

// UID→internal-ID mappings are immutable for an object's lifetime, so a long TTL is safe;
// the bound just caps memory and tolerates the rare deleted-then-absent UID.
const uidToIDCacheTTL = 1 * time.Hour

// Bounds the detached singleflight fetch. The fetch runs on a context decoupled from any single
// caller (see getObjectID), so without this a hung apiserver Get would block the flight—and every
// follower waiting on it—indefinitely.
const uidToIDFetchTimeout = 10 * time.Second

type UIDResolver struct {
	mu             sync.RWMutex
	clients        map[schema.GroupVersionResource]dynamic.NamespaceableResourceInterface
	configProvider restcfg.RestConfigProvider
	// cache stores resolved UID→internal-ID mappings; sf collapses concurrent resolutions
	// of the same key into a single apiserver Get. Both teams and users resolve through here,
	// and the same UIDs recur across every action during a permission merge, so this removes
	// the bulk of the redundant apiserver lookups.
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
	key := fmt.Sprintf("%s/%s/%s", gvr.Resource, nsInfo.Value, name)
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
			r.cacheMapping(gvr, nsInfo, name, id)
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

func scopeResource(resource string) (schema.GroupVersionResource, error) {
	switch resource {
	case "users":
		return userGVR, nil
	case "teams":
		return teamGVR, nil
	case "serviceaccounts":
		return serviceAccountGVR, nil
	default:
		return schema.GroupVersionResource{}, errors.New("unsupported identity scope resource")
	}
}

func (r *UIDResolver) ResolveScope(ctx context.Context, ns types.NamespaceInfo, ref ScopeReference) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	gvr, err := scopeResource(ref.Resource)
	if err != nil {
		return "", err
	}
	switch ref.Attribute {
	case "uid":
		id, err := r.getObjectID(ctx, ns, gvr, ref.Value)
		if err != nil || id <= 0 {
			return "", err
		}
		return strconv.FormatInt(id, 10), nil
	case "id":
		id, err := strconv.ParseInt(ref.Value, 10, 64)
		if err != nil || id <= 0 {
			return "", errors.New("invalid numeric identity scope")
		}
		return r.getObjectUID(ctx, ns, gvr, id)
	default:
		return "", errors.New("unsupported identity scope attribute")
	}
}

func reverseIDKey(gvr schema.GroupVersionResource, ns types.NamespaceInfo, id int64) string {
	return fmt.Sprintf("id-to-uid/%s/%s/%d", gvr.Resource, ns.Value, id)
}

func (r *UIDResolver) cacheMapping(gvr schema.GroupVersionResource, ns types.NamespaceInfo, uid string, id int64) {
	if uid == "" || id <= 0 {
		return
	}
	r.cache.Set(fmt.Sprintf("%s/%s/%s", gvr.Resource, ns.Value, uid), id, uidToIDCacheTTL)
	r.cache.Set(reverseIDKey(gvr, ns, id), uid, uidToIDCacheTTL)
}

func (r *UIDResolver) getObjectUID(ctx context.Context, ns types.NamespaceInfo, gvr schema.GroupVersionResource, id int64) (string, error) {
	key := reverseIDKey(gvr, ns, id)
	if v, ok := r.cache.Get(key); ok {
		return v.(string), nil
	}
	ch := r.sf.DoChan(key, func() (any, error) {
		if v, ok := r.cache.Get(key); ok {
			return v.(string), nil
		}
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), uidToIDFetchTimeout)
		defer cancel()
		cli, err := r.getDynamicClient(fetchCtx, ns, gvr)
		if err != nil {
			return "", err
		}
		page, err := cli.List(identity.WithServiceIdentityContext(fetchCtx, ns.OrgID), metav1.ListOptions{
			LabelSelector: fmt.Sprintf("%s=%d", utils.LabelKeyDeprecatedInternalID, id), //nolint:staticcheck
			Limit:         2,
		})
		if err != nil {
			return "", err
		}
		if len(page.Items) == 0 {
			return "", nil
		}
		if len(page.Items) != 1 || page.GetContinue() != "" {
			return "", errors.New("ambiguous or incomplete identity ID lookup")
		}
		meta, err := utils.MetaAccessor(&page.Items[0])
		if err != nil {
			return "", err
		}
		if meta.GetDeprecatedInternalID() != id { //nolint:staticcheck // Numeric-scope compatibility.
			return "", errors.New("identity ID lookup returned a different ID")
		}
		uid := page.Items[0].GetName()
		r.cacheMapping(gvr, ns, uid, id)
		return uid, nil
	})
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			return "", res.Err
		}
		return res.Val.(string), nil
	}
}
