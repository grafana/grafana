package legacyscopes

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/authlib/types"
	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const uidListPageSize = 1000
const uidFallbackConcurrency = 8

// Prepare resolves metadata once for all actions. Only mappings absent from a
// successful namespace load use individual Gets; a failed List never fans out.
func (r *UIDResolver) Prepare(ctx context.Context, ns types.NamespaceInfo, users, teams []string) (IDResolver, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	plans := []struct {
		gvr   schema.GroupVersionResource
		names []string
	}{{userGVR, users}, {teamGVR, teams}}
	loads, loadCtx := errgroup.WithContext(ctx)
	for _, plan := range plans {
		for _, name := range plan.names {
			if _, ok := r.cache.Get(uidCacheKey(plan.gvr, ns, name)); !ok {
				loads.Go(func() error { return r.loadNamespaceIDs(loadCtx, ns, plan.gvr) })
				break
			}
		}
	}
	if err := loads.Wait(); err != nil {
		return nil, err
	}

	resolved := make(resolvedUIDs)
	type missingID struct {
		gvr  schema.GroupVersionResource
		name string
	}
	var missing []missingID
	for _, plan := range plans {
		for _, name := range plan.names {
			key := uidCacheKey(plan.gvr, ns, name)
			if _, found := resolved[key]; found {
				continue
			}
			if id, ok := r.cache.Get(key); ok {
				resolved[key] = uidResult{id: id.(int64)}
			} else {
				resolved[key] = uidResult{}
				missing = append(missing, missingID{plan.gvr, name})
			}
		}
	}
	// Each worker owns a slot, avoiding concurrent map writes. Failed Gets are
	// retained in this request so aliases cannot repeatedly retry missing objects.
	results := make([]uidResult, len(missing))
	gets, getCtx := errgroup.WithContext(ctx)
	gets.SetLimit(uidFallbackConcurrency)
	for i, item := range missing {
		gets.Go(func() error {
			if err := getCtx.Err(); err != nil {
				return err
			}
			id, err := r.getObjectID(getCtx, ns, item.gvr, item.name)
			if err == nil && id == 0 {
				err = errors.New("legacy internal ID is unavailable")
			}
			results[i] = uidResult{id: id, err: err}
			return getCtx.Err()
		})
	}
	if err := gets.Wait(); err != nil {
		return nil, err
	}
	for i, item := range missing {
		resolved[uidCacheKey(item.gvr, ns, item.name)] = results[i]
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return resolved, nil
}

func uidCacheKey(gvr schema.GroupVersionResource, ns types.NamespaceInfo, name string) string {
	return fmt.Sprintf("%s/%s/%s", gvr.Resource, ns.Value, name)
}

func (r *UIDResolver) loadNamespaceIDs(ctx context.Context, ns types.NamespaceInfo, gvr schema.GroupVersionResource) error {
	key := "uid-list/" + gvr.Resource + "/" + ns.Value
	if _, ok := r.cache.Get(key); ok {
		return nil
	}
	ch := r.sf.DoChan(key, func() (any, error) {
		if _, ok := r.cache.Get(key); ok {
			return nil, nil
		}
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), uidToIDFetchTimeout)
		defer cancel()
		cli, err := r.getDynamicClient(fetchCtx, ns, gvr)
		if err != nil {
			return nil, err
		}
		fetchCtx = identity.WithServiceIdentityContext(fetchCtx, ns.OrgID)
		ids := make(map[string]int64)
		var continuation string
		seen := make(map[string]bool)
		for {
			page, err := cli.List(fetchCtx, metav1.ListOptions{Limit: uidListPageSize, Continue: continuation})
			if err != nil {
				return nil, fmt.Errorf("list %s scope IDs: %w", gvr.Resource, err)
			}
			for i := range page.Items {
				meta, err := utils.MetaAccessor(&page.Items[i])
				if err != nil {
					return nil, err
				}
				if id := meta.GetDeprecatedInternalID(); id != 0 { //nolint:staticcheck
					ids[page.Items[i].GetName()] = id
				}
			}
			continuation = page.GetContinue()
			if continuation == "" {
				break
			}
			if seen[continuation] {
				return nil, errors.New("IAM List repeated a continuation token")
			}
			seen[continuation] = true
		}
		if err := fetchCtx.Err(); err != nil {
			return nil, err
		}
		// Publish only after all pages succeed, then mark this namespace warm.
		for name, id := range ids {
			r.cache.Set(uidCacheKey(gvr, ns, name), id, uidToIDCacheTTL)
		}
		r.cache.Set(key, true, uidToIDCacheTTL)
		return nil, nil
	})
	select {
	case <-ctx.Done():
		return ctx.Err()
	case result := <-ch:
		return result.Err
	}
}

type uidResult struct {
	id  int64
	err error
}
type resolvedUIDs map[string]uidResult

func (r resolvedUIDs) get(ctx context.Context, ns types.NamespaceInfo, gvr schema.GroupVersionResource, name string) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	result, ok := r[uidCacheKey(gvr, ns, name)]
	if !ok {
		return 0, errors.New("scope UID was not prepared")
	}
	return result.id, result.err
}
func (r resolvedUIDs) GetUserIDByUID(ctx context.Context, ns types.NamespaceInfo, uid string) (int64, error) {
	return r.get(ctx, ns, userGVR, uid)
}
func (r resolvedUIDs) GetTeamIDByUID(ctx context.Context, ns types.NamespaceInfo, uid string) (int64, error) {
	return r.get(ctx, ns, teamGVR, uid)
}
