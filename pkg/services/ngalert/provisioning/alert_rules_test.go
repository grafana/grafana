package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAlertRuleService(t *testing.T) {
	ruleService := createAlertRuleService(t)
	var orgID int64 = 1
	u := &user.SignedInUser{
		UserID: 1,
		OrgID:  orgID,
	}

	t.Run("group creation should set the right provenance", func(t *testing.T) {
		group := createDummyGroup("group-test-1", orgID)
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "group-test-1")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		for _, rule := range readGroup.Rules {
			_, provenance, err := ruleService.GetAlertRule(context.Background(), u, rule.UID)
			require.NoError(t, err)
			require.Equal(t, models.ProvenanceAPI, provenance)
		}
	})

	t.Run("alert rule group should be updated correctly", func(t *testing.T) {
		rule := dummyRule("test#3", orgID)
		rule.RuleGroup = "a"
		rule, err := ruleService.CreateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
		require.NoError(t, err)
		require.Equal(t, int64(60), rule.IntervalSeconds)

		var interval int64 = 120
		err = ruleService.UpdateRuleGroup(context.Background(), u, rule.NamespaceUID, rule.RuleGroup, 120)
		require.NoError(t, err)

		rule, _, err = ruleService.GetAlertRule(context.Background(), u, rule.UID)
		require.NoError(t, err)
		require.Equal(t, interval, rule.IntervalSeconds)
	})

	t.Run("if a folder was renamed the interval should be fetched from the renamed folder", func(t *testing.T) {
		var orgID int64 = 2
		rule := dummyRule("test#1", orgID)
		rule.NamespaceUID = "123abc"
		u := &user.SignedInUser{OrgID: orgID}
		rule, err := ruleService.CreateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
		require.NoError(t, err)

		rule.NamespaceUID = "abc123"
		_, err = ruleService.UpdateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
		require.NoError(t, err)
	})

	t.Run("group update should propagate folderUID from group to rules", func(t *testing.T) {
		ruleService := createAlertRuleService(t)
		group := createDummyGroup("namespace-test", orgID)
		group.Rules[0].NamespaceUID = ""

		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "namespace-test")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Equal(t, "my-namespace", readGroup.Rules[0].NamespaceUID)
	})

	t.Run("group creation should propagate group title correctly", func(t *testing.T) {
		group := createDummyGroup("group-test-3", orgID)
		group.Rules[0].RuleGroup = "something different"

		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "group-test-3")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		for _, rule := range readGroup.Rules {
			require.Equal(t, "group-test-3", rule.RuleGroup)
		}
	})

	t.Run("alert rule should get interval from existing rule group", func(t *testing.T) {
		rule := dummyRule("test#4", orgID)
		rule.RuleGroup = "b"
		rule, err := ruleService.CreateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
		require.NoError(t, err)

		var interval int64 = 120
		err = ruleService.UpdateRuleGroup(context.Background(), u, rule.NamespaceUID, rule.RuleGroup, 120)
		require.NoError(t, err)

		rule = dummyRule("test#4-1", orgID)
		rule.RuleGroup = "b"
		rule, err = ruleService.CreateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
		require.NoError(t, err)
		require.Equal(t, interval, rule.IntervalSeconds)
	})

	t.Run("updating a rule group's top level fields should bump the version number", func(t *testing.T) {
		const (
			orgID              = 123
			namespaceUID       = "abc"
			ruleUID            = "some_rule_uid"
			ruleGroup          = "abc"
			newInterval  int64 = 120
		)
		u := &user.SignedInUser{OrgID: orgID}
		rule := dummyRule("my_rule", orgID)
		rule.UID = ruleUID
		rule.RuleGroup = ruleGroup
		rule.NamespaceUID = namespaceUID
		_, err := ruleService.CreateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
		require.NoError(t, err)

		rule, _, err = ruleService.GetAlertRule(context.Background(), u, ruleUID)
		require.NoError(t, err)
		require.Equal(t, int64(1), rule.Version)
		require.Equal(t, int64(60), rule.IntervalSeconds)

		err = ruleService.UpdateRuleGroup(context.Background(), u, namespaceUID, ruleGroup, newInterval)
		require.NoError(t, err)

		rule, _, err = ruleService.GetAlertRule(context.Background(), u, ruleUID)
		require.NoError(t, err)
		require.Equal(t, int64(2), rule.Version)
		require.Equal(t, newInterval, rule.IntervalSeconds)
	})

	t.Run("updating a group by updating a rule should bump that rule's data and version number", func(t *testing.T) {
		group := createDummyGroup("group-test-5", orgID)
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "group-test-5")
		require.NoError(t, err)

		updatedGroup.Rules[0].Title = "some-other-title-asdf"
		err = ruleService.ReplaceRuleGroup(context.Background(), u, updatedGroup, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "group-test-5")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 1)
		require.Equal(t, "some-other-title-asdf", readGroup.Rules[0].Title)
		require.Equal(t, int64(2), readGroup.Rules[0].Version)
	})

	t.Run("updating a group to temporarily overlap rule names should not throw unique constraint", func(t *testing.T) {
		var orgID int64 = 1
		group := models.AlertRuleGroup{
			Title:     "overlap-test",
			Interval:  60,
			FolderUID: "my-namespace",
			Rules: []models.AlertRule{
				dummyRule("overlap-test-rule-1", orgID),
				dummyRule("overlap-test-rule-2", orgID),
			},
		}
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "overlap-test")
		require.NoError(t, err)

		updatedGroup.Rules[0].Title = "overlap-test-rule-2"
		updatedGroup.Rules[1].Title = "overlap-test-rule-3"
		err = ruleService.ReplaceRuleGroup(context.Background(), u, updatedGroup, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "overlap-test")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 2)
		require.Equal(t, "overlap-test-rule-2", readGroup.Rules[0].Title)
		require.Equal(t, "overlap-test-rule-3", readGroup.Rules[1].Title)
		require.Equal(t, int64(3), readGroup.Rules[0].Version)
		require.Equal(t, int64(3), readGroup.Rules[1].Version)
	})

	t.Run("updating a group to swap the name of two rules should not throw unique constraint", func(t *testing.T) {
		var orgID int64 = 1
		group := models.AlertRuleGroup{
			Title:     "swap-test",
			Interval:  60,
			FolderUID: "my-namespace",
			Rules: []models.AlertRule{
				dummyRule("swap-test-rule-1", orgID),
				dummyRule("swap-test-rule-2", orgID),
			},
		}
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "swap-test")
		require.NoError(t, err)

		updatedGroup.Rules[0].Title = "swap-test-rule-2"
		updatedGroup.Rules[1].Title = "swap-test-rule-1"
		err = ruleService.ReplaceRuleGroup(context.Background(), u, updatedGroup, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "swap-test")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 2)
		require.Equal(t, "swap-test-rule-2", readGroup.Rules[0].Title)
		require.Equal(t, "swap-test-rule-1", readGroup.Rules[1].Title)
		require.Equal(t, int64(3), readGroup.Rules[0].Version) // Needed an extra update to break the update cycle.
		require.Equal(t, int64(3), readGroup.Rules[1].Version)
	})

	t.Run("updating a group that has a rule name cycle should not throw unique constraint", func(t *testing.T) {
		var orgID int64 = 1
		group := models.AlertRuleGroup{
			Title:     "cycle-test",
			Interval:  60,
			FolderUID: "my-namespace",
			Rules: []models.AlertRule{
				dummyRule("cycle-test-rule-1", orgID),
				dummyRule("cycle-test-rule-2", orgID),
				dummyRule("cycle-test-rule-3", orgID),
			},
		}
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "cycle-test")
		require.NoError(t, err)

		updatedGroup.Rules[0].Title = "cycle-test-rule-2"
		updatedGroup.Rules[1].Title = "cycle-test-rule-3"
		updatedGroup.Rules[2].Title = "cycle-test-rule-1"
		err = ruleService.ReplaceRuleGroup(context.Background(), u, updatedGroup, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "cycle-test")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 3)
		require.Equal(t, "cycle-test-rule-2", readGroup.Rules[0].Title)
		require.Equal(t, "cycle-test-rule-3", readGroup.Rules[1].Title)
		require.Equal(t, "cycle-test-rule-1", readGroup.Rules[2].Title)
		require.Equal(t, int64(3), readGroup.Rules[0].Version) // Needed an extra update to break the update cycle.
		require.Equal(t, int64(3), readGroup.Rules[1].Version)
		require.Equal(t, int64(3), readGroup.Rules[2].Version)
	})

	t.Run("updating a group that has multiple rule name cycles should not throw unique constraint", func(t *testing.T) {
		var orgID int64 = 1
		group := models.AlertRuleGroup{
			Title:     "multi-cycle-test",
			Interval:  60,
			FolderUID: "my-namespace",
			Rules: []models.AlertRule{
				dummyRule("multi-cycle-test-rule-1", orgID),
				dummyRule("multi-cycle-test-rule-2", orgID),

				dummyRule("multi-cycle-test-rule-3", orgID),
				dummyRule("multi-cycle-test-rule-4", orgID),
				dummyRule("multi-cycle-test-rule-5", orgID),
			},
		}
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "multi-cycle-test")
		require.NoError(t, err)

		updatedGroup.Rules[0].Title = "multi-cycle-test-rule-2"
		updatedGroup.Rules[1].Title = "multi-cycle-test-rule-1"

		updatedGroup.Rules[2].Title = "multi-cycle-test-rule-4"
		updatedGroup.Rules[3].Title = "multi-cycle-test-rule-5"
		updatedGroup.Rules[4].Title = "multi-cycle-test-rule-3"

		err = ruleService.ReplaceRuleGroup(context.Background(), u, updatedGroup, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "multi-cycle-test")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 5)
		require.Equal(t, "multi-cycle-test-rule-2", readGroup.Rules[0].Title)
		require.Equal(t, "multi-cycle-test-rule-1", readGroup.Rules[1].Title)
		require.Equal(t, "multi-cycle-test-rule-4", readGroup.Rules[2].Title)
		require.Equal(t, "multi-cycle-test-rule-5", readGroup.Rules[3].Title)
		require.Equal(t, "multi-cycle-test-rule-3", readGroup.Rules[4].Title)
		require.Equal(t, int64(3), readGroup.Rules[0].Version) // Needed an extra update to break the update cycle.
		require.Equal(t, int64(3), readGroup.Rules[1].Version)
		require.Equal(t, int64(3), readGroup.Rules[2].Version) // Needed an extra update to break the update cycle.
		require.Equal(t, int64(3), readGroup.Rules[3].Version)
		require.Equal(t, int64(3), readGroup.Rules[4].Version)
	})

	t.Run("updating a group to recreate a rule using the same name should not throw unique constraint", func(t *testing.T) {
		var orgID int64 = 1
		group := models.AlertRuleGroup{
			Title:     "recreate-test",
			Interval:  60,
			FolderUID: "my-namespace",
			Rules: []models.AlertRule{
				dummyRule("recreate-test-rule-1", orgID),
			},
		}
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup := models.AlertRuleGroup{
			Title:     "recreate-test",
			Interval:  60,
			FolderUID: "my-namespace",
			Rules: []models.AlertRule{
				dummyRule("recreate-test-rule-1", orgID),
			},
		}
		err = ruleService.ReplaceRuleGroup(context.Background(), u, updatedGroup, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "recreate-test")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 1)
		require.Equal(t, "recreate-test-rule-1", readGroup.Rules[0].Title)
		require.Equal(t, int64(1), readGroup.Rules[0].Version)
	})

	t.Run("updating a group to create a rule that temporarily overlaps an existing should not throw unique constraint", func(t *testing.T) {
		var orgID int64 = 1
		group := models.AlertRuleGroup{
			Title:     "create-overlap-test",
			Interval:  60,
			FolderUID: "my-namespace",
			Rules: []models.AlertRule{
				dummyRule("create-overlap-test-rule-1", orgID),
			},
		}
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "create-overlap-test")
		require.NoError(t, err)
		updatedGroup.Rules[0].Title = "create-overlap-test-rule-2"
		updatedGroup.Rules = append(updatedGroup.Rules, dummyRule("create-overlap-test-rule-1", orgID))

		err = ruleService.ReplaceRuleGroup(context.Background(), u, updatedGroup, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "create-overlap-test")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 2)
		require.Equal(t, "create-overlap-test-rule-2", readGroup.Rules[0].Title)
		require.Equal(t, "create-overlap-test-rule-1", readGroup.Rules[1].Title)
		require.Equal(t, int64(2), readGroup.Rules[0].Version)
		require.Equal(t, int64(1), readGroup.Rules[1].Version)
	})

	t.Run("updating a group by updating a rule should not remove dashboard and panel ids", func(t *testing.T) {
		dashboardUid := "huYnkl7H"
		panelId := int64(5678)
		group := createDummyGroup("group-test-5", orgID)
		group.Rules[0].Annotations = map[string]string{
			models.DashboardUIDAnnotation: dashboardUid,
			models.PanelIDAnnotation:      strconv.FormatInt(panelId, 10),
		}

		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), u, "my-namespace", "group-test-5")
		require.NoError(t, err)

		require.NotNil(t, updatedGroup.Rules[0].DashboardUID)
		require.NotNil(t, updatedGroup.Rules[0].PanelID)
		require.Equal(t, dashboardUid, *updatedGroup.Rules[0].DashboardUID)
		require.Equal(t, panelId, *updatedGroup.Rules[0].PanelID)
	})

	t.Run("alert rule provenace should be correctly checked", func(t *testing.T) {
		tests := []struct {
			name   string
			from   models.Provenance
			to     models.Provenance
			errNil bool
		}{
			{
				name:   "should be able to update from provenance none to api",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceAPI,
				errNil: true,
			},
			{
				name:   "should be able to update from provenance none to file",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceFile,
				errNil: true,
			},
			{
				name:   "should not be able to update from provenance api to file",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceFile,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance api to none",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceNone,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to api",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceAPI,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to none",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceNone,
				errNil: false,
			},
		}
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				rule := dummyRule(t.Name(), orgID)
				rule, err := ruleService.CreateAlertRule(context.Background(), u, rule, test.from)
				require.NoError(t, err)

				_, err = ruleService.UpdateAlertRule(context.Background(), u, rule, test.to)
				if test.errNil {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}
			})
		}
	})

	t.Run("alert rule provenace should be correctly checked when writing groups", func(t *testing.T) {
		tests := []struct {
			name   string
			from   models.Provenance
			to     models.Provenance
			errNil bool
		}{
			{
				name:   "should be able to update from provenance none to api",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceAPI,
				errNil: true,
			},
			{
				name:   "should be able to update from provenance none to file",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceFile,
				errNil: true,
			},
			{
				name:   "should not be able to update from provenance api to file",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceFile,
				errNil: false,
			},
			{
				name:   "should be able to update from provenance api to none",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceNone,
				errNil: true,
			},
			{
				name:   "should not be able to update from provenance file to api",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceAPI,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to none",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceNone,
				errNil: false,
			},
		}
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				var orgID int64 = 1
				group := createDummyGroup(t.Name(), orgID)
				err := ruleService.ReplaceRuleGroup(context.Background(), u, group, test.from)
				require.NoError(t, err)

				group.Rules[0].Title = t.Name()
				err = ruleService.ReplaceRuleGroup(context.Background(), u, group, test.to)
				if test.errNil {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}
			})
		}
	})

	t.Run("quota met causes create to be rejected", func(t *testing.T) {
		ruleService := createAlertRuleService(t)
		checker := &MockQuotaChecker{}
		checker.EXPECT().LimitExceeded()
		ruleService.quotas = checker

		_, err := ruleService.CreateAlertRule(context.Background(), u, dummyRule("test#1", orgID), models.ProvenanceNone)

		require.ErrorIs(t, err, models.ErrQuotaReached)
	})

	t.Run("quota met causes group write to be rejected", func(t *testing.T) {
		ruleService := createAlertRuleService(t)
		checker := &MockQuotaChecker{}
		checker.EXPECT().LimitExceeded()
		ruleService.quotas = checker

		group := createDummyGroup("quota-reached", orgID)
		err := ruleService.ReplaceRuleGroup(context.Background(), u, group, models.ProvenanceAPI)

		require.ErrorIs(t, err, models.ErrQuotaReached)
	})
}

