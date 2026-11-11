package legacy

import (
	"context"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
)

// fakeListAuthz embeds the authorization interface so only the methods used by
// ListAlertRules need to be implemented.
type fakeListAuthz struct {
	ruleAccessControlService
	CanReadAllRulesFunc   func(ctx context.Context, user identity.Requester) (bool, error)
	HasAccessInFolderFunc func(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error)
}

func (f *fakeListAuthz) CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	return f.CanReadAllRulesFunc(ctx, user)
}

func (f *fakeListAuthz) HasAccessInFolder(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error) {
	return f.HasAccessInFolderFunc(ctx, user, folder)
}

func TestListAlertRules(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey1 := models.GenerateGroupKey(orgID)
	groupKey2 := models.GenerateGroupKey(orgID)
	gen := models.RuleGen
	rules1 := gen.With(gen.WithGroupKey(groupKey1), gen.WithUniqueGroupIndex()).GenerateManyRef(3)
	models.RulesGroup(rules1).SortByGroupIndex()
	rules2 := gen.With(gen.WithGroupKey(groupKey2), gen.WithUniqueGroupIndex()).GenerateManyRef(4)
	models.RulesGroup(rules2).SortByGroupIndex()
	allRules := append(rules1, rules2...)

	fs := foldertest.NewFakeService()
	fs.AddFolder(&folder.Folder{OrgID: orgID, UID: groupKey1.NamespaceUID, Title: "folder1"})
	fs.AddFolder(&folder.Folder{OrgID: orgID, UID: groupKey2.NamespaceUID, Title: "folder2"})

	initServiceWithData := func(t *testing.T) (*LegacyRuleService, *fakes.RuleStore, *fakeListAuthz) {
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{orgID: allRules}
		ac := &fakeListAuthz{
			HasAccessInFolderFunc: func(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error) {
				return true, nil
			},
		}
		service := &LegacyRuleService{
			folderService:   fs,
			ruleStore:       ruleStore,
			provenanceStore: fakes.NewFakeProvisioningStore(),
			log:             log.New("testing"),
			authz:           ac,
		}
		return service, ruleStore, ac
	}

	t.Run("when user can read all rules", func(t *testing.T) {
		t.Run("should return all rules", func(t *testing.T) {
			service, _, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return true, nil
			}

			rules, _, token, err := service.ListAlertRules(context.Background(), u, ListAlertRulesOptions{})
			require.NoError(t, err)
			require.Len(t, rules, len(allRules))
			require.Empty(t, token)
		})
	})

	t.Run("when user cannot read all rules", func(t *testing.T) {
		t.Run("should return only rules in accessible folders", func(t *testing.T) {
			service, _, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}
			ac.HasAccessInFolderFunc = func(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error) {
				return folder.GetNamespaceUID() == groupKey2.NamespaceUID, nil
			}

			rules, _, token, err := service.ListAlertRules(context.Background(), u, ListAlertRulesOptions{})
			require.NoError(t, err)
			require.Len(t, rules, len(rules2))
			for _, r := range rules {
				require.Equal(t, groupKey2.NamespaceUID, r.NamespaceUID)
			}
			require.Empty(t, token)
		})

		t.Run("should return no rules when no folders are accessible", func(t *testing.T) {
			service, ruleStore, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}
			ac.HasAccessInFolderFunc = func(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error) {
				return false, nil
			}

			rules, _, token, err := service.ListAlertRules(context.Background(), u, ListAlertRulesOptions{})
			require.NoError(t, err)
			require.Empty(t, rules)
			require.Empty(t, token)
			require.Empty(t, ruleStore.RecordedOps)
		})

		t.Run("Include when user cannot read requested folder should return no rules", func(t *testing.T) {
			service, ruleStore, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}
			ac.HasAccessInFolderFunc = func(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error) {
				return folder.GetNamespaceUID() == groupKey2.NamespaceUID, nil
			}

			rules, _, token, err := service.ListAlertRules(context.Background(), u, ListAlertRulesOptions{
				FolderFilter: ListRuleStringFilter{Include: []string{"inaccessible-folder"}},
			})
			require.NoError(t, err)
			require.Empty(t, rules)
			require.Empty(t, token)
			require.Empty(t, ruleStore.RecordedOps)
		})
	})
}
