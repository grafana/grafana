package api

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	models2 "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acMock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func TestCalculateChanges(t *testing.T) {
	orgId := rand.Int63()

	t.Run("detects alerts that need to be added", func(t *testing.T) {
		fakeStore := store.NewFakeRuleStore(t)

		namespace := randFolder()
		groupName := util.GenerateShortUID()
		submitted := models.GenerateAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withOrgID(orgId), simulateSubmitted, withoutUID))

		changes, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, submitted)
		require.NoError(t, err)

		require.Len(t, changes.New, len(submitted))
		require.Empty(t, changes.Delete)
		require.Empty(t, changes.Update)

	outerloop:
		for _, expected := range submitted {
			for _, rule := range changes.New {
				if len(expected.Diff(rule)) == 0 {
					continue outerloop
				}
			}
			require.Fail(t, "changes did not contain rule that was submitted")
		}
	})

	t.Run("detects alerts that need to be deleted", func(t *testing.T) {
		namespace := randFolder()
		groupName := util.GenerateShortUID()
		inDatabaseMap, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withOrgID(orgId), withGroup(groupName), withNamespace(namespace)))

		fakeStore := store.NewFakeRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		changes, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, make([]*models.AlertRule, 0))
		require.NoError(t, err)

		require.Empty(t, changes.New)
		require.Empty(t, changes.Update)
		require.Len(t, changes.Delete, len(inDatabaseMap))
		for _, toDelete := range changes.Delete {
			require.Contains(t, inDatabaseMap, toDelete.UID)
			db := inDatabaseMap[toDelete.UID]
			require.Equal(t, db, toDelete)
		}
	})

	t.Run("should detect alerts that needs to be updated", func(t *testing.T) {
		namespace := randFolder()
		groupName := util.GenerateShortUID()
		inDatabaseMap, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withOrgID(orgId), withGroup(groupName), withNamespace(namespace)))
		submittedMap, submitted := models.GenerateUniqueAlertRules(len(inDatabase), models.AlertRuleGen(simulateSubmitted, withOrgID(orgId), withGroup(groupName), withNamespace(namespace), withUIDs(inDatabaseMap)))

		fakeStore := store.NewFakeRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		changes, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, submitted)
		require.NoError(t, err)

		require.Len(t, changes.Update, len(inDatabase))
		for _, upsert := range changes.Update {
			require.NotNil(t, upsert.Existing)
			require.Equal(t, upsert.Existing.UID, upsert.New.UID)
			require.Equal(t, inDatabaseMap[upsert.Existing.UID], upsert.Existing)
			require.Equal(t, submittedMap[upsert.Existing.UID], upsert.New)
			require.NotEmpty(t, upsert.Diff)
		}
		require.Empty(t, changes.Delete)
		require.Empty(t, changes.New)
	})

	t.Run("should include only if there are changes ignoring specific fields", func(t *testing.T) {
		namespace := randFolder()
		groupName := util.GenerateShortUID()
		_, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withOrgID(orgId), withGroup(groupName), withNamespace(namespace)))

		submitted := make([]*models.AlertRule, 0, len(inDatabase))
		for _, rule := range inDatabase {
			r := models.CopyRule(rule)

			// Ignore difference in the following fields as submitted models do not have them set
			r.ID = rand.Int63()
			r.Version = rand.Int63()
			r.Updated = r.Updated.Add(1 * time.Minute)

			submitted = append(submitted, r)
		}

		fakeStore := store.NewFakeRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		changes, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, submitted)
		require.NoError(t, err)

		require.Empty(t, changes.Update)
		require.Empty(t, changes.Delete)
		require.Empty(t, changes.New)
	})

	t.Run("should patch rule with UID specified by existing rule", func(t *testing.T) {
		testCases := []struct {
			name    string
			mutator func(r *models.AlertRule)
		}{
			{
				name: "title is empty",
				mutator: func(r *models.AlertRule) {
					r.Title = ""
				},
			},
			{
				name: "condition and data are empty",
				mutator: func(r *models.AlertRule) {
					r.Condition = ""
					r.Data = nil
				},
			},
			{
				name: "ExecErrState is empty",
				mutator: func(r *models.AlertRule) {
					r.ExecErrState = ""
				},
			},
			{
				name: "NoDataState is empty",
				mutator: func(r *models.AlertRule) {
					r.NoDataState = ""
				},
			},
			{
				name: "For is 0",
				mutator: func(r *models.AlertRule) {
					r.For = 0
				},
			},
		}

		dbRule := models.AlertRuleGen(withOrgID(orgId))()

		fakeStore := store.NewFakeRuleStore(t)
		fakeStore.PutRule(context.Background(), dbRule)

		namespace := randFolder()
		groupName := util.GenerateShortUID()

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				expected := models.AlertRuleGen(simulateSubmitted, testCase.mutator)()
				expected.UID = dbRule.UID
				submitted := *expected
				changes, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, []*models.AlertRule{&submitted})
				require.NoError(t, err)
				require.Len(t, changes.Update, 1)
				ch := changes.Update[0]
				require.Equal(t, ch.Existing, dbRule)
				fixed := *expected
				models.PatchPartialAlertRule(dbRule, &fixed)
				require.Equal(t, fixed, *ch.New)
			})
		}
	})

	t.Run("should be able to find alerts by UID in other group/namespace", func(t *testing.T) {
		inDatabaseMap, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(10)+10, models.AlertRuleGen(withOrgID(orgId)))

		fakeStore := store.NewFakeRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		namespace := randFolder()
		groupName := util.GenerateShortUID()
		submittedMap, submitted := models.GenerateUniqueAlertRules(rand.Intn(len(inDatabase)-5)+5, models.AlertRuleGen(simulateSubmitted, withOrgID(orgId), withGroup(groupName), withNamespace(namespace), withUIDs(inDatabaseMap)))

		changes, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, submitted)
		require.NoError(t, err)

		require.Empty(t, changes.Delete)
		require.Empty(t, changes.New)
		require.Len(t, changes.Update, len(submitted))
		for _, update := range changes.Update {
			require.NotNil(t, update.Existing)
			require.Equal(t, update.Existing.UID, update.New.UID)
			require.Equal(t, inDatabaseMap[update.Existing.UID], update.Existing)
			require.Equal(t, submittedMap[update.Existing.UID], update.New)
			require.NotEmpty(t, update.Diff)
		}
	})

	t.Run("should fail when submitted rule has UID that does not exist in db", func(t *testing.T) {
		fakeStore := store.NewFakeRuleStore(t)

		namespace := randFolder()
		groupName := util.GenerateShortUID()
		submitted := models.AlertRuleGen(withOrgID(orgId), simulateSubmitted)()
		require.NotEqual(t, "", submitted.UID)

		_, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, []*models.AlertRule{submitted})
		require.Error(t, err)
	})

	t.Run("should fail if cannot fetch current rules in the group", func(t *testing.T) {
		fakeStore := store.NewFakeRuleStore(t)
		expectedErr := errors.New("TEST ERROR")
		fakeStore.Hook = func(cmd interface{}) error {
			switch cmd.(type) {
			case models.ListAlertRulesQuery:
				return expectedErr
			}
			return nil
		}

		namespace := randFolder()
		groupName := util.GenerateShortUID()
		submitted := models.AlertRuleGen(withOrgID(orgId), simulateSubmitted, withoutUID)()

		_, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, []*models.AlertRule{submitted})
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("should fail if cannot fetch rule by UID", func(t *testing.T) {
		fakeStore := store.NewFakeRuleStore(t)
		expectedErr := errors.New("TEST ERROR")
		fakeStore.Hook = func(cmd interface{}) error {
			switch cmd.(type) {
			case models.GetAlertRuleByUIDQuery:
				return expectedErr
			}
			return nil
		}

		namespace := randFolder()
		groupName := util.GenerateShortUID()
		submitted := models.AlertRuleGen(withOrgID(orgId), simulateSubmitted)()

		_, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, []*models.AlertRule{submitted})
		require.Error(t, err, expectedErr)
	})
}

