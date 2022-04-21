package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type TemplateService struct {
	config AMConfigStore
	prov   ProvisioningStore
	xact   TransactionManager
	log    log.Logger
}

func NewTemplateService(config AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *TemplateService {
	return &TemplateService{
		config: config,
		prov:   prov,
		xact:   xact,
		log:    log,
	}
}
func (t *TemplateService) GetTemplates(ctx context.Context, orgID int64) (map[string]string, error) {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := t.config.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return nil, err
	}

	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}

	if cfg.TemplateFiles == nil {
		return nil, fmt.Errorf("no templates present in current org")
	}

	return cfg.TemplateFiles, nil
}
