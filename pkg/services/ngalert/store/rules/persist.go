package rules

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ProvenanceReader is the provenance lookup that rule renames need.
type ProvenanceReader interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]ngmodels.Provenance, error)
}

// RuleNamespaceLookup maps rule UIDs to the folder each rule lives in.
type RuleNamespaceLookup interface {
	GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error)
}

// NamespaceStore resolves the folders that alert rules live in.
type NamespaceStore interface {
	// TODO after deprecating namespace_id field in GettableGrafanaRule we can simplify this
	// interface by returning map[string]struct{} instead of map[string]*folder.FolderReference
	GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error)
	GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error)
	GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error)
	GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error)
	// GetNamespaceChildren returns all children (first level) of the namespace with the given id.
	GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error)
	RuleNamespaceLookup
}

// RuleLister lists alert rules.
type RuleLister interface {
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error)
}

// RuleGroupReader reads a page of rules grouped by rule group.
type RuleGroupReader interface {
	ListAlertRulesByGroup(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error)
}

// RuleByIDReader looks a rule up by its numeric ID.
type RuleByIDReader interface {
	GetRuleByID(ctx context.Context, query ngmodels.GetAlertRuleByIDQuery) (*ngmodels.AlertRule, error)
}

// RuleCounter counts rules for quota reporting.
type RuleCounter interface {
	Count(ctx context.Context, orgID int64) (int64, error)
}

// RuleReader reads rules and rule groups.
type RuleReader interface {
	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error)
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) ([]*ngmodels.AlertRule, error)
	ListDeletedRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRule, error)
	RuleLister
}

// RulePageReader is the paginated read surface.
type RulePageReader interface {
	ListAlertRulesPaginated(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error)
	GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error)
}

// RuleWriter creates, updates and deletes rules.
type RuleWriter interface {
	// InsertAlertRules will insert all alert rules passed into the function
	// and return the map of uuid to id.
	InsertAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.InsertRule) ([]ngmodels.AlertRuleKeyWithId, error)
	UpdateAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.UpdateRule) error
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *ngmodels.UserUID, permanently bool, ruleUID ...string) error
}

// RuleAdminWriter purges the trash and applies bulk fix-ups after a folder move or rename.
type RuleAdminWriter interface {
	DeleteRuleFromTrashByGUID(ctx context.Context, orgID int64, ruleGUID string) (int64, error)
	// UpdateFolderFullpathsForFolders updates the folder_fullpath column for all alert rules in the specified folders
	UpdateFolderFullpathsForFolders(ctx context.Context, orgID int64, folderUIDs []string) error
}

// RuleVersionReader queries the alert rule version history.
type RuleVersionReader interface {
	GetAlertRuleVersions(ctx context.Context, orgID int64, guid string) ([]*ngmodels.AlertRuleVersion, error)
}

// RuleVersionFolderReader lists the folders a rule has lived in.
type RuleVersionFolderReader interface {
	GetAlertRuleVersionFolders(ctx context.Context, orgID int64, guid string) ([]string, error)
}

// SchedulableRuleReader feeds the rule scheduler.
type SchedulableRuleReader interface {
	GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error)
	GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.GetAlertRulesForSchedulingQuery) error
}

// ContactPointRoutingReader reads the contact point each rule routes to.
type ContactPointRoutingReader interface {
	ListContactPointRoutings(ctx context.Context, q ngmodels.ListContactPointRoutingsQuery) (map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting, error)
}

// ReceiverRenamer repoints rules' notification settings at a renamed receiver.
type ReceiverRenamer interface {
	RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error)
}

// TimeIntervalRenamer repoints rules' notification settings at a renamed time interval.
type TimeIntervalRenamer interface {
	RenameTimeIntervalInNotificationSettings(ctx context.Context, orgID int64, oldTimeInterval, newTimeInterval string, validateProvenance func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error)
}

// StatusWriter persists the k8s status subresource of a rule.
type StatusWriter interface {
	SaveAlertRuleStatus(ctx context.Context, orgID int64, ruleUID string, data []byte) error
}

// FolderRuleCounter reports whether folders still hold rules.
type FolderRuleCounter interface {
	CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error)
	GetAllFoldersWithRules(ctx context.Context, orgID int64) (map[string]struct{}, error)
}

// MaintenanceStore cleans up soft-deleted rules.
type MaintenanceStore interface {
	CleanUpDeletedAlertRules(ctx context.Context) (int64, error)
}

// Store is the full surface implemented by *RuleStore.
type Store interface {
	NamespaceStore
	RuleReader
	RulePageReader
	RuleByIDReader
	RuleGroupReader
	RuleCounter
	RuleWriter
	RuleAdminWriter
	RuleVersionReader
	RuleVersionFolderReader
	SchedulableRuleReader
	ReceiverRenamer
	TimeIntervalRenamer
	ContactPointRoutingReader
	StatusWriter
	folder.RegistryService
	FolderRuleCounter
	MaintenanceStore
}

var (
	_ Store = (*RuleStore)(nil)
	// Value receiver too: ProvideRuleStore registers a RuleStore value with the folder service.
	_ Store                  = RuleStore{}
	_ folder.RegistryService = RuleStore{}
)