func TestCreateAlertRule(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey := models.GenerateGroupKey(orgID)
	groupIntervalSeconds := int64(30)
	rules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(groupKey), models.WithInterval(time.Duration(groupIntervalSeconds)*time.Second)))
	groupProvenance := models.ProvenanceAPI

	initServiceWithData := func(t *testing.T) (*AlertRuleService, *fakes.RuleStore, *fakes.FakeProvisioningStore, *fakeRuleAccessControlService) {
		service, ruleStore, provenanceStore, ac := initService(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{
			orgID: rules,
		}
		for _, rule := range rules {
			require.NoError(t, provenanceStore.SetProvenance(context.Background(), rule, orgID, groupProvenance))
		}
		return service, ruleStore, provenanceStore, ac
	}

	t.Run("when user can write all rules", func(t *testing.T) {
		t.Run("and a new rule creates a new group", func(t *testing.T) {
			rule := models.AlertRuleGen(models.WithOrgID(orgID))()
			service, ruleStore, provenanceStore, ac := initServiceWithData(t)

			ac.CanWriteAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return true, nil
			}

			actualRule, err := service.CreateAlertRule(context.Background(), u, *rule, models.ProvenanceFile)
			require.NoError(t, err)

			require.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanWriteAllRules", ac.Calls[0].Method)

			t.Run("it should assign default interval", func(t *testing.T) {
				require.Equal(t, service.defaultIntervalSeconds, actualRule.IntervalSeconds)
			})

			t.Run("inserts to database", func(t *testing.T) {
				inserts := ruleStore.GetRecordedCommands(func(cmd any) (any, bool) {
					a, ok := cmd.([]models.AlertRule)
					return a, ok
				})
				require.Len(t, inserts, 1)
				cmd := inserts[0].([]models.AlertRule)
				require.Len(t, cmd, 1)
			})

			t.Run("set correct provenance", func(t *testing.T) {
				p, err := provenanceStore.GetProvenance(context.Background(), &actualRule, orgID)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceFile, p)
			})
		})
		t.Run("and it adds a rule to a group", func(t *testing.T) {
			rule := models.AlertRuleGen(models.WithGroupKey(groupKey))()
			service, ruleStore, provenanceStore, ac := initServiceWithData(t)

			ac.CanWriteAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return true, nil
			}

			actualRule, err := service.CreateAlertRule(context.Background(), u, *rule, models.ProvenanceNone)
			require.NoError(t, err)

			require.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanWriteAllRules", ac.Calls[0].Method)

			t.Run("it should assign group interval", func(t *testing.T) {
				require.Equal(t, groupIntervalSeconds, actualRule.IntervalSeconds)
			})

			t.Run("inserts to database", func(t *testing.T) {
				inserts := ruleStore.GetRecordedCommands(func(cmd any) (any, bool) {
					a, ok := cmd.([]models.AlertRule)
					return a, ok
				})
				require.Len(t, inserts, 1)
				cmd := inserts[0].([]models.AlertRule)
				require.Len(t, cmd, 1)
			})

			t.Run("set correct provenance", func(t *testing.T) {
				p, err := provenanceStore.GetProvenance(context.Background(), &actualRule, orgID)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceNone, p)
			})
		})
	})

	ruleService := createAlertRuleService(t)
	t.Run("should return the created id", func(t *testing.T) {
		rule, err := ruleService.CreateAlertRule(context.Background(), u, dummyRule("test#1", orgID), models.ProvenanceNone)
		require.NoError(t, err)
		require.NotEqual(t, 0, rule.ID, "expected to get the created id and not the zero value")
	})

	t.Run("should set the right provenance", func(t *testing.T) {
		rule, err := ruleService.CreateAlertRule(context.Background(), u, dummyRule("test#2", orgID), models.ProvenanceAPI)
		require.NoError(t, err)

		_, provenance, err := ruleService.GetAlertRule(context.Background(), u, rule.UID)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceAPI, provenance)
	})

	t.Run("when UID is specified", func(t *testing.T) {
		t.Run("return error if it is not valid UID", func(t *testing.T) {
			rule := dummyRule("test#3", orgID)
			rule.UID = strings.Repeat("1", util.MaxUIDLength+1)
			rule, err := ruleService.CreateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
			require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
		})
		t.Run("should create a new rule with this UID", func(t *testing.T) {
			rule := dummyRule("test#3", orgID)
			uid := util.GenerateShortUID()
			rule.UID = uid
			created, err := ruleService.CreateAlertRule(context.Background(), u, rule, models.ProvenanceNone)
			require.NoError(t, err)
			require.Equal(t, uid, created.UID)
			_, _, err = ruleService.GetAlertRule(context.Background(), u, uid)
			require.NoError(t, err)
		})
	})
}

