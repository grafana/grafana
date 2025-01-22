package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/quota"
)

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error)
	Save(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64) error
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
	GetAlertRuleByUID(ctx context.Context, query *models.GetAlertRuleByUIDQuery) (*models.AlertRule, error)
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) (models.RulesGroup, error)
	GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error)
	InsertAlertRules(ctx context.Context, user *models.UserUID, rule []models.AlertRule) ([]models.AlertRuleKeyWithId, error)
	UpdateAlertRules(ctx context.Context, user *models.UserUID, rule []models.UpdateRule) error
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *models.GetAlertRulesGroupByRuleUIDQuery) ([]*models.AlertRule, error)
}

// QuotaChecker represents the ability to evaluate whether quotas are met.
//
//go:generate mockery --name QuotaChecker --structname MockQuotaChecker --inpackage --filename quota_checker_mock.go --with-expecter
type QuotaChecker interface {
	CheckQuotaReached(ctx context.Context, target quota.TargetSrv, scopeParams *quota.ScopeParameters) (bool, error)
}
