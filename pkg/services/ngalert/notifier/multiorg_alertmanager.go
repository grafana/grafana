package notifier

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	SyncOrgsPollInterval    = 1 * time.Minute
	ErrNoAlertmanagerForOrg = fmt.Errorf("Alertmanager does not exist for this organization")
	ErrAlertmanagerNotReady = fmt.Errorf("Alertmanager is not ready yet")
)

type MultiOrgAlertmanager struct {
	alertmanagersMtx sync.RWMutex
	alertmanagers    map[int64]*Alertmanager

	settings *setting.Cfg
	logger   log.Logger

	configStore store.AlertingStore
	orgStore    store.OrgStore
	kvStore     kvstore.KVStore

	metrics *metrics.MultiOrgAlertmanager
}

func NewMultiOrgAlertmanager(cfg *setting.Cfg, configStore store.AlertingStore, orgStore store.OrgStore, kvStore kvstore.KVStore, m *metrics.MultiOrgAlertmanager) *MultiOrgAlertmanager {
	return &MultiOrgAlertmanager{
		settings:      cfg,
		logger:        log.New("multiorg.alertmanager"),
		alertmanagers: map[int64]*Alertmanager{},
		configStore:   configStore,
		orgStore:      orgStore,
		kvStore:       kvStore,
		metrics:       m,
	}
}

func (moa *MultiOrgAlertmanager) Run(ctx context.Context) error {
	moa.logger.Info("starting MultiOrg Alertmanager")

	for {
		select {
		case <-ctx.Done():
			moa.StopAndWait()
			return nil
		case <-time.After(SyncOrgsPollInterval):
			if err := moa.LoadAndSyncAlertmanagersForOrgs(ctx); err != nil {
				moa.logger.Error("error while synchronizing Alertmanager orgs", "err", err)
			}
		}
	}
}

func (moa *MultiOrgAlertmanager) LoadAndSyncAlertmanagersForOrgs(ctx context.Context) error {
	moa.logger.Debug("synchronizing Alertmanagers for orgs")
	// First, load all the organizations from the database.
	orgIDs, err := moa.orgStore.GetOrgs(ctx)
	if err != nil {
		return err
	}

	// Then, sync them by creating or deleting Alertmanagers as necessary.
	moa.metrics.DiscoveredConfigurations.Set(float64(len(orgIDs)))
	moa.SyncAlertmanagersForOrgs(orgIDs)

	moa.logger.Debug("done synchronizing Alertmanagers for orgs")

	return nil
}

func (moa *MultiOrgAlertmanager) SyncAlertmanagersForOrgs(orgIDs []int64) {
	orgsFound := make(map[int64]struct{}, len(orgIDs))
	moa.alertmanagersMtx.Lock()
	for _, orgID := range orgIDs {
		orgsFound[orgID] = struct{}{}

		existing, found := moa.alertmanagers[orgID]
		if !found {
			// These metrics are not exported by Grafana and are mostly a placeholder.
			// To export them, we need to translate the metrics from each individual registry and,
			// then aggregate them on the main registry.
			m := metrics.NewAlertmanagerMetrics(moa.metrics.GetOrCreateOrgRegistry(orgID))
			am, err := newAlertmanager(orgID, moa.settings, moa.configStore, moa.kvStore, m)
			if err != nil {
				moa.logger.Error("unable to create Alertmanager for org", "org", orgID, "err", err)
			}
			moa.alertmanagers[orgID] = am
			existing = am
		}

		//TODO: This will create an N+1 query
		if err := existing.SyncAndApplyConfigFromDatabase(); err != nil {
			moa.logger.Error("failed to apply Alertmanager config for org", "org", orgID, "err", err)
		}
	}

	amsToStop := map[int64]*Alertmanager{}
	for orgId, am := range moa.alertmanagers {
		if _, exists := orgsFound[orgId]; !exists {
			amsToStop[orgId] = am
			delete(moa.alertmanagers, orgId)
			moa.metrics.RemoveOrgRegistry(orgId)
		}
	}
	moa.metrics.ActiveConfigurations.Set(float64(len(moa.alertmanagers)))
	moa.alertmanagersMtx.Unlock()

	// Now, we can stop the Alertmanagers without having to hold a lock.
	for orgID, am := range amsToStop {
		moa.logger.Info("stopping Alertmanager", "org", orgID)
		am.StopAndWait()
		moa.logger.Info("stopped Alertmanager", "org", orgID)
	}
}

func (moa *MultiOrgAlertmanager) StopAndWait() {
	moa.alertmanagersMtx.Lock()
	defer moa.alertmanagersMtx.Unlock()

	for _, am := range moa.alertmanagers {
		am.StopAndWait()
	}
}

// AlertmanagerFor returns the Alertmanager instance for the organization provided.
// When the organization does not have an active Alertmanager, it returns a ErrNoAlertmanagerForOrg.
// When the Alertmanager of the organization is not ready, it returns a ErrAlertmanagerNotReady.
func (moa *MultiOrgAlertmanager) AlertmanagerFor(orgID int64) (*Alertmanager, error) {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	orgAM, existing := moa.alertmanagers[orgID]
	if !existing {
		return nil, ErrNoAlertmanagerForOrg
	}

	if !orgAM.Ready() {
		return nil, ErrAlertmanagerNotReady
	}

	return orgAM, nil
}
