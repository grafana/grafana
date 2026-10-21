package rules

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Service is the rule storage boundary for callers and folder operations.
type Service struct {
	sql Store
}

var _ Store = (*Service)(nil)

func (s *Service) ListAlertRuleUIDsInFolder(ctx context.Context, orgID int64, folderUID string) ([]string, error) {
	return s.sql.ListAlertRuleUIDsInFolder(ctx, orgID, folderUID)
}

func (s *Service) GetFolderUIDsWithMissingFullpath(ctx context.Context, orgID int64) ([]string, error) {
	return s.sql.GetFolderUIDsWithMissingFullpath(ctx, orgID)
}

func (s *Service) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error) {
	return s.sql.GetUserVisibleNamespaces(ctx, orgID, user)
}

func (s *Service) GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	return s.sql.GetNamespaceByUID(ctx, uid, orgID, user)
}

func (s *Service) GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error) {
	return s.sql.GetNamespaceByTitle(ctx, title, orgID, user, parentUID)
}

func (s *Service) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error) {
	return s.sql.GetOrCreateNamespaceByTitle(ctx, title, orgID, user, parentUID)
}

func (s *Service) GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error) {
	return s.sql.GetNamespaceChildren(ctx, uid, orgID, user)
}

func (s *Service) GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error) {
	return s.sql.GetNamespacesByRuleUID(ctx, orgID, uids...)
}

func (s *Service) GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error) {
	return s.sql.GetAlertRuleByUID(ctx, query)
}

func (s *Service) GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) ([]*ngmodels.AlertRule, error) {
	return s.sql.GetAlertRulesGroupByRuleUID(ctx, query)
}

func (s *Service) ListDeletedRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRule, error) {
	return s.sql.ListDeletedRules(ctx, orgID)
}

func (s *Service) ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error) {
	return s.sql.ListAlertRules(ctx, query)
}

func (s *Service) ListAlertRulesPaginated(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error) {
	return s.sql.ListAlertRulesPaginated(ctx, query)
}

func (s *Service) GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error) {
	return s.sql.GetRuleGroupInterval(ctx, orgID, namespaceUID, ruleGroup)
}

func (s *Service) GetRuleByID(ctx context.Context, query ngmodels.GetAlertRuleByIDQuery) (*ngmodels.AlertRule, error) {
	return s.sql.GetRuleByID(ctx, query)
}

func (s *Service) ListAlertRulesByGroup(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error) {
	return s.sql.ListAlertRulesByGroup(ctx, query)
}

func (s *Service) Count(ctx context.Context, orgID int64) (int64, error) {
	return s.sql.Count(ctx, orgID)
}

func (s *Service) CountRuleGroups(ctx context.Context, orgID int64) (int64, error) {
	return s.sql.CountRuleGroups(ctx, orgID)
}

func (s *Service) InsertAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.InsertRule) ([]ngmodels.AlertRuleKeyWithId, error) {
	return s.sql.InsertAlertRules(ctx, user, rules)
}

func (s *Service) UpdateAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.UpdateRule) error {
	return s.sql.UpdateAlertRules(ctx, user, rules)
}

func (s *Service) DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *ngmodels.UserUID, permanently bool, ruleUID ...string) error {
	return s.sql.DeleteAlertRulesByUID(ctx, orgID, user, permanently, ruleUID...)
}

func (s *Service) DeleteRuleFromTrashByGUID(ctx context.Context, orgID int64, ruleGUID string) (int64, error) {
	return s.sql.DeleteRuleFromTrashByGUID(ctx, orgID, ruleGUID)
}

func (s *Service) UpdateFolderFullpathsForFolders(ctx context.Context, orgID int64, folderUIDs []string) error {
	return s.sql.UpdateFolderFullpathsForFolders(ctx, orgID, folderUIDs)
}

func (s *Service) GetAlertRuleVersions(ctx context.Context, orgID int64, guid string) ([]*ngmodels.AlertRuleVersion, error) {
	return s.sql.GetAlertRuleVersions(ctx, orgID, guid)
}

func (s *Service) GetAlertRuleVersionFolders(ctx context.Context, orgID int64, guid string) ([]string, error) {
	return s.sql.GetAlertRuleVersionFolders(ctx, orgID, guid)
}

func (s *Service) GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	return s.sql.GetAlertRulesKeysForScheduling(ctx)
}

func (s *Service) GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.GetAlertRulesForSchedulingQuery) error {
	return s.sql.GetAlertRulesForScheduling(ctx, query)
}

func (s *Service) RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error) {
	return s.sql.RenameReceiverInNotificationSettings(ctx, orgID, oldReceiver, newReceiver, validateProvenance, dryRun)
}

func (s *Service) RenameTimeIntervalInNotificationSettings(ctx context.Context, orgID int64, oldTimeInterval, newTimeInterval string, validateProvenance func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error) {
	return s.sql.RenameTimeIntervalInNotificationSettings(ctx, orgID, oldTimeInterval, newTimeInterval, validateProvenance, dryRun)
}

func (s *Service) ListContactPointRoutings(ctx context.Context, q ngmodels.ListContactPointRoutingsQuery) (map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting, error) {
	return s.sql.ListContactPointRoutings(ctx, q)
}

func (s *Service) SaveAlertRuleStatus(ctx context.Context, orgID int64, ruleUID string, data []byte) error {
	return s.sql.SaveAlertRuleStatus(ctx, orgID, ruleUID, data)
}

func (s *Service) Kind() string {
	return s.sql.Kind()
}

func (s *Service) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	return s.sql.DeleteInFolders(ctx, orgID, folderUIDs, user)
}

func (s *Service) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error) {
	return s.sql.CountInFolders(ctx, orgID, folderUIDs, user)
}

func (s *Service) GetAllFoldersWithRules(ctx context.Context, orgID int64) (map[string]struct{}, error) {
	return s.sql.GetAllFoldersWithRules(ctx, orgID)
}

func (s *Service) CleanUpDeletedAlertRules(ctx context.Context) (int64, error) {
	return s.sql.CleanUpDeletedAlertRules(ctx)
}