func TestRouteDeleteAlertRules(t *testing.T) {
	getRecordedCommand := func(ruleStore *store.FakeRuleStore) []store.GenericRecordedQuery {
		results := ruleStore.GetRecordedCommands(func(cmd interface{}) (interface{}, bool) {
			c, ok := cmd.(store.GenericRecordedQuery)
			if !ok || c.Name != "DeleteAlertRulesByUID" {
				return nil, false
			}
			return c, ok
		})
		var result []store.GenericRecordedQuery
		for _, cmd := range results {
			result = append(result, cmd.(store.GenericRecordedQuery))
		}
		return result
	}

	assertRulesDeleted := func(t *testing.T, expectedRules []*models.AlertRule, ruleStore *store.FakeRuleStore, scheduler *schedule.FakeScheduleService) {
		deleteCommands := getRecordedCommand(ruleStore)
		require.Len(t, deleteCommands, 1)
		cmd := deleteCommands[0]
		actualUIDs := cmd.Params[1].([]string)
		require.Len(t, actualUIDs, len(expectedRules))
		for _, rule := range expectedRules {
			require.Containsf(t, actualUIDs, rule.UID, "Rule %s was expected to be deleted but it wasn't", rule.UID)
		}

		require.Len(t, scheduler.Calls, len(expectedRules))
		for _, call := range scheduler.Calls {
			require.Equal(t, "DeleteAlertRule", call.Method)
			key, ok := call.Arguments.Get(0).(models.AlertRuleKey)
			require.Truef(t, ok, "Expected AlertRuleKey but got something else")
			found := false
			for _, rule := range expectedRules {
				if rule.GetKey() == key {
					found = true
					break
				}
			}
			require.Truef(t, found, "Key %v was not expected to be submitted to scheduler", key)
		}
	}

	t.Run("when fine-grained access is disabled", func(t *testing.T) {
		t.Run("viewer should not be authorized", func(t *testing.T) {
			ruleStore := store.NewFakeRuleStore(t)
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID)))...)

			scheduler := &schedule.FakeScheduleService{}
			scheduler.On("DeleteAlertRule", mock.Anything).Panic("should not be called")

			ac := acMock.New().WithDisabled()
			request := createRequestContext(orgID, models2.ROLE_VIEWER, map[string]string{
				":Namespace": folder.Title,
			})
			response := createService(ac, ruleStore, scheduler).RouteDeleteAlertRules(request)
			require.Equalf(t, 401, response.Status(), "Expected 403 but got %d: %v", response.Status(), string(response.Body()))

			scheduler.AssertNotCalled(t, "DeleteAlertRule")
			require.Empty(t, getRecordedCommand(ruleStore))
		})
		t.Run("editor should be able to delete all rules in folder", func(t *testing.T) {
			ruleStore := store.NewFakeRuleStore(t)
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			rulesInFolder := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
			ruleStore.PutRule(context.Background(), rulesInFolder...)
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID)))...)

			scheduler := &schedule.FakeScheduleService{}
			scheduler.On("DeleteAlertRule", mock.Anything)

			ac := acMock.New().WithDisabled()
			request := createRequestContext(orgID, models2.ROLE_EDITOR, map[string]string{
				":Namespace": folder.Title,
			})
			response := createService(ac, ruleStore, scheduler).RouteDeleteAlertRules(request)
			require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
			assertRulesDeleted(t, rulesInFolder, ruleStore, scheduler)
		})
		t.Run("editor should be able to delete rules in a group in a folder", func(t *testing.T) {
			ruleStore := store.NewFakeRuleStore(t)
			orgID := rand.Int63()
			groupName := util.GenerateShortUID()
			folder := randFolder()
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			rulesInFolderInGroup := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(groupName)))
			ruleStore.PutRule(context.Background(), rulesInFolderInGroup...)
			// rules in different groups but in the same namespace
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)
			// rules in the same group but different folder
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withGroup(groupName)))...)

			scheduler := &schedule.FakeScheduleService{}
			scheduler.On("DeleteAlertRule", mock.Anything)

			ac := acMock.New().WithDisabled()
			request := createRequestContext(orgID, models2.ROLE_EDITOR, map[string]string{
				":Namespace": folder.Title,
				":Groupname": groupName,
			})
			response := createService(ac, ruleStore, scheduler).RouteDeleteAlertRules(request)
			require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
			assertRulesDeleted(t, rulesInFolderInGroup, ruleStore, scheduler)
		})
	})
	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		t.Run("and user does not have access to any of data sources used by alert rules", func(t *testing.T) {
			ruleStore := store.NewFakeRuleStore(t)
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID)))...)

			scheduler := &schedule.FakeScheduleService{}
			scheduler.On("DeleteAlertRule", mock.Anything).Panic("should not be called")

			ac := acMock.New()
			request := createRequestContext(orgID, "None", map[string]string{
				":Namespace": folder.Title,
			})
			response := createService(ac, ruleStore, scheduler).RouteDeleteAlertRules(request)
			require.Equalf(t, 401, response.Status(), "Expected 403 but got %d: %v", response.Status(), string(response.Body()))

			scheduler.AssertNotCalled(t, "DeleteAlertRule")
			require.Empty(t, getRecordedCommand(ruleStore))
		})
		t.Run("and user has access to all alert rules", func(t *testing.T) {
			t.Run("should delete all rules", func(t *testing.T) {
				ruleStore := store.NewFakeRuleStore(t)
				orgID := rand.Int63()
				folder := randFolder()
				ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
				rulesInFolder := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
				ruleStore.PutRule(context.Background(), rulesInFolder...)
				ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID)))...)

				scheduler := &schedule.FakeScheduleService{}
				scheduler.On("DeleteAlertRule", mock.Anything)

				ac := acMock.New().WithPermissions(createPermissionsForRules(rulesInFolder))
				request := createRequestContext(orgID, "None", map[string]string{
					":Namespace": folder.Title,
				})

				response := createService(ac, ruleStore, scheduler).RouteDeleteAlertRules(request)
				require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
				assertRulesDeleted(t, rulesInFolder, ruleStore, scheduler)
			})
		})
		t.Run("and user has access to data sources of some of alert rules", func(t *testing.T) {
			t.Run("should delete only those that are accessible in folder", func(t *testing.T) {
				ruleStore := store.NewFakeRuleStore(t)
				orgID := rand.Int63()
				folder := randFolder()
				ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
				authorizedRulesInFolder := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
				ruleStore.PutRule(context.Background(), authorizedRulesInFolder...)
				// more rules in the same namespace but user does not have access to them
				ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)
				ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID)))...)

				scheduler := &schedule.FakeScheduleService{}
				scheduler.On("DeleteAlertRule", mock.Anything)

				ac := acMock.New().WithPermissions(createPermissionsForRules(authorizedRulesInFolder))
				request := createRequestContext(orgID, "None", map[string]string{
					":Namespace": folder.Title,
				})

				response := createService(ac, ruleStore, scheduler).RouteDeleteAlertRules(request)
				require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
				assertRulesDeleted(t, authorizedRulesInFolder, ruleStore, scheduler)
			})
			t.Run("should delete only rules in a group that are authorized", func(t *testing.T) {
				ruleStore := store.NewFakeRuleStore(t)
				orgID := rand.Int63()
				groupName := util.GenerateShortUID()
				folder := randFolder()
				ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
				authorizedRulesInGroup := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(groupName)))
				ruleStore.PutRule(context.Background(), authorizedRulesInGroup...)
				// more rules in the same group but user is not authorized to access them
				ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(groupName)))...)
				// rules in different groups but in the same namespace
				ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)
				// rules in the same group but different folder
				ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withGroup(groupName)))...)

				scheduler := &schedule.FakeScheduleService{}
				scheduler.On("DeleteAlertRule", mock.Anything)

				ac := acMock.New().WithPermissions(createPermissionsForRules(authorizedRulesInGroup))
				request := createRequestContext(orgID, "None", map[string]string{
					":Namespace": folder.Title,
					":Groupname": groupName,
				})
				response := createService(ac, ruleStore, scheduler).RouteDeleteAlertRules(request)
				require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
				assertRulesDeleted(t, authorizedRulesInGroup, ruleStore, scheduler)
			})
		})
	})
}

