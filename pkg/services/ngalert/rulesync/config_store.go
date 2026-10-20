package rulesync

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// cfgAccessor is the per-org Config-resource access the syncer needs: a
// cached client behind plain Get/UpdateStatus calls, hiding the lazy-build
// and optimistic-retry mechanics from the sync loop. Satisfied by *cfgStore.
type cfgAccessor interface {
	// Get returns the org's Config resource, or nil if none exists yet.
	Get(ctx context.Context, orgID int64) (*alertingrulesv0alpha1.Config, error)
	// UpdateStatus upserts the org's Config.status using compute(prev),
	// creating the resource (seeding .Status from compute(nil)) if absent.
	UpdateStatus(ctx context.Context, orgID int64, compute func(prev *alertingrulesv0alpha1.ConfigStatus) alertingrulesv0alpha1.ConfigStatus) error
}

// cfgStore is the real cfgAccessor. The k8s client is built lazily from
// clientGenerator, NOT at construction: eager construction deadlocks during
// DI, since the ClientGenerator blocks on the apiserver being ready, which
// can't happen while we hold the main init goroutine.
type cfgStore struct {
	clientGenerator resource.ClientGenerator
	namespaceMapper request.NamespaceMapper

	mu     sync.Mutex
	client *alertingrulesv0alpha1.ConfigClient
}

func newCfgStore(clientGenerator resource.ClientGenerator, namespaceMapper request.NamespaceMapper) *cfgStore {
	return &cfgStore{clientGenerator: clientGenerator, namespaceMapper: namespaceMapper}
}

// resolveClient lazily builds and caches the rules Config client. The
// successful client is cached, but construction failures are NOT: the next
// call retries, so a transient apiserver-not-ready at the first tick doesn't
// disable the API sync path until the process restarts.
func (c *cfgStore) resolveClient() (*alertingrulesv0alpha1.ConfigClient, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.client != nil {
		return c.client, nil
	}
	client, err := alertingrulesv0alpha1.NewConfigClientFromGenerator(c.clientGenerator)
	if err != nil {
		return nil, fmt.Errorf("construct Config client: %w", err)
	}
	c.client = client
	return c.client, nil
}

// orgContext wraps ctx with a service identity scoped to the org's
// namespace for in-process k8s calls.
func (c *cfgStore) orgContext(ctx context.Context, orgID int64) (context.Context, string) {
	ns := c.namespaceMapper(orgID)
	return identity.WithServiceIdentityForSingleNamespaceContext(ctx, ns), ns
}

func (c *cfgStore) Get(ctx context.Context, orgID int64) (*alertingrulesv0alpha1.Config, error) {
	client, err := c.resolveClient()
	if err != nil {
		return nil, err
	}
	nsCtx, ns := c.orgContext(ctx, orgID)
	cfg, err := client.Get(nsCtx, resource.Identifier{Namespace: ns, Name: alertingrulesv0alpha1.ConfigSingletonName})
	if k8serrors.IsNotFound(err) {
		return nil, nil
	}
	return cfg, err
}

// UpdateStatus is optimistic via RetryOnConflict; best-effort by contract
// with the syncer, which only logs on error. Unchanged status produces no
// physical write (unified storage dedup).
func (c *cfgStore) UpdateStatus(ctx context.Context, orgID int64, compute func(prev *alertingrulesv0alpha1.ConfigStatus) alertingrulesv0alpha1.ConfigStatus) error {
	client, err := c.resolveClient()
	if err != nil {
		return err
	}
	nsCtx, ns := c.orgContext(ctx, orgID)
	if ns == "" {
		return nil
	}
	id := resource.Identifier{Namespace: ns, Name: alertingrulesv0alpha1.ConfigSingletonName}

	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		existing, getErr := client.Get(nsCtx, id)
		if k8serrors.IsNotFound(getErr) {
			// Seed .Status on Create. Unified storage persists the whole object on
			// Create today; a future migration to a real /status subresource would
			// silently drop this -- at that point swap to UpdateStatus.
			r := &alertingrulesv0alpha1.Config{
				ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: alertingrulesv0alpha1.ConfigSingletonName},
				Status:     compute(nil),
			}
			if _, createErr := client.Create(nsCtx, r, resource.CreateOptions{}); createErr != nil {
				// AlreadyExists -> another writer raced us. Surface as a conflict so
				// RetryOnConflict re-enters and sees the existing object.
				if k8serrors.IsAlreadyExists(createErr) {
					return k8serrors.NewConflict(alertingrulesv0alpha1.ConfigKind().GroupVersionResource().GroupResource(), id.Name, createErr)
				}
				return createErr
			}
			return nil
		}
		if getErr != nil {
			return getErr
		}
		_, updateErr := client.UpdateStatus(nsCtx, id, compute(&existing.Status), resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return updateErr
	})
}
