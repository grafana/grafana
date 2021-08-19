package notifier

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	SyncOrgsPollInterval = 1 * time.Minute
)

var (
	ErrNoAlertmanagerForOrg = fmt.Errorf("Alertmanager does not exist for this organization")
	ErrAlertmanagerNotReady = fmt.Errorf("Alertmanager is not ready yet")
)

type MultiOrgAlertmanager struct {
	alertmanagersMtx sync.RWMutex
	alertmanagers    map[int64]*Alertmanager

	settings *setting.Cfg

	logger log.Logger

	configStore store.AlertingStore
	orgStore    store.OrgStore

	orgRegistry *metrics.OrgRegistries
}

func NewMultiOrgAlertmanager(cfg *setting.Cfg, configStore store.AlertingStore, orgStore store.OrgStore) *MultiOrgAlertmanager {
	return &MultiOrgAlertmanager{
		settings:      cfg,
		logger:        log.New("multiorg.alertmanager"),
		alertmanagers: map[int64]*Alertmanager{},
		configStore:   configStore,
		orgStore:      orgStore,
		orgRegistry:   metrics.NewOrgRegistries(),
	}
}

func (moa *MultiOrgAlertmanager) Run(ctx context.Context) error {
	moa.logger.Info("starting MultiOrg Alertmanager")

	// Make sure to do one initial sync before we run to make sure we load all tenants.
	if err := moa.LoadAndSyncAlertmanagersForOrgs(); err != nil {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			moa.StopAndWait()
			return nil
		case <-time.After(SyncOrgsPollInterval):
			if err := moa.LoadAndSyncAlertmanagersForOrgs(); err != nil {
				moa.logger.Error("error while synchronizing Alertmanager orgs", "err", err)
			}
		}
	}
}

func (moa *MultiOrgAlertmanager) LoadAndSyncAlertmanagersForOrgs() error {
	moa.logger.Debug("synchronizing Alertmanagers for orgs")
	// First, load all the organizations from the database.
	orgIDs, err := moa.orgStore.GetOrgs()
	if err != nil {
		return err
	}

	// Then, sync them by creating or deleting Alertmanagers as necessary.
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
			// we need to create a new one
			reg := moa.orgRegistry.GetOrCreateOrgRegistry(orgID)
			am, err := newAlertmanager(orgID, moa.settings, moa.configStore, metrics.NewMetrics(reg))
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
			moa.orgRegistry.RemoveOrgRegistry(orgId)
		}
	}
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

//TODO: Document me
func (moa *MultiOrgAlertmanager) AlertmanagerFor(orgID int64) (*Alertmanager, error) {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	userAM, existing := moa.alertmanagers[orgID]
	if !existing {
		return nil, ErrNoAlertmanagerForOrg
	}

	if !userAM.Ready() {
		return nil, ErrAlertmanagerNotReady
	}

	return userAM, nil
}
