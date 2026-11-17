package cascadedelete

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

// RuleUIDLister lists the alert rules in a folder; satisfied by *rules.RuleStore.
type RuleUIDLister interface {
	ListAlertRuleUIDsInFolder(ctx context.Context, orgID int64, folderUID string) ([]string, error)
}

// FolderContentsDeleter deletes everything a folder holds in one call; satisfied by *cleaner.ContentsCleaner.
type FolderContentsDeleter interface {
	DeleteInFolder(ctx context.Context, namespace, folderUID string, user identity.Requester) error
}

// NewAlertRuleHandler deletes a folder's alert rules through contents, as one child named after the
// folder while any rule is left, so alert deletion behaves as it does outside the cascade.
func NewAlertRuleHandler(rules RuleUIDLister, contents FolderContentsDeleter) KindHandler {
	h := alertRules{rules, contents}
	return KindHandler{Kind: ChildAlertRule, Lister: h, Deleter: h}
}

type alertRules struct {
	rules    RuleUIDLister
	contents FolderContentsDeleter
}

func (h alertRules) ListChildren(ctx context.Context, namespace, folderUID string, _ ChildKind, _, _ int64) ([]Child, int64, error) {
	ctx, _, orgID, err := tenantContext(ctx, namespace)
	if err != nil {
		return nil, 0, err
	}
	uids, err := h.rules.ListAlertRuleUIDsInFolder(ctx, orgID, folderUID)
	if err != nil || len(uids) == 0 {
		return nil, 0, err
	}
	return []Child{{Kind: ChildAlertRule, Name: folderUID}}, 1, nil
}

// Delete does not check alert.rules:delete; that authorization is added in a follow-up PR.
func (h alertRules) Delete(ctx context.Context, namespace, parentUID string, _ Child) (DeleteOutcome, error) {
	ctx, user, orgID, err := tenantContext(ctx, namespace)
	if err != nil {
		return DeleteOutcomeDeleted, err
	}
	ctx = folder.WithUncheckedDeleteAuthorized(ctx, orgID, user, []string{parentUID}, true)
	return DeleteOutcomeDeleted, h.contents.DeleteInFolder(ctx, namespace, parentUID, user)
}

// tenantContext targets the stack's database and acts as the service identity of its org.
func tenantContext(ctx context.Context, namespace string) (context.Context, identity.Requester, int64, error) {
	ns, err := claims.ParseNamespace(namespace)
	if err != nil {
		return ctx, nil, 0, err
	}
	ctx, user := identity.WithServiceIdentity(request.WithNamespace(ctx, namespace), ns.OrgID)
	return ctx, user, ns.OrgID, nil
}