func TestRouteGetNamespaceRulesConfig(t *testing.T) {
	t.Run("fine-grained access is enabled", func(t *testing.T) {
		t.Run("should return rules for which user has access to data source", func(t *testing.T) {
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore := store.NewFakeRuleStore(t)
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			expectedRules := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
			ruleStore.PutRule(context.Background(), expectedRules...)
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)
			ac := acMock.New().WithPermissions(createPermissionsForRules(expectedRules))

			response := createService(ac, ruleStore, nil).RouteGetNamespaceRulesConfig(createRequestContext(orgID, "", map[string]string{
				":Namespace": folder.Title,
			}))

			require.Equal(t, http.StatusAccepted, response.Status())
			result := &apimodels.NamespaceConfigResponse{}
			require.NoError(t, json.Unmarshal(response.Body(), result))
			require.NotNil(t, result)
			for namespace, groups := range *result {
				require.Equal(t, folder.Title, namespace)
				for _, group := range groups {
				grouploop:
					for _, actualRule := range group.Rules {
						for i, expected := range expectedRules {
							if actualRule.GrafanaManagedAlert.UID == expected.UID {
								expectedRules = append(expectedRules[:i], expectedRules[i+1:]...)
								continue grouploop
							}
						}
						assert.Failf(t, "rule in a group was not found in expected", "rule %s group %s", actualRule.GrafanaManagedAlert.Title, group.Name)
					}
				}
			}
			assert.Emptyf(t, expectedRules, "not all expected rules were returned")
		})
	})
	t.Run("fine-grained access is disabled", func(t *testing.T) {
		t.Run("should return all rules from folder", func(t *testing.T) {
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore := store.NewFakeRuleStore(t)
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			expectedRules := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
			ruleStore.PutRule(context.Background(), expectedRules...)
			ac := acMock.New().WithDisabled()

			response := createService(ac, ruleStore, nil).RouteGetNamespaceRulesConfig(createRequestContext(orgID, models2.ROLE_VIEWER, map[string]string{
				":Namespace": folder.Title,
			}))

			require.Equal(t, http.StatusAccepted, response.Status())
			result := &apimodels.NamespaceConfigResponse{}
			require.NoError(t, json.Unmarshal(response.Body(), result))
			require.NotNil(t, result)
			for namespace, groups := range *result {
				require.Equal(t, folder.Title, namespace)
				for _, group := range groups {
				grouploop:
					for _, actualRule := range group.Rules {
						for i, expected := range expectedRules {
							if actualRule.GrafanaManagedAlert.UID == expected.UID {
								expectedRules = append(expectedRules[:i], expectedRules[i+1:]...)
								continue grouploop
							}
						}
						assert.Failf(t, "rule in a group was not found in expected", "rule %s group %s", actualRule.GrafanaManagedAlert.Title, group.Name)
					}
				}
			}
			assert.Emptyf(t, expectedRules, "not all expected rules were returned")
		})
	})
	t.Run("should return the provenance of the alert rules", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := store.NewFakeRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		expectedRules := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
		ruleStore.PutRule(context.Background(), expectedRules...)
		ac := acMock.New().WithDisabled()

		svc := createService(ac, ruleStore, nil)

		// add provenance to the first generated rule
		rule := &models.AlertRule{
			UID: expectedRules[0].UID,
		}
		err := svc.provenanceStore.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI)
		require.NoError(t, err)

		response := svc.RouteGetNamespaceRulesConfig(createRequestContext(orgID, models2.ROLE_VIEWER, map[string]string{
			":Namespace": folder.Title,
		}))

		require.Equal(t, http.StatusAccepted, response.Status())
		result := &apimodels.NamespaceConfigResponse{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)
		found := false
		for namespace, groups := range *result {
			require.Equal(t, folder.Title, namespace)
			for _, group := range groups {
				for _, actualRule := range group.Rules {
					if actualRule.GrafanaManagedAlert.UID == expectedRules[0].UID {
						require.Equal(t, models.ProvenanceAPI, actualRule.GrafanaManagedAlert.Provenance)
						found = true
					} else {
						require.Equal(t, models.ProvenanceNone, actualRule.GrafanaManagedAlert.Provenance)
					}
				}
			}
		}
		require.True(t, found)
	})
}