func TestGetAlertRule(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey := models.GenerateGroupKey(orgID)
	rules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(groupKey)))
	rule := rules[0]
	expectedProvenance := models.ProvenanceAPI

	initServiceWithData := func(t *testing.T) (*AlertRuleService, *fakes.RuleStore, *fakes.FakeProvisioningStore, *fakeRuleAccessControlService) {
		service, ruleStore, provenanceStore, ac := initService(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{
			orgID: rules,
		}
		require.NoError(t, provenanceStore.SetProvenance(context.Background(), rule, orgID, expectedProvenance))

		return service, ruleStore, provenanceStore, ac
	}

	t.Run("when user cannot read all rules", func(t *testing.T) {
		t.Run("should request entire group and return error if AuthorizeAccessToRuleGroup returns error", func(t *testing.T) {
			service, ruleStore, _, ac := initServiceWithData(t)

			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}

			expected := errors.New("test")
			ac.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
				return expected
			}

			_, _, err := service.GetAlertRule(context.Background(), u, rule.UID)
			require.Error(t, err)
			require.Equal(t, expected, err)

			assert.Len(t, ac.Calls, 2)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
			assert.Equal(t, u, ac.Calls[0].Args[1])

			assert.Equal(t, "AuthorizeAccessToRuleGroup", ac.Calls[1].Method)
			assert.Equal(t, u, ac.Calls[1].Args[1])
			assert.Equal(t, models.RulesGroup(rules), ac.Calls[1].Args[2])

			assert.Len(t, ruleStore.RecordedOps, 1)
			require.IsType(t, ruleStore.RecordedOps[0], models.GetAlertRulesGroupByRuleUIDQuery{})
			query := ruleStore.RecordedOps[0].(models.GetAlertRulesGroupByRuleUIDQuery)
			assert.Equal(t, models.GetAlertRulesGroupByRuleUIDQuery{
				OrgID: groupKey.OrgID,
				UID:   rule.UID,
			}, query)
		})

		t.Run("should request entire group and return single rule if AuthorizeAccessToRuleGroup passes", func(t *testing.T) {
			service, _, _, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}
			ac.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
				return nil
			}

			actual, provenance, err := service.GetAlertRule(context.Background(), u, rule.UID)
			require.NoError(t, err)
			assert.Equal(t, *rule, actual)
			assert.Equal(t, expectedProvenance, provenance)
		})

		t.Run("should return ErrAlertRuleNotFound if rule does not exist", func(t *testing.T) {
			service, ruleStore, _, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}

			_, _, err := service.GetAlertRule(context.Background(), u, "no-rule-uid")
			require.ErrorIs(t, err, models.ErrAlertRuleNotFound)

			assert.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
			require.IsType(t, ruleStore.RecordedOps[0], models.GetAlertRulesGroupByRuleUIDQuery{})
			query := ruleStore.RecordedOps[0].(models.GetAlertRulesGroupByRuleUIDQuery)
			assert.Equal(t, models.GetAlertRulesGroupByRuleUIDQuery{
				OrgID: orgID,
				UID:   "no-rule-uid",
			}, query)
		})
	})

	t.Run("when user can read all rules", func(t *testing.T) {
		t.Run("should query rule by UID and do not check any permissions", func(t *testing.T) {
			service, ruleStore, _, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return true, nil
			}

			actual, provenance, err := service.GetAlertRule(context.Background(), u, rule.UID)
			require.NoError(t, err)
			assert.Equal(t, *rule, actual)
			assert.Equal(t, expectedProvenance, provenance)

			assert.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
			assert.Equal(t, u, ac.Calls[0].Args[1])

			require.Len(t, ruleStore.RecordedOps, 1)
			require.IsType(t, ruleStore.RecordedOps[0], models.GetAlertRuleByUIDQuery{})
			query := ruleStore.RecordedOps[0].(models.GetAlertRuleByUIDQuery)
			assert.Equal(t, models.GetAlertRuleByUIDQuery{
				OrgID: rule.OrgID,
				UID:   rule.UID,
			}, query)
		})

		t.Run("should return ErrAlertRuleNotFound if rule does not exist", func(t *testing.T) {
			service, _, _, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return true, nil
			}

			_, _, err := service.GetAlertRule(context.Background(), u, "no-rule-uid")
			require.ErrorIs(t, err, models.ErrAlertRuleNotFound)
		})
	})

	t.Run("return error immediately when CanReadAllRules returns error", func(t *testing.T) {
		service, ruleStore, _, ac := initServiceWithData(t)

		expectedErr := errors.New("test")
		ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
			return false, expectedErr
		}

		_, _, err := service.GetAlertRule(context.Background(), u, rule.UID)
		require.Error(t, err)
		require.Equal(t, expectedErr, err)

		assert.Len(t, ac.Calls, 1)
		assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)

		assert.Empty(t, ruleStore.RecordedOps)
	})
}

