package ngalert

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

// alertRuleStore is the subset of the rule store used by the consumer.
type alertRuleStore interface {
	ListAlertRules(ctx context.Context, q *models.ListAlertRulesQuery) (models.RulesGroup, error)
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *models.UserUID, permanently bool, ruleUID ...string) error
}

// AlertRuleFolderConsumer reports and deletes alert rules by folder for the folder reconciler.
type AlertRuleFolderConsumer struct {
	store alertRuleStore
}

func ProvideAlertRuleFolderConsumer(store *store.DBstore) *AlertRuleFolderConsumer {
	return &AlertRuleFolderConsumer{store: store}
}

func (c *AlertRuleFolderConsumer) Name() string { return "alert-rules" }

func (c *AlertRuleFolderConsumer) FoldersInUse(ctx context.Context, orgID int64) ([]string, error) {
	rules, err := c.store.ListAlertRules(ctx, &models.ListAlertRulesQuery{OrgID: orgID})
	if err != nil {
		return nil, err
	}
	seen := map[string]struct{}{}
	uids := make([]string, 0)
	for _, r := range rules {
		if _, ok := seen[r.NamespaceUID]; ok {
			continue
		}
		seen[r.NamespaceUID] = struct{}{}
		uids = append(uids, r.NamespaceUID)
	}
	return uids, nil
}

func (c *AlertRuleFolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	// Authenticate as the system so the delete is attributed to the reconciler, not a user.
	ctx, user := identity.WithServiceIdentity(ctx, orgID, identity.WithServiceIdentityName("folder-reconciler"))
	rules, err := c.store.ListAlertRules(ctx, &models.ListAlertRulesQuery{OrgID: orgID, NamespaceUIDs: []string{folderUID}})
	if err != nil {
		return err
	}
	uids := make([]string, 0, len(rules))
	for _, r := range rules {
		uids = append(uids, r.UID)
	}
	if len(uids) == 0 {
		return nil
	}
	return c.store.DeleteAlertRulesByUID(ctx, orgID, models.NewUserUID(user), false, uids...)
}
