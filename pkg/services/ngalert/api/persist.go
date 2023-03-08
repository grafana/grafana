package api

import (
	"context"

	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// RuleStore is the interface for persisting alert rules and instances
type RuleStore interface {
	GetUserVisibleNamespaces(context.Context, int64, *user.SignedInUser) (map[string]*folder.Folder, error)
	GetNamespaceByTitle(context.Context, string, int64, *user.SignedInUser, bool) (*folder.Folder, error)
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) error
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error

	// InsertAlertRules will insert all alert rules passed into the function
	// and return the map of uuid to id.
	InsertAlertRules(ctx context.Context, rule []ngmodels.AlertRule) (map[string]int64, error)
	UpdateAlertRules(ctx context.Context, rule []ngmodels.UpdateRule) error
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error

	// IncreaseVersionForAllRulesInNamespace Increases version for all rules that have specified namespace. Returns all rules that belong to the namespace
	IncreaseVersionForAllRulesInNamespace(ctx context.Context, orgID int64, namespaceUID string) ([]ngmodels.AlertRuleKeyWithVersionAndPauseStatus, error)

	Count(ctx context.Context, orgID int64) (int64, error)
}
