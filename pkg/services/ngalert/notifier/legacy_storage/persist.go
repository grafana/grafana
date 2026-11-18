package legacy_storage

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AMStore is a store of Alertmanager configurations.
//
//go:generate mockery --name AMConfigStore --structname MockAMConfigStore --outpkg legacy_storagetest --output ./legacy_storagetest/ --filename persist_mock.go --with-expecter
type AMConfigStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}
