package migration

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

type UpgradeService interface {
}

type migrationService struct {
	lock           *serverlock.ServerLockService
	cfg            *setting.Cfg
	features       featuremgmt.FeatureToggles
	log            log.Logger
	store          db.DB
	migrationStore migrationStore.Store

	encryptionService secrets.Service
}

func ProvideService(
	lock *serverlock.ServerLockService,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	store db.DB,
	migrationStore migrationStore.Store,
	encryptionService secrets.Service,
) (UpgradeService, error) {
	return &migrationService{
		lock:              lock,
		log:               log.New("ngalert.migration"),
		cfg:               cfg,
		features:          features,
		store:             store,
		migrationStore:    migrationStore,
		encryptionService: encryptionService,
	}, nil
}