func createService(ac *acMock.Mock, store *store.FakeRuleStore, scheduler schedule.ScheduleService) *RulerSrv {
	return &RulerSrv{
		xactManager:     store,
		store:           store,
		DatasourceCache: nil,
		QuotaService:    nil,
		scheduleService: scheduler,
		log:             log.New("test"),
		cfg:             nil,
		ac:              ac,
	}
}

func createRequestContext(orgID int64, role models2.RoleType, params map[string]string) *models2.ReqContext {
	ctx := web.Context{Req: &http.Request{}}
	ctx.Req = web.SetURLParams(ctx.Req, params)

	return &models2.ReqContext{
		IsSignedIn: true,
		SignedInUser: &models2.SignedInUser{
			OrgRole: role,
			OrgId:   orgID,
		},
		Context: &ctx,
	}
}

func createPermissionsForRules(rules []*models.AlertRule) []*accesscontrol.Permission {
	var permissions []*accesscontrol.Permission
	for _, rule := range rules {
		for _, query := range rule.Data {
			permissions = append(permissions, &accesscontrol.Permission{
				Action: datasources.ActionQuery, Scope: datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID),
			})
		}
	}
	return permissions
}

func withOrgID(orgId int64) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.OrgID = orgId
	}
}

func withGroup(groupName string) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.RuleGroup = groupName
	}
}

func withNamespace(namespace *models2.Folder) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.NamespaceUID = namespace.Uid
	}
}

// simulateSubmitted resets some fields of the structure that are not populated by API model to model conversion
func simulateSubmitted(rule *models.AlertRule) {
	rule.ID = 0
	rule.Version = 0
	rule.Updated = time.Time{}
}

func withoutUID(rule *models.AlertRule) {
	rule.UID = ""
}

func withUIDs(uids map[string]*models.AlertRule) func(rule *models.AlertRule) {
	unused := make([]string, 0, len(uids))
	for s := range uids {
		unused = append(unused, s)
	}
	return func(rule *models.AlertRule) {
		if len(unused) == 0 {
			return
		}
		rule.UID = unused[0]
		unused = unused[1:]
	}
}
