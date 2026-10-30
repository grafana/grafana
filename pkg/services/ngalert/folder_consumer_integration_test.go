package ngalert

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/cleaner"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationAlertRuleFolderConsumers_RoutedSQL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, consumer := range []string{"folder reconciler", "contents cleaner"} {
		t.Run(consumer, func(t *testing.T) {
			local, service := newFolderConsumerRuleService(t)
			routed, _ := newFolderConsumerRuleService(t)
			seedFolderConsumerRules(t, local, "local-only")
			seedFolderConsumerRules(t, routed, "other-folder")
			copyFolderConsumerTables(t, routed.SQLStore)

			var tables []string
			var requesters []identity.Requester
			local.LegacyDatabaseProvider = func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				requester, err := identity.GetRequester(ctx)
				if err != nil {
					return nil, err
				}
				requesters = append(requesters, requester)
				return &legacysql.LegacyDatabaseHelper{
					DB: routed.SQLStore,
					Table: func(table string) string {
						tables = append(tables, table)
						return "routed_" + table
					},
				}, nil
			}

			ctx, requester := identity.WithServiceIdentity(context.Background(), 2)
			c := ProvideAlertRuleFolderConsumer(service)
			folders, err := c.FoldersInUse(ctx, 2)
			require.NoError(t, err)
			assert.ElementsMatch(t, []string{"target-folder", "other-folder"}, folders)
			count, err := service.CountInFolders(ctx, 2, []string{"target-folder"}, requester)
			require.NoError(t, err)
			assert.Equal(t, int64(1), count)

			requesters = nil
			if consumer == "folder reconciler" {
				require.NoError(t, c.DeleteInFolder(context.Background(), 2, "target-folder"))
			} else {
				require.NoError(t, cleaner.NewContentsCleaner(service).DeleteInFolder(ctx, "org-2", "target-folder", requester))
			}
			require.NotEmpty(t, requesters)
			for _, got := range requesters {
				assert.Equal(t, int64(2), got.GetOrgID())
				if consumer == "contents cleaner" {
					assert.Same(t, requester, got)
				}
			}
			for _, table := range []string{"alert_rule", "alert_instance", "alert_rule_state", "alert_rule_version"} {
				assert.Contains(t, tables, table)
			}
			assertFolderConsumerRows(t, routed.SQLStore, "routed_alert_rule", 2, []string{"other-folder"})
			assertFolderConsumerRows(t, routed.SQLStore, "routed_alert_rule", 3, []string{"target-folder"})
			assertFolderConsumerRows(t, routed.SQLStore, "alert_rule", 2, []string{"target-folder", "other-folder"})
			assertFolderConsumerRows(t, local.SQLStore, "alert_rule", 2, []string{"target-folder", "local-only"})
		})
	}
}

func TestIntegrationAlertRuleFolderConsumers_ProviderFailure(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, operation := range []string{"list", "reconciler read", "reconciler delete", "cleaner read", "cleaner delete"} {
		t.Run(operation, func(t *testing.T) {
			raw, service := newFolderConsumerRuleService(t)
			seedFolderConsumerRules(t, raw, "other-folder")
			failure := errors.New("rule database unavailable")
			calls := 0
			raw.LegacyDatabaseProvider = func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				calls++
				if calls == 1 && (operation == "reconciler delete" || operation == "cleaner delete") {
					return legacysql.NewDatabaseProvider(raw.SQLStore)(ctx)
				}
				return nil, failure
			}
			c := ProvideAlertRuleFolderConsumer(service)
			var err error
			switch operation {
			case "list":
				_, err = c.FoldersInUse(context.Background(), 2)
			case "reconciler read", "reconciler delete":
				err = c.DeleteInFolder(context.Background(), 2, "target-folder")
			default:
				ctx, requester := identity.WithServiceIdentity(context.Background(), 2)
				err = cleaner.NewContentsCleaner(service).DeleteInFolder(ctx, "org-2", "target-folder", requester)
			}
			require.ErrorIs(t, err, failure)
			assertFolderConsumerRows(t, raw.SQLStore, "alert_rule", 2, []string{"target-folder", "other-folder"})
		})
	}
}

