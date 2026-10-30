package legacyscopes

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/authlib/types"
	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const uidListPageSize = 1000
const uidFallbackConcurrency = 8
const missingScopeMappingTTL = time.Minute

type ScopeAliasPreparer interface {
	PrepareScopes(context.Context, types.NamespaceInfo, []ScopeReference) (ScopeResolver, error)
}

type scopeAliasResult struct {
	value string
	err   error
}
type preparedScopes struct {
	namespace string
	values    map[ScopeReference]scopeAliasResult
}

func (p preparedScopes) ResolveScope(ctx context.Context, ns types.NamespaceInfo, ref ScopeReference) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if ns.Value != p.namespace {
		return "", errors.New("prepared scopes belong to a different namespace")
	}
	result, ok := p.values[ref]
	if !ok {
		return "", errors.New("scope reference was not prepared")
	}
	return result.value, result.err
}

func missingScopeKey(ns types.NamespaceInfo, ref ScopeReference) string {
	return fmt.Sprintf("scope-unavailable/%s/%s/%s/%s", ref.Resource, ns.Value, ref.Attribute, ref.Value)
}
func uidCacheKey(gvr schema.GroupVersionResource, ns types.NamespaceInfo, name string) string {
	return fmt.Sprintf("%s/%s/%s", gvr.Resource, ns.Value, name)
}

func (r *UIDResolver) cachedScopeAlias(ns types.NamespaceInfo, ref ScopeReference) (string, bool) {
	gvr, err := scopeResource(ref.Resource)
	if err != nil {
		return "", false
	}
	if ref.Attribute == "uid" {
		if value, ok := r.cache.Get(uidCacheKey(gvr, ns, ref.Value)); ok {
			return strconv.FormatInt(value.(int64), 10), true
		}
	} else if id, err := strconv.ParseInt(ref.Value, 10, 64); err == nil {
		if value, ok := r.cache.Get(reverseIDKey(gvr, ns, id)); ok {
			return value.(string), true
		}
	}
	_, ok := r.cache.Get(missingScopeKey(ns, ref))
	return "", ok
}

// PrepareScopes shares namespace metadata across all actions and both scope attributes.
// A failed List aborts preparation without falling back to a storm of object lookups.
func (r *UIDResolver) PrepareScopes(ctx context.Context, ns types.NamespaceInfo, refs []ScopeReference) (ScopeResolver, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	unique := make(map[ScopeReference]bool)
	for _, ref := range refs {
		if _, err := scopeResource(ref.Resource); err != nil {
			return nil, err
		}
		if ref.Attribute != "id" && ref.Attribute != "uid" {
			return nil, errors.New("unsupported identity scope attribute")
		}
		unique[ref] = true
	}
	loads, loadCtx := errgroup.WithContext(ctx)
	planned := map[schema.GroupVersionResource]bool{}
	for ref := range unique {
		gvr, _ := scopeResource(ref.Resource)
		if _, ok := r.cachedScopeAlias(ns, ref); !ok && !planned[gvr] {
			planned[gvr] = true
			loads.Go(func() error { return r.loadNamespaceIDs(loadCtx, ns, gvr) })
		}
	}
	if err := loads.Wait(); err != nil {
		return nil, err
	}
	prepared := preparedScopes{namespace: ns.Value, values: make(map[ScopeReference]scopeAliasResult, len(unique))}
	var missing []ScopeReference
	for ref := range unique {
		if alias, ok := r.cachedScopeAlias(ns, ref); ok {
			prepared.values[ref] = scopeAliasResult{value: alias}
		} else {
			missing = append(missing, ref)
		}
	}
	results := make([]scopeAliasResult, len(missing))
	lookups, lookupCtx := errgroup.WithContext(ctx)
	lookups.SetLimit(uidFallbackConcurrency)
	for i, ref := range missing {
		lookups.Go(func() error {
			alias, err := r.ResolveScope(lookupCtx, ns, ref)
			results[i] = scopeAliasResult{value: alias, err: err}
			if alias == "" && (err == nil || apierrors.IsNotFound(err)) {
				r.cache.Set(missingScopeKey(ns, ref), true, missingScopeMappingTTL)
			}
			return lookupCtx.Err()
		})
	}
	if err := lookups.Wait(); err != nil {
		return nil, err
	}
	for i, ref := range missing {
		prepared.values[ref] = results[i]
	}
	return prepared, ctx.Err()
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
		ids := map[string]int64{}
		uids := map[int64]string{}
		var uidOnly []string
		var continuation string
		seen := map[string]bool{}
		for {
			page, err := cli.List(fetchCtx, metav1.ListOptions{Limit: uidListPageSize, Continue: continuation})
			if err != nil {
				return nil, fmt.Errorf("list %s scope IDs: %w", gvr.Resource, err)
			}
			for i := range page.Items {
				item := &page.Items[i]
				meta, err := utils.MetaAccessor(item)
				if err != nil {
					return nil, err
				}
				uid := item.GetName()
				if uid == "" {
					return nil, errors.New("IAM List returned an unnamed identity")
				}
				id := meta.GetDeprecatedInternalID() //nolint:staticcheck // Numeric-scope compatibility.
				if id <= 0 {
					uidOnly = append(uidOnly, uid)
					continue
				}
				if previous, ok := ids[uid]; ok && previous != id {
					return nil, errors.New("IAM List returned conflicting IDs for one UID")
				}
				if other, ok := uids[id]; ok && other != uid {
					return nil, errors.New("IAM List returned ambiguous identity IDs")
				}
				ids[uid], uids[id] = id, uid
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
		for uid, id := range ids {
			r.cacheMapping(gvr, ns, uid, id)
		}
		for _, uid := range uidOnly {
			r.cache.Set(missingScopeKey(ns, ScopeReference{Resource: gvr.Resource, Attribute: "uid", Value: uid}), true, missingScopeMappingTTL)
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
