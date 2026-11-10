package dashboard

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/folder"
)

// Short because folder moves and grant changes are not invalidated; saving still enforces permissions.
const creatableTreeTTL = 30 * time.Second

// CreatableTreeCache caches each user's CreatableTree; concurrent misses share one build.
type CreatableTreeCache struct {
	cache   *localcache.CacheService
	perms   userPermissionsGetter
	folders folder.Service
}

func NewCreatableTreeCache(perms userPermissionsGetter, folders folder.Service) *CreatableTreeCache {
	return &CreatableTreeCache{
		cache:   localcache.New(creatableTreeTTL, time.Minute),
		perms:   perms,
		folders: folders,
	}
}

func (c *CreatableTreeCache) Get(ctx context.Context, user identity.Requester) (*CreatableTree, error) {
	key := fmt.Sprintf("%d/%s", user.GetOrgID(), user.GetUID())
	v, err := c.cache.GetOrExclusiveSet(key, func() (any, error) {
		grants, err := ResolveCreateGrants(ctx, c.perms, user)
		if err != nil {
			return nil, err
		}
		return BuildCreatableTree(ctx, c.folders, user.GetOrgID(), grants)
	}, creatableTreeTTL)
	if err != nil {
		return nil, err
	}
	return v.(*CreatableTree), nil
}