func TestGetRuleGroup(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey := models.GenerateGroupKey(orgID)
	intervalSeconds := int64(30)
	rules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(groupKey), models.WithInterval(time.Duration(intervalSeconds)*time.Second)))
	derefRules := make([]models.AlertRule, 0, len(rules))
	for _, rule := range rules {
		derefRules = append(derefRules, *rule)
	}
	expectedProvenance := models.ProvenanceAPI

	initServiceWithData := func(t *testing.T) (*AlertRuleService, *fakes.RuleStore, *fakes.FakeProvisioningStore, *fakeRuleAccessControlService) {
		service, ruleStore, provenanceStore, ac := initService(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{
			orgID: rules,
		}
		for _, rule := range rules {
			require.NoError(t, provenanceStore.SetProvenance(context.Background(), rule, orgID, expectedProvenance))
		}

		return service, ruleStore, provenanceStore, ac
	}

	t.Run("return ErrAlertRuleGroupNotFound when rule group does not exist", func(t *testing.T) {
		service, _, _, ac := initServiceWithData(t)

		_, err := service.GetRuleGroup(context.Background(), u, groupKey.NamespaceUID, "no-rule-group")
		require.ErrorIs(t, err, models.ErrAlertRuleGroupNotFound)
		require.Empty(t, ac.Calls)
	})

	t.Run("when user cannot read all rules", func(t *testing.T) {
		t.Run("it should check AuthorizeAccessToRuleGroup and propagate error", func(t *testing.T) {
			service, ruleStore, _, ac := initServiceWithData(t)

			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}
			expectedErr := errors.New("error")
			ac.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
				return expectedErr
			}

			_, err := service.GetRuleGroup(context.Background(), u, groupKey.NamespaceUID, groupKey.RuleGroup)
			require.Error(t, err)
			require.Equal(t, expectedErr, err)

			assert.Len(t, ac.Calls, 2)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
			assert.Equal(t, u, ac.Calls[0].Args[1])

			assert.Equal(t, "AuthorizeAccessToRuleGroup", ac.Calls[1].Method)
			assert.Equal(t, u, ac.Calls[1].Args[1])
			assert.Equal(t, models.RulesGroup(rules), ac.Calls[1].Args[2])

			assert.Len(t, ruleStore.RecordedOps, 1)
			require.IsType(t, ruleStore.RecordedOps[0], models.ListAlertRulesQuery{})
			query := ruleStore.RecordedOps[0].(models.ListAlertRulesQuery)
			assert.Equal(t, models.ListAlertRulesQuery{
				OrgID:         groupKey.OrgID,
				RuleGroup:     groupKey.RuleGroup,
				NamespaceUIDs: []string{groupKey.NamespaceUID},
			}, query)
		})

		t.Run("should return group if AuthorizeAccessToRuleGroup passes", func(t *testing.T) {
			service, _, _, ac := initServiceWithData(t)

			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return false, nil
			}
			ac.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
				return nil
			}

			group, err := service.GetRuleGroup(context.Background(), u, groupKey.NamespaceUID, groupKey.RuleGroup)
			require.NoError(t, err)

			assert.Equal(t, groupKey.RuleGroup, group.Title)
			assert.Equal(t, groupKey.NamespaceUID, group.FolderUID)
			assert.Equal(t, intervalSeconds, group.Interval)
			assert.Equal(t, derefRules, group.Rules)
		})
	})

	t.Run("when user can read all rules", func(t *testing.T) {
		t.Run("it should skip AuthorizeAccessToRuleGroup", func(t *testing.T) {
			service, _, _, ac := initServiceWithData(t)

			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return true, nil
			}

			group, err := service.GetRuleGroup(context.Background(), u, groupKey.NamespaceUID, groupKey.RuleGroup)
			require.NoError(t, err)

			assert.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
			assert.Equal(t, u, ac.Calls[0].Args[1])

			assert.Equal(t, groupKey.RuleGroup, group.Title)
			assert.Equal(t, groupKey.NamespaceUID, group.FolderUID)
			assert.Equal(t, intervalSeconds, group.Interval)
			assert.Equal(t, derefRules, group.Rules)
		})
	})

	t.Run("return error immediately when CanReadAllRules returns error", func(t *testing.T) {
		service, _, _, ac := initServiceWithData(t)

		expectedErr := errors.New("test")
		ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
			return false, expectedErr
		}

		_, err := service.GetRuleGroup(context.Background(), u, groupKey.NamespaceUID, groupKey.RuleGroup)
		require.Error(t, err)
		require.Equal(t, expectedErr, err)

		assert.Len(t, ac.Calls, 1)
		assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
	})
}