func TestIntegrationAlertRuleFolderConsumers_SQLFailureRollsBack(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	raw, service := newFolderConsumerRuleService(t)
	seedFolderConsumerRules(t, raw, "other-folder")
	raw.LegacyDatabaseProvider = func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB: raw.SQLStore,
			Table: func(table string) string {
				if table == "alert_instance" {
					return "missing_alert_instance"
				}
				return table
			},
		}, nil
	}
	err := ProvideAlertRuleFolderConsumer(service).DeleteInFolder(context.Background(), 2, "target-folder")
	require.ErrorContains(t, err, "missing_alert_instance")
	assertFolderConsumerRows(t, raw.SQLStore, "alert_rule", 2, []string{"target-folder", "other-folder"})
}

func TestIntegrationAlertRuleFolderConsumers_DefaultSQLJoinsTransaction(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, consumer := range []string{"folder reconciler", "contents cleaner"} {
		t.Run(consumer, func(t *testing.T) {
			raw, service := newFolderConsumerRuleService(t)
			seedFolderConsumerRules(t, raw, "other-folder")
			require.Nil(t, raw.LegacyDatabaseProvider)
			failure := errors.New("later transaction step failed")
			err := raw.SQLStore.InTransaction(context.Background(), func(ctx context.Context) error {
				if consumer == "folder reconciler" {
					if err := ProvideAlertRuleFolderConsumer(service).DeleteInFolder(ctx, 2, "target-folder"); err != nil {
						return err
					}
				} else {
					ctx, requester := identity.WithServiceIdentity(ctx, 2)
					if err := cleaner.NewContentsCleaner(service).DeleteInFolder(ctx, "org-2", "target-folder", requester); err != nil {
						return err
					}
				}
				uids, err := service.ListAlertRuleUIDsInFolder(ctx, 2, "target-folder")
				require.NoError(t, err)
				require.Empty(t, uids)
				return failure
			})
			require.ErrorIs(t, err, failure)
			assertFolderConsumerRows(t, raw.SQLStore, "alert_rule", 2, []string{"target-folder", "other-folder"})
		})
	}
}

func newFolderConsumerRuleService(t *testing.T) (*rules.RuleStore, *rules.Service) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 10 * time.Second
	raw := &rules.RuleStore{
		SQLStore:       db.NewTestStore(t),
		Cfg:            cfg.UnifiedAlerting,
		Logger:         log.New("test.folder-consumer"),
		FeatureToggles: featuremgmt.WithFeatures(),
		AccessControl: acmock.New().WithPermissions([]accesscontrol.Permission{
			{Action: accesscontrol.ActionAlertingRuleDelete, Scope: folder.ScopeFoldersAll},
		}),
	}
	service, err := rules.ProvideService(raw, foldertest.NewFakeService())
	require.NoError(t, err)
	return raw, service
}

func seedFolderConsumerRules(t *testing.T, raw *rules.RuleStore, otherFolder string) {
	t.Helper()
	for _, fixture := range []struct {
		orgID  int64
		folder string
		uid    string
	}{{2, "target-folder", "shared-uid"}, {2, otherFolder, "other-uid"}, {3, "target-folder", "shared-uid"}} {
		rule := models.RuleGen.With(models.RuleGen.WithIntervalMatching(raw.Cfg.BaseInterval)).Generate()
		rule.ID = 0
		rule.OrgID = fixture.orgID
		rule.NamespaceUID = fixture.folder
		rule.UID = fixture.uid
		_, err := raw.InsertAlertRules(context.Background(), &models.AlertingUserUID, []models.InsertRule{{AlertRule: rule}})
		require.NoError(t, err)
	}
}

func copyFolderConsumerTables(t *testing.T, store db.DB) {
	t.Helper()
	for _, table := range []string{"alert_rule", "alert_instance", "alert_rule_state", "alert_rule_version"} {
		err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Exec(fmt.Sprintf("CREATE TABLE routed_%s AS SELECT * FROM %s", table, table))
			return err
		})
		require.NoError(t, err)
	}
}

func assertFolderConsumerRows(t *testing.T, store db.DB, table string, orgID int64, want []string) {
	t.Helper()
	var folders []string
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Table(table).Cols("namespace_uid").Where("org_id = ?", orgID).Find(&folders)
	})
	require.NoError(t, err)
	assert.ElementsMatch(t, want, folders)
}
