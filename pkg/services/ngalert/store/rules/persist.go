package rules

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// The interfaces below are copies of the consumer-side declarations that *store.DBstore used to
// satisfy implicitly, before the rule store was extracted into this package. Each segment records
// where the original lives so the two can be kept in sync. The consumers keep owning their own
// interfaces — Store exists so that dropping a method fails here at compile time rather than at
// some distant call site, and so that enterprise and the ruler have a single name to depend on.

// ProvenanceReader is the slice of the provenance store that rule writes need in order to honour
// provisioning ownership when renaming receivers and time intervals.
//
// Source: pkg/services/ngalert/store/provenance/persist.go (ProvenanceReader)
type ProvenanceReader interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]ngmodels.Provenance, error)
}

// NamespaceStore resolves the folders that alert rules live in.
//
// Source: pkg/services/ngalert/api/persist.go (RuleStore)
// Source: pkg/services/ngalert/rulesync/syncer.go (namespaceStore)
// Source: pkg/services/ngalert/state/historian/annotation.go (RuleStore)
// Source: pkg/services/ngalert/api/prometheus/api_prometheus.go (RuleStoreReader)
// Source: pkg/services/ngalert/accesscontrol/silences.go (RuleUIDToNamespaceStore)
type NamespaceStore interface {
	// TODO after deprecating namespace_id field in GettableGrafanaRule we can simplify this
	// interface by returning map[string]struct{} instead of map[string]*folder.FolderReference
	GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error)
	GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error)
	GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error)
	GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error)
	// GetNamespaceChildren returns all children (first level) of the namespace with the given id.
	GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error)
	GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error)
}

// RuleQuerier queries alert rules. Named to avoid colliding with RuleReader in deltas.go, which is
// the narrower dependency of CalculateChanges.
//
// Source: pkg/services/ngalert/api/persist.go (RuleStore)
// Source: pkg/services/ngalert/provisioning/persist.go (RuleStore)
// Source: pkg/services/ngalert/notifier/silence_svc.go (RuleStore)
// Source: pkg/services/annotations/annotationsimpl/loki/historian_store.go (RuleStore)
// Source: pkg/services/ngalert/api/prometheus/api_prometheus.go (ListAlertRulesStore, ListAlertRulesStoreV2)
// Source: pkg/services/ngalert/limits.go (RuleUsageReader)
type RuleQuerier interface {
	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error)
	GetRuleByID(ctx context.Context, query ngmodels.GetAlertRuleByIDQuery) (*ngmodels.AlertRule, error)
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) ([]*ngmodels.AlertRule, error)
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error)
	ListAlertRulesByGroup(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error)
	ListAlertRulesPaginated(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error)
	ListDeletedRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRule, error)
	GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error)
	Count(ctx context.Context, orgID int64) (int64, error)
}

// RuleWriter persists alert rules.
//
// Source: pkg/services/ngalert/api/persist.go (RuleStore)
// Source: pkg/services/ngalert/provisioning/persist.go (RuleStore)
// Source: pkg/services/ngalert/folder_consumer.go (alertRuleStore)
type RuleWriter interface {
	// InsertAlertRules will insert all alert rules passed into the function
	// and return the map of uuid to id.
	InsertAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.InsertRule) ([]ngmodels.AlertRuleKeyWithId, error)
	UpdateAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.UpdateRule) error
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *ngmodels.UserUID, permanently bool, ruleUID ...string) error
	DeleteRuleFromTrashByGUID(ctx context.Context, orgID int64, ruleGUID string) (int64, error)
	// IncreaseVersionForAllRulesInNamespaces Increases version for all rules that have specified namespace uids
	IncreaseVersionForAllRulesInNamespaces(ctx context.Context, orgID int64, namespaceUIDs []string) ([]ngmodels.AlertRuleKeyWithVersion, error)
	// UpdateFolderFullpathsForFolders updates the folder_fullpath column for all alert rules in the specified folders
	UpdateFolderFullpathsForFolders(ctx context.Context, orgID int64, folderUIDs []string) error
}

// RuleVersionReader queries the alert rule version history.
//
// Source: pkg/services/ngalert/api/persist.go (RuleStore)
// Source: pkg/services/ngalert/provisioning/persist.go (RuleStore)
// Source: pkg/services/ngalert/state/historian/annotation.go (RuleStore)
type RuleVersionReader interface {
	GetAlertRuleVersions(ctx context.Context, orgID int64, guid string) ([]*ngmodels.AlertRuleVersion, error)
	GetAlertRuleVersionFolders(ctx context.Context, orgID int64, guid string) ([]string, error)
}

// SchedulableRuleReader feeds the rule scheduler.
//
// Source: pkg/services/ngalert/schedule/schedule.go (RulesStore)
type SchedulableRuleReader interface {
	GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error)
	GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.GetAlertRulesForSchedulingQuery) error
}

// NotificationSettingsStore maintains the notification settings embedded in alert rules when the
// receivers and time intervals they reference are renamed.
//
// Source: pkg/services/ngalert/provisioning/contactpoints.go (AlertRuleNotificationSettingsStore)
// Source: pkg/services/ngalert/notifier/receiver_svc.go (alertRuleNotificationSettingsStore)
// Source: pkg/services/ngalert/notifier/autogen_alertmanager.go (autogenRuleStore)
type NotificationSettingsStore interface {
	RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error)
	RenameTimeIntervalInNotificationSettings(ctx context.Context, orgID int64, oldTimeInterval, newTimeInterval string, validateProvenance func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error)
	ListContactPointRoutings(ctx context.Context, q ngmodels.ListContactPointRoutingsQuery) (map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting, error)
}

// StatusWriter persists the k8s status subresource of a rule.
//
// Source: pkg/services/ngalert/api/persist.go (RuleStore)
// Source: pkg/registry/apps/alerting/rules/alertrule/status.go (statusWriter)
// Source: pkg/registry/apps/alerting/rules/recordingrule/status.go (statusWriter)
type StatusWriter interface {
	SaveAlertRuleStatus(ctx context.Context, orgID int64, ruleUID string, data []byte) error
}

// FolderRegistryStore lets the folder service account for and clean up alert rules in folders.
//
// Source: pkg/services/folder/registry.go (folder.RegistryService)
// Source: pkg/services/ngalert/store/folderlabelsyncer/service.go (syncerStore)
type FolderRegistryStore interface {
	DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error
	CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error)
	Kind() string
	GetAllFoldersWithRules(ctx context.Context, orgID int64) (map[string]struct{}, error)
}

// MaintenanceStore covers background cleanup of soft-deleted rules.
//
// Source: no consumer-side interface; called from pkg/services/cleanup/cleanup.go via
// cleanup.AlertRuleService.
type MaintenanceStore interface {
	CleanUpDeletedAlertRules(ctx context.Context) (int64, error)
}

// Store is the full surface implemented by *RuleStore.
type Store interface {
	NamespaceStore
	RuleQuerier
	RuleWriter
	RuleVersionReader
	SchedulableRuleReader
	NotificationSettingsStore
	StatusWriter
	FolderRegistryStore
	MaintenanceStore
}

var (
	_ Store = (*RuleStore)(nil)
	// Value receiver too: ProvideRuleStore registers a RuleStore value with the folder service.
	_ Store                  = RuleStore{}
	_ folder.RegistryService = RuleStore{}
)