func TestGetAlertRules(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey1 := models.GenerateGroupKey(orgID)
	groupKey2 := models.GenerateGroupKey(orgID)
	rules1 := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(groupKey1)))
	models.RulesGroup(rules1).SortByGroupIndex()
	rules2 := models.GenerateAlertRules(4, models.AlertRuleGen(models.WithGroupKey(groupKey2)))
	models.RulesGroup(rules2).SortByGroupIndex()
	allRules := append(rules1, rules2...)
	expectedProvenance := models.ProvenanceAPI

	initServiceWithData := func(t *testing.T) (*AlertRuleService, *fakes.RuleStore, *fakes.FakeProvisioningStore, *fakeRuleAccessControlService) {
		service, ruleStore, provenanceStore, ac := initService(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{
			orgID: allRules,
		}
		for _, rule := range rules1 {
			require.NoError(t, provenanceStore.SetProvenance(context.Background(), rule, orgID, expectedProvenance))
		}

		return service, ruleStore, provenanceStore, ac
	}

	t.Run("return error when CanReadAllRules return error", func(t *testing.T) {
		service, _, _, ac := initServiceWithData(t)
		expectedErr := errors.New("test")
		ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
			return false, expectedErr
		}

		_, _, err := service.GetAlertRules(context.Background(), u)
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("when user can read all rules", func(t *testing.T) {
		t.Run("should skip AuthorizeAccessToRuleGroup and return all rules", func(t *testing.T) {
			service, _, _, ac := initServiceWithData(t)
			ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
				return true, nil
			}

			rules, provenance, err := service.GetAlertRules(context.Background(), u)
			require.NoError(t, err)
			require.Equal(t, allRules, rules)
			require.Len(t, provenance, len(rules1))

			assert.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
		})
	})

	t.Run("when user cannot read all rules", func(t *testing.T) {
		t.Run("should group rules and check AuthorizeAccessToRuleGroup and return only available rules", func(t *testing.T) {
			t.Run("should remove group from output if AuthorizeAccessToRuleGroup returns authorization error", func(t *testing.T) {
				service, _, _, ac := initServiceWithData(t)
				ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
					return false, nil
				}
				ac.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
					if rules[0].GetGroupKey() == groupKey1 {
						return accesscontrol.NewAuthorizationErrorGeneric("test")
					}
					return nil
				}

				rules, provenance, err := service.GetAlertRules(context.Background(), u)
				require.NoError(t, err)

				assert.Equal(t, rules2, rules)
				assert.Empty(t, provenance)

				assert.Len(t, ac.Calls, 3)
				assert.Equal(t, "CanReadAllRules", ac.Calls[0].Method)
				assert.Equal(t, "AuthorizeAccessToRuleGroup", ac.Calls[1].Method)
				assert.Equal(t, "AuthorizeAccessToRuleGroup", ac.Calls[2].Method)

				group1 := ac.Calls[1].Args[2].(models.RulesGroup)
				group2 := ac.Calls[2].Args[2].(models.RulesGroup)
				require.Len(t, append(group1, group2...), len(allRules))
			})

			t.Run("should immediately exist if AuthorizeAccessToRuleGroup returns another error", func(t *testing.T) {
				service, _, _, ac := initServiceWithData(t)
				ac.CanReadAllRulesFunc = func(ctx context.Context, user identity.Requester) (bool, error) {
					return false, nil
				}
				expectedErr := errors.New("test")
				ac.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
					return expectedErr
				}

				_, _, err := service.GetAlertRules(context.Background(), u)
				require.ErrorIs(t, err, expectedErr)
			})
		})
	})
}

