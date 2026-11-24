package legacy

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Searcher lists rules at the models level, for the legacy search backend, which builds its index columns from
// models.AlertRule.
type Searcher interface {
	ListAlertRules(ctx context.Context, user identity.Requester, opts ListAlertRulesOptions) ([]*models.AlertRule, map[string]utils.ManagerProperties, string, error)
}

// Service is the only way into the legacy rule service from outside this package. It hands out the k8s-typed
// services for each rule kind and a models-level searcher, all backed by the same legacy rule service.
type Service struct {
	alertRules     *AlertRules
	recordingRules *RecordingRules
	searcher       Searcher
}

func New(ruleStore RuleStore,
	provenanceStore ProvenanceStore,
	folderService folder.Service,
	quotas QuotaChecker,
	xact TransactionManager,
	defaultIntervalSeconds int64,
	log log.Logger,
	ns NotificationSettingsValidatorProvider,
	authz RuleAccessControlService,
	ruleValidator RuleMutationValidator,
	namespacer request.NamespaceMapper,
) *Service {
	svc := newLegacyRuleService(ruleStore, provenanceStore, folderService, quotas, xact, defaultIntervalSeconds, log, ns, authz, ruleValidator)
	return &Service{
		alertRules:     newAlertRules(svc, namespacer),
		recordingRules: newRecordingRules(svc, namespacer),
		searcher:       svc,
	}
}

func (s *Service) AlertRules() *AlertRules { return s.alertRules }

func (s *Service) RecordingRules() *RecordingRules { return s.recordingRules }

func (s *Service) Searcher() Searcher { return s.searcher }
