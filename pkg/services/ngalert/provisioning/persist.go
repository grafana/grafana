package provisioning

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
)

// AMStore is a store of Alertmanager configurations.
//
//go:generate mockery --name AMConfigStore --structname MockAMConfigStore --inpackage --filename persist_mock.go --with-expecter
type AMConfigStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

// ProvisioningStore is a store of provisioning data for arbitrary objects.
//
//go:generate mockery --name ProvisioningStore --structname MockProvisioningStore --inpackage --filename provisioning_store_mock.go --with-expecter
type ProvisioningStore interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

// TransactionManager represents the ability to issue and close transactions through contexts.
type TransactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

// RuleStore represents the ability to persist and query alert rules.
type RuleStore interface {
	GetAlertRuleByUID(ctx context.Context, query *models.GetAlertRuleByUIDQuery) error
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) error
	GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error)
	InsertAlertRules(ctx context.Context, rule []models.AlertRule) (map[string]int64, error)
	UpdateAlertRules(ctx context.Context, rule []store.UpdateRule) error
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *models.GetAlertRulesGroupByRuleUIDQuery) error
}

// QuotaChecker represents the ability to evaluate whether quotas are met.
//
//go:generate mockery --name QuotaChecker --structname MockQuotaChecker --inpackage --filename quota_checker_mock.go --with-expecter
type QuotaChecker interface {
	CheckQuotaReached(ctx context.Context, target string, scopeParams *quota.ScopeParameters) (bool, error)
}

// PersistConfig validates to config before eventually persisting it if no error occurs
func PersistConfig(ctx context.Context, store AMConfigStore, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	cfg := &definitions.PostableUserConfig{}
	if err := json.Unmarshal([]byte(cmd.AlertmanagerConfiguration), cfg); err != nil {
		return fmt.Errorf("change would result in an invalid configuration state: %w", err)
	}
	return store.UpdateAlertmanagerConfiguration(ctx, cmd)
}
