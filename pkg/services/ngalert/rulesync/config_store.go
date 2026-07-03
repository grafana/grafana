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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// rulesConfigStore reads the per-org external ruler sync datasource UID from the
// rules-app Config resource and writes back sync status. Split out from the
// syncer so the orchestration (SyncOrg) can be unit-tested against a fake while
// the real k8s-client wiring is verified via integration/manual testing.
type rulesConfigStore interface {
	// GetSyncSpec returns the org's externalRulerSync spec fields, with empty
	// strings when the resource or a field is absent.
	GetSyncSpec(ctx context.Context, orgID int64) (syncSpec, error)
	// WriteStatus upserts the org's Config status using compute(prev), creating
	// the singleton if absent. Best-effort; callers log failures.
	WriteStatus(ctx context.Context, orgID int64, compute func(prev *alertingrulesv0alpha1.ConfigStatus) alertingrulesv0alpha1.ConfigStatus) error
}

// k8sConfigStore is the production rulesConfigStore backed by the rules-app
// Config client. It mirrors the external AM syncer's client scaffolding: the
// client is built lazily (not at construction) because the ClientGenerator
// blocks until the apiserver is ready, which would deadlock during DI.
type k8sConfigStore struct {
	logger          log.Logger
	clientGenerator resource.ClientGenerator
	namespaceMapper request.NamespaceMapper

	cfgClientMu sync.Mutex
	cfgClient   *alertingrulesv0alpha1.ConfigClient
}

func newK8sConfigStore(logger log.Logger, clientGenerator resource.ClientGenerator, namespaceMapper request.NamespaceMapper) *k8sConfigStore {
	return &k8sConfigStore{
		logger:          logger,
		clientGenerator: clientGenerator,
		namespaceMapper: namespaceMapper,
	}
}

// resolveCfgClient lazily builds and caches the Config client. Construction
// failures are NOT cached: the next call retries, so a transient
// apiserver-not-ready at the first tick doesn't disable sync until restart.
func (s *k8sConfigStore) resolveCfgClient() (*alertingrulesv0alpha1.ConfigClient, error) {
	s.cfgClientMu.Lock()
	defer s.cfgClientMu.Unlock()
	if s.cfgClient != nil {
		return s.cfgClient, nil
	}
	if s.clientGenerator == nil {
		return nil, fmt.Errorf("no client generator configured")
	}
	c, err := alertingrulesv0alpha1.NewConfigClientFromGenerator(s.clientGenerator)
	if err != nil {
		return nil, fmt.Errorf("construct Config client: %w", err)
	}
	s.cfgClient = c
	return s.cfgClient, nil
}

// orgServiceContext wraps ctx with a service identity scoped to the org's
// namespace for in-process k8s calls.
func (s *k8sConfigStore) orgServiceContext(ctx context.Context, orgID int64) (context.Context, string) {
	if s.namespaceMapper == nil {
		return ctx, ""
	}
	ns := s.namespaceMapper(orgID)
	return identity.WithServiceIdentityForSingleNamespaceContext(ctx, ns), ns
}

// syncSpec holds the externalRulerSync spec fields the worker reads from the
// org's Config resource in a single round trip.
type syncSpec struct {
	// DatasourceUID is the source Mimir/Cortex ruler datasource to sync from.
	DatasourceUID string
	// TargetDatasourceUID is where converted recording rules write their
	// results; empty means default to the query (source) datasource.
	TargetDatasourceUID string
	// Promote requests a one-way conversion of the synced rules into native
	// Grafana rules the org owns, after which sync stops.
	Promote bool
	// LastAppliedHash is the upstream config hash from the last successful sync
	// (read from status); lets the worker skip unchanged re-applies across
	// restarts/replicas, unlike the in-memory cache. Empty if never synced.
	LastAppliedHash string
}

func (s *k8sConfigStore) GetSyncSpec(ctx context.Context, orgID int64) (syncSpec, error) {
	c, err := s.resolveCfgClient()
	if err != nil {
		return syncSpec{}, err
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	cfg, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: alertingrulesv0alpha1.ConfigSingletonName})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return syncSpec{}, nil
		}
		return syncSpec{}, err
	}
	return syncSpecFromConfig(cfg), nil
}

func (s *k8sConfigStore) WriteStatus(ctx context.Context, orgID int64, compute func(prev *alertingrulesv0alpha1.ConfigStatus) alertingrulesv0alpha1.ConfigStatus) error {
	c, err := s.resolveCfgClient()
	if err != nil {
		return err
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	if ns == "" {
		return nil
	}
	id := resource.Identifier{Namespace: ns, Name: alertingrulesv0alpha1.ConfigSingletonName}

	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		existing, getErr := c.Get(nsCtx, id)
		if k8serrors.IsNotFound(getErr) {
			// Seed .Status on Create. Unified storage persists the whole object
			// on Create today; a future migration to a real /status subresource
			// would silently drop this — at that point swap to UpdateStatus.
			r := &alertingrulesv0alpha1.Config{
				ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: alertingrulesv0alpha1.ConfigSingletonName},
				Status:     compute(nil),
			}
			if _, createErr := c.Create(nsCtx, r, resource.CreateOptions{}); createErr != nil {
				// AlreadyExists → another writer raced us. Surface as a conflict
				// so RetryOnConflict re-enters and sees the existing object.
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
		_, updateErr := c.UpdateStatus(nsCtx, id, compute(&existing.Status), resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return updateErr
	})
}

// syncSpecFromConfig extracts the externalRulerSync spec fields, tolerating any
// level of the nested optional chain being unset.
func syncSpecFromConfig(c *alertingrulesv0alpha1.Config) syncSpec {
	if c == nil || c.Spec.ExternalRulerSync == nil {
		return syncSpec{}
	}
	var spec syncSpec
	if uid := c.Spec.ExternalRulerSync.DatasourceUid; uid != nil {
		spec.DatasourceUID = *uid
	}
	if uid := c.Spec.ExternalRulerSync.TargetDatasourceUid; uid != nil {
		spec.TargetDatasourceUID = *uid
	}
	if p := c.Spec.ExternalRulerSync.Promote; p != nil {
		spec.Promote = *p
	}
	if st := c.Status.ExternalRulerSync; st != nil && st.LastAppliedHash != nil {
		spec.LastAppliedHash = *st.LastAppliedHash
	}
	return spec
}
