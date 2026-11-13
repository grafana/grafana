package legacy

import (
	"context"
	"errors"
	"math/rand"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
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

// fakeDeleteAuthz embeds the authorization interface so only the methods used by deletes need to be implemented.
type fakeDeleteAuthz struct {
	ruleAccessControlService
	canWriteAll   bool
	authorizeFunc func(delta *rulestore.GroupDelta) error
}

func (f *fakeDeleteAuthz) CanWriteAllRules(context.Context, identity.Requester) (bool, error) {
	return f.canWriteAll, nil
}

func (f *fakeDeleteAuthz) AuthorizeRuleGroupWrite(_ context.Context, _ identity.Requester, delta *rulestore.GroupDelta) error {
	if f.authorizeFunc == nil {
		return nil
	}
	return f.authorizeFunc(delta)
}

type countingTransactionManager struct {
	calls int
}

func (c *countingTransactionManager) InTransaction(ctx context.Context, work func(context.Context) error) error {
	c.calls++
	return work(ctx)
}

func TestDeleteAlertRules(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey := models.GenerateGroupKey(orgID)
	gen := models.RuleGen

	type env struct {
		service    *LegacyRuleService
		ruleStore  *fakes.RuleStore
		provenance *fakes.FakeProvisioningStore
		authz      *fakeDeleteAuthz
		xact       *countingTransactionManager
		rules      []*models.AlertRule
	}
	setup := func(t *testing.T) *env {
		t.Helper()
		e := &env{
			ruleStore:  fakes.NewRuleStore(t),
			provenance: fakes.NewFakeProvisioningStore(),
			authz:      &fakeDeleteAuthz{canWriteAll: true},
			xact:       &countingTransactionManager{},
			rules:      gen.With(gen.WithGroupKey(groupKey), gen.WithUniqueGroupIndex()).GenerateManyRef(3),
		}
		e.ruleStore.Rules = map[int64][]*models.AlertRule{orgID: slices.Clone(e.rules)}
		e.service = &LegacyRuleService{
			ruleStore:       e.ruleStore,
			provenanceStore: e.provenance,
			log:             log.New("testing"),
			authz:           e.authz,
			xact:            e.xact,
		}
		return e
	}
	deletedProvenances := func(e *env) int {
		n := 0
		for _, c := range e.provenance.Calls {
			if c.MethodName == "DeleteProvenance" {
				n++
			}
		}
		return n
	}

	t.Run("deletes all rules and their provenance in a single transaction", func(t *testing.T) {
		e := setup(t)

		require.NoError(t, e.service.DeleteAlertRules(context.Background(), u, e.rules, nil))

		require.Empty(t, e.ruleStore.Rules[orgID])
		require.Equal(t, 1, e.xact.calls)
		require.Equal(t, len(e.rules), deletedProvenances(e))
	})

	t.Run("is a no-op for an empty set", func(t *testing.T) {
		e := setup(t)

		require.NoError(t, e.service.DeleteAlertRules(context.Background(), u, nil, nil))

		require.Len(t, e.ruleStore.Rules[orgID], len(e.rules))
		require.Zero(t, e.xact.calls)
	})

	t.Run("deletes nothing when the manager of one rule does not match", func(t *testing.T) {
		e := setup(t)
		e.provenance.GetManagerPropertiesFunc = func(_ context.Context, o models.Provisionable, _ int64) (utils.ManagerProperties, error) {
			if o.ResourceID() == e.rules[1].UID {
				// Repo-managed rules are backed by an external source of truth and cannot be reset to unmanaged.
				return utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "repo"}, nil
			}
			return utils.ManagerProperties{}, nil
		}

		err := e.service.DeleteAlertRules(context.Background(), u, e.rules, nil)

		var utilErr errutil.Error
		require.ErrorAs(t, err, &utilErr)
		require.Equal(t, "alerting.provenanceMismatch", utilErr.MessageID)
		require.Len(t, e.ruleStore.Rules[orgID], len(e.rules))
		require.Zero(t, e.xact.calls)
	})

	t.Run("when the user cannot write all rules", func(t *testing.T) {
		t.Run("deletes nothing when one rule is not authorized", func(t *testing.T) {
			e := setup(t)
			e.authz.canWriteAll = false
			forbidden := errors.New("forbidden")
			e.authz.authorizeFunc = func(delta *rulestore.GroupDelta) error {
				if delta.Delete[0].UID == e.rules[2].UID {
					return forbidden
				}
				return nil
			}

			err := e.service.DeleteAlertRules(context.Background(), u, e.rules, nil)

			require.ErrorIs(t, err, forbidden)
			require.Len(t, e.ruleStore.Rules[orgID], len(e.rules))
			require.Zero(t, e.xact.calls)
		})

		t.Run("skips rules that no longer exist", func(t *testing.T) {
			e := setup(t)
			e.authz.canWriteAll = false
			gone := e.rules[0]
			e.ruleStore.Rules[orgID] = e.rules[1:]

			require.NoError(t, e.service.DeleteAlertRules(context.Background(), u, e.rules, nil))

			require.Empty(t, e.ruleStore.Rules[orgID])
			require.Equal(t, 1, e.xact.calls)
			require.Equal(t, len(e.rules)-1, deletedProvenances(e))
			for _, c := range e.provenance.Calls {
				if c.MethodName == "DeleteProvenance" {
					require.NotEqual(t, gone.UID, c.Arguments[1].(models.Provisionable).ResourceID())
				}
			}
		})
	})
}

func TestDeleteAlertRule_SingleTransaction(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	gen := models.RuleGen
	rule := gen.With(gen.WithGroupKey(models.GenerateGroupKey(orgID))).GenerateRef()

	ruleStore := fakes.NewRuleStore(t)
	ruleStore.Rules = map[int64][]*models.AlertRule{orgID: {rule}}
	xact := &countingTransactionManager{}
	service := &LegacyRuleService{
		ruleStore:       ruleStore,
		provenanceStore: fakes.NewFakeProvisioningStore(),
		log:             log.New("testing"),
		authz:           &fakeDeleteAuthz{canWriteAll: true},
		xact:            xact,
	}

	require.NoError(t, service.DeleteAlertRule(context.Background(), u, rule.UID, utils.ManagerProperties{}))

	require.Empty(t, ruleStore.Rules[orgID])
	require.Equal(t, 1, xact.calls)
}
