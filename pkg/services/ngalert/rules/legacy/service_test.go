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
	ngrulesvc "github.com/grafana/grafana/pkg/services/ngalert/rules"
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

type fakeUpdateAuthz struct {
	ruleAccessControlService
}

func (fakeUpdateAuthz) CanWriteAllRules(context.Context, identity.Requester) (bool, error) {
	return true, nil
}

type transactionManagerFunc func(context.Context, func(context.Context) error) error

func (f transactionManagerFunc) InTransaction(ctx context.Context, work func(context.Context) error) error {
	return f(ctx, work)
}

func TestUpdateAlertRulePersistencePreconditions(t *testing.T) {
	const baselineVersion = int64(7)
	stored := models.RuleGen.GenerateRef()
	stored.Version = baselineVersion
	stored.NotificationSettings = nil
	updated := stored.Copy()
	updated.Title += " updated"
	requester := &user.SignedInUser{OrgID: stored.OrgID}

	t.Run("transaction retry preserves the original baseline", func(t *testing.T) {
		stored := stored.Copy()
		store := fakes.NewRuleStore(t)
		store.Rules[stored.OrgID] = []*models.AlertRule{stored}
		retry := errors.New("retry transaction")
		var persisted *models.AlertRule
		store.Hook = func(cmd any) error {
			updates, ok := cmd.([]models.UpdateRule)
			if !ok {
				return nil
			}
			if updates[0].Existing.Version != baselineVersion {
				return rulestore.ErrOptimisticLock
			}
			if persisted == nil {
				persisted = stored.Copy()
				updates[0].Existing.Version++
				updates[0].Existing.Title = "temporary title"
				return retry
			}
			persisted = updates[0].New.Copy()
			return nil
		}
		xact := transactionManagerFunc(func(ctx context.Context, work func(context.Context) error) error {
			if err := work(ctx); !errors.Is(err, retry) {
				return err
			}
			return work(ctx)
		})
		service := &legacyRuleService{
			ruleStore: store, provenanceStore: fakes.NewFakeProvisioningStore(),
			xact: xact, authz: fakeUpdateAuthz{},
		}
		_, err := service.UpdateAlertRule(context.Background(), requester, *updated, utils.ManagerProperties{}, false)
		require.NoError(t, err)
		require.Equal(t, updated.Title, persisted.Title)
		require.Equal(t, baselineVersion, stored.Version)
	})

	t.Run("optimistic lock failure after the read is preserved", func(t *testing.T) {
		stored := stored.Copy()
		store := fakes.NewRuleStore(t)
		store.Rules[stored.OrgID] = []*models.AlertRule{stored}
		store.Hook = func(cmd any) error {
			if _, ok := cmd.([]models.UpdateRule); ok {
				return rulestore.ErrOptimisticLock
			}
			return nil
		}
		provenance := fakes.NewFakeProvisioningStore()
		provenance.SetManagerPropertiesFunc = func(context.Context, models.Provisionable, int64, utils.ManagerProperties) error {
			t.Fatal("failed rule persistence must not change manager properties")
			return nil
		}
		service := &legacyRuleService{ruleStore: store, provenanceStore: provenance, xact: store, authz: fakeUpdateAuthz{}}
		_, err := service.UpdateAlertRule(context.Background(), requester, *updated, utils.ManagerProperties{}, false)
		require.ErrorIs(t, err, rulestore.ErrOptimisticLock)
	})
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

	initServiceWithData := func(t *testing.T) (*legacyRuleService, *fakes.RuleStore, *fakeListAuthz) {
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{orgID: allRules}
		ac := &fakeListAuthz{
			HasAccessInFolderFunc: func(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error) {
				return true, nil
			},
		}
		service := &legacyRuleService{
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
	authorizeFunc func(delta *ngrulesvc.GroupDelta) error
}

func (f *fakeDeleteAuthz) CanWriteAllRules(context.Context, identity.Requester) (bool, error) {
	return f.canWriteAll, nil
}

func (f *fakeDeleteAuthz) AuthorizeRuleGroupWrite(_ context.Context, _ identity.Requester, delta *ngrulesvc.GroupDelta) error {
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
		service    *legacyRuleService
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
		e.service = &legacyRuleService{
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

		require.NoError(t, e.service.DeleteAlertRules(context.Background(), u, e.rules, nil, false))

		require.Empty(t, e.ruleStore.Rules[orgID])
		require.Equal(t, 1, e.xact.calls)
		require.Equal(t, len(e.rules), deletedProvenances(e))
	})

	t.Run("dry-run checks every rule but deletes nothing", func(t *testing.T) {
		e := setup(t)

		require.NoError(t, e.service.DeleteAlertRules(context.Background(), u, e.rules, nil, true))

		require.Len(t, e.ruleStore.Rules[orgID], len(e.rules))
		require.Zero(t, e.xact.calls)
		require.Zero(t, deletedProvenances(e))

		e.authz.canWriteAll = false
		forbidden := errors.New("forbidden")
		e.authz.authorizeFunc = func(*ngrulesvc.GroupDelta) error { return forbidden }
		require.ErrorIs(t, e.service.DeleteAlertRules(context.Background(), u, e.rules, nil, true), forbidden)
	})

	t.Run("is a no-op for an empty set", func(t *testing.T) {
		e := setup(t)

		require.NoError(t, e.service.DeleteAlertRules(context.Background(), u, nil, nil, false))

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

		err := e.service.DeleteAlertRules(context.Background(), u, e.rules, nil, false)

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
			e.authz.authorizeFunc = func(delta *ngrulesvc.GroupDelta) error {
				if delta.Delete[0].UID == e.rules[2].UID {
					return forbidden
				}
				return nil
			}

			err := e.service.DeleteAlertRules(context.Background(), u, e.rules, nil, false)

			require.ErrorIs(t, err, forbidden)
			require.Len(t, e.ruleStore.Rules[orgID], len(e.rules))
			require.Zero(t, e.xact.calls)
		})

		t.Run("skips rules that no longer exist", func(t *testing.T) {
			e := setup(t)
			e.authz.canWriteAll = false
			gone := e.rules[0]
			e.ruleStore.Rules[orgID] = e.rules[1:]

			require.NoError(t, e.service.DeleteAlertRules(context.Background(), u, e.rules, nil, false))

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
	service := &legacyRuleService{
		ruleStore:       ruleStore,
		provenanceStore: fakes.NewFakeProvisioningStore(),
		log:             log.New("testing"),
		authz:           &fakeDeleteAuthz{canWriteAll: true},
		xact:            xact,
	}

	require.NoError(t, service.DeleteAlertRule(context.Background(), u, rule.UID, utils.ManagerProperties{}, false))

	require.Empty(t, ruleStore.Rules[orgID])
	require.Equal(t, 1, xact.calls)
}