func createAlertRuleService(t *testing.T) AlertRuleService {
	t.Helper()
	sqlStore := db.InitTestDB(t)
	folderService := foldertest.NewFakeService()
	folderService.ExpectedFolder = &folder.Folder{
		UID: "default-namespace",
	}
	store := store.DBstore{
		SQLStore: sqlStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: time.Second * 10,
		},
		Logger:        log.NewNopLogger(),
		FolderService: folderService,
	}
	// store := fakes.NewRuleStore(t)
	quotas := MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	return AlertRuleService{
		ruleStore:              store,
		provenanceStore:        store,
		quotas:                 &quotas,
		xact:                   sqlStore,
		log:                    log.New("testing"),
		baseIntervalSeconds:    10,
		defaultIntervalSeconds: 60,
		folderService:          folderService,
		authz:                  &fakeRuleAccessControlService{},
	}
}

func dummyRule(title string, orgID int64) models.AlertRule {
	return createTestRule(title, "my-cool-group", orgID, "my-namespace")
}

func createTestRule(title string, groupTitle string, orgID int64, namespace string) models.AlertRule {
	return models.AlertRule{
		OrgID:           orgID,
		Title:           title,
		Condition:       "A",
		Version:         1,
		IntervalSeconds: 60,
		Data: []models.AlertQuery{
			{
				RefID:         "A",
				Model:         json.RawMessage("{}"),
				DatasourceUID: expr.DatasourceUID,
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(60),
					To:   models.Duration(0),
				},
			},
		},
		NamespaceUID: namespace,
		RuleGroup:    groupTitle,
		For:          time.Second * 60,
		NoDataState:  models.OK,
		ExecErrState: models.OkErrState,
	}
}

func createDummyGroup(title string, orgID int64) models.AlertRuleGroup {
	return models.AlertRuleGroup{
		Title:     title,
		Interval:  60,
		FolderUID: "my-namespace",
		Rules: []models.AlertRule{
			dummyRule(title+"-"+"rule-1", orgID),
		},
	}
}

func initService(t *testing.T) (*AlertRuleService, *fakes.RuleStore, *fakes.FakeProvisioningStore, *fakeRuleAccessControlService) {
	t.Helper()

	ac := &fakeRuleAccessControlService{}
	ruleStore := fakes.NewRuleStore(t)
	provenanceStore := fakes.NewFakeProvisioningStore()
	folderService := foldertest.NewFakeService()

	quotas := MockQuotaChecker{}
	quotas.EXPECT().LimitOK()

	service := &AlertRuleService{
		folderService:          folderService,
		ruleStore:              ruleStore,
		provenanceStore:        provenanceStore,
		quotas:                 &quotas,
		xact:                   newNopTransactionManager(),
		log:                    log.New("testing"),
		baseIntervalSeconds:    10,
		defaultIntervalSeconds: 60,
		authz:                  ac,
	}

	return service, ruleStore, provenanceStore, ac
}
