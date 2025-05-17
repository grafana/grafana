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
	// by returning map[string]struct{} instead of map[string]*folder.FolderReference
	GetUserVisibleNamespaces(context.Context, int64, identity.Requester) (map[string]*folder.Folder, error)
	GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error)
	GetNamespaceByTitle(ctx context.Context, fullpath string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error)
	GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error)
	// GetNamespaceChildren returns all children (first level) of the namespace with the given id.
	GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error)

	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error)
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) ([]*ngmodels.AlertRule, error)
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error)
	ListDeletedRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRule, error)

	// InsertAlertRules will insert all alert rules passed into the function
	// and return the map of uuid to id.
	InsertAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.AlertRule) ([]ngmodels.AlertRuleKeyWithId, error)
	UpdateAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.UpdateRule) error
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *ngmodels.UserUID, permanently bool, ruleUID ...string) error
	DeleteRuleFromTrashByGUID(ctx context.Context, orgID int64, ruleGUID string) (int64, error)

	// IncreaseVersionForAllRulesInNamespaces Increases version for all rules that have specified namespace uids
	IncreaseVersionForAllRulesInNamespaces(ctx context.Context, orgID int64, namespaceUIDs []string) ([]ngmodels.AlertRuleKeyWithVersion, error)
	GetAlertRuleVersions(ctx context.Context, orgID int64, guid string) ([]*ngmodels.AlertRule, error)
	accesscontrol.RuleUIDToNamespaceStore
}
