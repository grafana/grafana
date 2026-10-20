package ngalert

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

// alertRuleStore is the subset of the rule store used by the consumer. GetAllFoldersWithRules and
// ListAlertRuleUIDsInFolder are used instead of ListAlertRules so that these scans are routed
// through LegacyDatabaseProvider when configured.
type alertRuleStore interface {
	GetAllFoldersWithRules(ctx context.Context, orgID int64) (map[string]struct{}, error)
	ListAlertRuleUIDsInFolder(ctx context.Context, orgID int64, folderUID string) ([]string, error)
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *models.UserUID, permanently bool, ruleUID ...string) error
}

// AlertRuleFolderConsumer reports and deletes alert rules by folder for the folder reconciler.
type AlertRuleFolderConsumer struct {
	store alertRuleStore
}

func ProvideAlertRuleFolderConsumer(store *rulestore.RuleStore) *AlertRuleFolderConsumer {
	return &AlertRuleFolderConsumer{store: store}
}

func (c *AlertRuleFolderConsumer) Name() string { return "alert-rules" }

func (c *AlertRuleFolderConsumer) FoldersInUse(ctx context.Context, orgID int64) ([]string, error) {
	withRules, err := c.store.GetAllFoldersWithRules(ctx, orgID)
	if err != nil {
		return nil, err
	}
	uids := make([]string, 0, len(withRules))
	for uid := range withRules {
		uids = append(uids, uid)
	}
	return uids, nil
}

func (c *AlertRuleFolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	// Authenticate as the system so the delete is attributed to the reconciler, not a user.
	ctx, user := identity.WithServiceIdentity(ctx, orgID, identity.WithServiceIdentityName("folder-reconciler"))
	uids, err := c.store.ListAlertRuleUIDsInFolder(ctx, orgID, folderUID)
	if err != nil {
		return err
	}
	if len(uids) == 0 {
		return nil
	}
	return c.store.DeleteAlertRulesByUID(ctx, orgID, models.NewUserUID(user), false, uids...)
}
