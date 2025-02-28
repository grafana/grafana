package api

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// RuleStore is the interface for persisting alert rules and instances
type RuleStore interface {
	// TODO after deprecating namespace_id field in GettableGrafanaRule we can simplify this interface
	// by returning map[string]struct{} instead of map[string]*folder.Folder
	GetUserVisibleNamespaces(context.Context, int64, identity.Requester) (map[string]*folder.Folder, error)
	GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error)
	GetNamespaceInRootByTitle(ctx context.Context, fullpath string, orgID int64, user identity.Requester) (*folder.Folder, error)
	GetOrCreateNamespaceInRootByTitle(ctx context.Context, title string, orgID int64, user identity.Requester) (*folder.Folder, error)

	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error)
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) ([]*ngmodels.AlertRule, error)
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error)

	// InsertAlertRules will insert all alert rules passed into the function
	// and return the map of uuid to id.
	InsertAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.AlertRule) ([]ngmodels.AlertRuleKeyWithId, error)
	UpdateAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.UpdateRule) error
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error

	// IncreaseVersionForAllRulesInNamespaces Increases version for all rules that have specified namespace uids
	IncreaseVersionForAllRulesInNamespaces(ctx context.Context, orgID int64, namespaceUIDs []string) ([]ngmodels.AlertRuleKeyWithVersion, error)
	GetAlertRuleVersions(ctx context.Context, orgID int64, guid string) ([]*ngmodels.AlertRule, error)
	accesscontrol.RuleUIDToNamespaceStore
}
