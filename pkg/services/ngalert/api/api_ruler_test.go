package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func TestRouteDeleteAlertRules(t *testing.T) {
	getRecordedCommand := func(ruleStore *fakes.RuleStore) []fakes.GenericRecordedQuery {
		results := ruleStore.GetRecordedCommands(func(cmd interface{}) (interface{}, bool) {
			c, ok := cmd.(fakes.GenericRecordedQuery)
			if !ok || c.Name != "DeleteAlertRulesByUID" {
				return nil, false
			}
			return c, ok
		})
		var result []fakes.GenericRecordedQuery
		for _, cmd := range results {
			result = append(result, cmd.(fakes.GenericRecordedQuery))
		}
		return result
	}

	assertRulesDeleted := func(t *testing.T, expectedRules []*models.AlertRule, ruleStore *fakes.RuleStore) {
		deleteCommands := getRecordedCommand(ruleStore)
		require.Len(t, deleteCommands, 1)
		cmd := deleteCommands[0]
		actualUIDs := cmd.Params[1].([]string)
		require.Len(t, actualUIDs, len(expectedRules))
		for _, rule := range expectedRules {
			require.Containsf(t, actualUIDs, rule.UID, "Rule %s was expected to be deleted but it wasn't", rule.UID)
		}
	}

	orgID := rand.Int63()
	folder := randFolder()

	initFakeRuleStore := func(t *testing.T) *fakes.RuleStore {
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		// add random data
		ruleStore.PutRule(context.Background(), models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID)))...)
		return ruleStore
	}

	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		t.Run("and group argument is empty", func(t *testing.T) {
			t.Run("return 401 if user is not authorized to access any group in the folder", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				ruleStore.PutRule(context.Background(), models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)

				request := createRequestContextWithPerms(orgID, map[int64]map[string][]string{}, nil)

				response := createService(ruleStore).RouteDeleteAlertRules(request, folder.Title, "")
				require.Equalf(t, 401, response.Status(), "Expected 401 but got %d: %v", response.Status(), string(response.Body()))

				require.Empty(t, getRecordedCommand(ruleStore))
			})
			t.Run("delete only non-provisioned groups that user is authorized", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				provisioningStore := provisioning.NewFakeProvisioningStore()

				authorizedRulesInFolder := models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup("authz_"+util.GenerateShortUID())))

				provisionedRulesInFolder := models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup("provisioned_"+util.GenerateShortUID())))
				err := provisioningStore.SetProvenance(context.Background(), provisionedRulesInFolder[0], orgID, models.ProvenanceAPI)
				require.NoError(t, err)

				ruleStore.PutRule(context.Background(), authorizedRulesInFolder...)
				ruleStore.PutRule(context.Background(), provisionedRulesInFolder...)
				// more rules in the same namespace but user does not have access to them
				ruleStore.PutRule(context.Background(), models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup("unauthz"+util.GenerateShortUID())))...)

				permissions := createPermissionsForRules(append(authorizedRulesInFolder, provisionedRulesInFolder...), orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createServiceWithProvenanceStore(ruleStore, provisioningStore).RouteDeleteAlertRules(requestCtx, folder.Title, "")

				require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
				assertRulesDeleted(t, authorizedRulesInFolder, ruleStore)
			})
			t.Run("return 400 if all rules user can access are provisioned", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				provisioningStore := provisioning.NewFakeProvisioningStore()

				provisionedRulesInFolder := models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(util.GenerateShortUID())))
				err := provisioningStore.SetProvenance(context.Background(), provisionedRulesInFolder[0], orgID, models.ProvenanceAPI)
				require.NoError(t, err)

				ruleStore.PutRule(context.Background(), provisionedRulesInFolder...)
				// more rules in the same namespace but user does not have access to them
				ruleStore.PutRule(context.Background(), models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(util.GenerateShortUID())))...)

				permissions := createPermissionsForRules(provisionedRulesInFolder, orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createServiceWithProvenanceStore(ruleStore, provisioningStore).RouteDeleteAlertRules(requestCtx, folder.Title, "")

				require.Equalf(t, 400, response.Status(), "Expected 400 but got %d: %v", response.Status(), string(response.Body()))
				require.Empty(t, getRecordedCommand(ruleStore))
			})
			t.Run("should return 202 if folder is empty", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)

				requestCtx := createRequestContext(orgID, nil)
				response := createService(ruleStore).RouteDeleteAlertRules(requestCtx, folder.Title, "")

				require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
				require.Empty(t, getRecordedCommand(ruleStore))
			})
		})
		t.Run("and group argument is not empty", func(t *testing.T) {
			groupName := util.GenerateShortUID()
			t.Run("return 401 if user is not authorized to access the group", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)

				authorizedRulesInGroup := models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(groupName)))
				ruleStore.PutRule(context.Background(), authorizedRulesInGroup...)
				// more rules in the same group but user is not authorized to access them
				ruleStore.PutRule(context.Background(), models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(groupName)))...)

				permissions := createPermissionsForRules(authorizedRulesInGroup, orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createService(ruleStore).RouteDeleteAlertRules(requestCtx, folder.Title, groupName)

				require.Equalf(t, 401, response.Status(), "Expected 401 but got %d: %v", response.Status(), string(response.Body()))
				deleteCommands := getRecordedCommand(ruleStore)
				require.Empty(t, deleteCommands)
			})
			t.Run("return 400 if group is provisioned", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				provisioningStore := provisioning.NewFakeProvisioningStore()

				provisionedRulesInFolder := models.GenerateAlertRulesSmallNonEmpty(models.AlertRuleGen(withOrgID(orgID), withNamespace(folder), withGroup(groupName)))
				err := provisioningStore.SetProvenance(context.Background(), provisionedRulesInFolder[0], orgID, models.ProvenanceAPI)
				require.NoError(t, err)

				ruleStore.PutRule(context.Background(), provisionedRulesInFolder...)

				permissions := createPermissionsForRules(provisionedRulesInFolder, orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createServiceWithProvenanceStore(ruleStore, provisioningStore).RouteDeleteAlertRules(requestCtx, folder.Title, groupName)

				require.Equalf(t, 400, response.Status(), "Expected 400 but got %d: %v", response.Status(), string(response.Body()))
				deleteCommands := getRecordedCommand(ruleStore)
				require.Empty(t, deleteCommands)
			})
		})
	})
}

func TestRouteGetNamespaceRulesConfig(t *testing.T) {
	t.Run("fine-grained access is enabled", func(t *testing.T) {
		t.Run("should return rules for which user has access to data source", func(t *testing.T) {
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore := fakes.NewRuleStore(t)
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			expectedRules := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
			ruleStore.PutRule(context.Background(), expectedRules...)
			ruleStore.PutRule(context.Background(), models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))...)

			permissions := createPermissionsForRules(expectedRules, orgID)
			req := createRequestContextWithPerms(orgID, permissions, nil)

			response := createService(ruleStore).RouteGetNamespaceRulesConfig(req, folder.Title)

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
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		expectedRules := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withOrgID(orgID), withNamespace(folder)))
		ruleStore.PutRule(context.Background(), expectedRules...)

		svc := createService(ruleStore)

		// add provenance to the first generated rule
		rule := &models.AlertRule{
			UID: expectedRules[0].UID,
		}
		err := svc.provenanceStore.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI)
		require.NoError(t, err)

		req := createRequestContext(orgID, nil)
		response := svc.RouteGetNamespaceRulesConfig(req, folder.Title)

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
						require.Equal(t, apimodels.Provenance(models.ProvenanceAPI), actualRule.GrafanaManagedAlert.Provenance)
						found = true
					} else {
						require.Equal(t, apimodels.Provenance(models.ProvenanceNone), actualRule.GrafanaManagedAlert.Provenance)
					}
				}
			}
		}
		require.True(t, found)
	})
	t.Run("should enforce order of rules in the group", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		groupKey := models.GenerateGroupKey(orgID)
		groupKey.NamespaceUID = folder.UID

		expectedRules := models.GenerateAlertRules(rand.Intn(5)+5, models.AlertRuleGen(withGroupKey(groupKey), models.WithUniqueGroupIndex()))
		ruleStore.PutRule(context.Background(), expectedRules...)

		req := createRequestContext(orgID, nil)
		response := createService(ruleStore).RouteGetNamespaceRulesConfig(req, folder.Title)

		require.Equal(t, http.StatusAccepted, response.Status())
		result := &apimodels.NamespaceConfigResponse{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)

		models.RulesGroup(expectedRules).SortByGroupIndex()

		require.Contains(t, *result, folder.Title)
		groups := (*result)[folder.Title]
		require.Len(t, groups, 1)
		group := groups[0]
		require.Equal(t, groupKey.RuleGroup, group.Name)
		for i, actual := range groups[0].Rules {
			expected := expectedRules[i]
			if actual.GrafanaManagedAlert.UID != expected.UID {
				var actualUIDs []string
				var expectedUIDs []string
				for _, rule := range group.Rules {
					actualUIDs = append(actualUIDs, rule.GrafanaManagedAlert.UID)
				}
				for _, rule := range expectedRules {
					expectedUIDs = append(expectedUIDs, rule.UID)
				}
				require.Fail(t, fmt.Sprintf("rules are not sorted by group index. Expected: %v. Actual: %v", expectedUIDs, actualUIDs))
			}
		}
	})
}

func TestRouteGetRulesConfig(t *testing.T) {
	t.Run("fine-grained access is enabled", func(t *testing.T) {
		t.Run("should check access to data source", func(t *testing.T) {
			orgID := rand.Int63()
			ruleStore := fakes.NewRuleStore(t)
			folder1 := randFolder()
			folder2 := randFolder()
			ruleStore.Folders[orgID] = []*folder.Folder{folder1, folder2}

			group1Key := models.GenerateGroupKey(orgID)
			group1Key.NamespaceUID = folder1.UID
			group2Key := models.GenerateGroupKey(orgID)
			group2Key.NamespaceUID = folder2.UID

			group1 := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withGroupKey(group1Key)))
			group2 := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withGroupKey(group2Key)))
			ruleStore.PutRule(context.Background(), append(group1, group2...)...)

			t.Run("and do not return group if user does not have access to one of rules", func(t *testing.T) {
				permissions := createPermissionsForRules(append(group1, group2[1:]...), orgID)
				request := createRequestContextWithPerms(orgID, permissions, nil)

				response := createService(ruleStore).RouteGetRulesConfig(request)
				require.Equal(t, http.StatusOK, response.Status())

				result := &apimodels.NamespaceConfigResponse{}
				require.NoError(t, json.Unmarshal(response.Body(), result))
				require.NotNil(t, result)

				require.Contains(t, *result, folder1.Title)
				require.NotContains(t, *result, folder2.Title)

				groups := (*result)[folder1.Title]
				require.Len(t, groups, 1)
				require.Equal(t, group1Key.RuleGroup, groups[0].Name)
				require.Len(t, groups[0].Rules, len(group1))
			})
		})
	})

	t.Run("should return rules in group sorted by group index", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		groupKey := models.GenerateGroupKey(orgID)
		groupKey.NamespaceUID = folder.UID

		expectedRules := models.GenerateAlertRules(rand.Intn(5)+5, models.AlertRuleGen(withGroupKey(groupKey), models.WithUniqueGroupIndex()))
		ruleStore.PutRule(context.Background(), expectedRules...)

		req := createRequestContext(orgID, nil)
		response := createService(ruleStore).RouteGetRulesConfig(req)

		require.Equal(t, http.StatusOK, response.Status())
		result := &apimodels.NamespaceConfigResponse{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)

		models.RulesGroup(expectedRules).SortByGroupIndex()

		require.Contains(t, *result, folder.Title)
		groups := (*result)[folder.Title]
		require.Len(t, groups, 1)
		group := groups[0]
		require.Equal(t, groupKey.RuleGroup, group.Name)
		for i, actual := range groups[0].Rules {
			expected := expectedRules[i]
			if actual.GrafanaManagedAlert.UID != expected.UID {
				var actualUIDs []string
				var expectedUIDs []string
				for _, rule := range group.Rules {
					actualUIDs = append(actualUIDs, rule.GrafanaManagedAlert.UID)
				}
				for _, rule := range expectedRules {
					expectedUIDs = append(expectedUIDs, rule.UID)
				}
				require.Fail(t, fmt.Sprintf("rules are not sorted by group index. Expected: %v. Actual: %v", expectedUIDs, actualUIDs))
			}
		}
	})
}

func TestRouteGetRulesGroupConfig(t *testing.T) {
	t.Run("fine-grained access is enabled", func(t *testing.T) {
		t.Run("should check access to data source", func(t *testing.T) {
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore := fakes.NewRuleStore(t)
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			groupKey := models.GenerateGroupKey(orgID)
			groupKey.NamespaceUID = folder.UID

			expectedRules := models.GenerateAlertRules(rand.Intn(4)+2, models.AlertRuleGen(withGroupKey(groupKey)))
			ruleStore.PutRule(context.Background(), expectedRules...)

			t.Run("and return 401 if user does not have access one of rules", func(t *testing.T) {
				permissions := createPermissionsForRules(expectedRules[1:], orgID)
				request := createRequestContextWithPerms(orgID, permissions, map[string]string{
					":Namespace": folder.Title,
					":Groupname": groupKey.RuleGroup,
				})
				response := createService(ruleStore).RouteGetRulesGroupConfig(request, folder.Title, groupKey.RuleGroup)
				require.Equal(t, http.StatusUnauthorized, response.Status())
			})

			t.Run("and return rules if user has access to all of them", func(t *testing.T) {
				permissions := createPermissionsForRules(expectedRules, orgID)
				request := createRequestContextWithPerms(orgID, permissions, map[string]string{
					":Namespace": folder.Title,
					":Groupname": groupKey.RuleGroup,
				})
				response := createService(ruleStore).RouteGetRulesGroupConfig(request, folder.Title, groupKey.RuleGroup)

				require.Equal(t, http.StatusAccepted, response.Status())
				result := &apimodels.RuleGroupConfigResponse{}
				require.NoError(t, json.Unmarshal(response.Body(), result))
				require.NotNil(t, result)
				require.Len(t, result.Rules, len(expectedRules))
			})
		})
	})

	t.Run("should return rules in group sorted by group index", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		groupKey := models.GenerateGroupKey(orgID)
		groupKey.NamespaceUID = folder.UID

		expectedRules := models.GenerateAlertRules(rand.Intn(5)+5, models.AlertRuleGen(withGroupKey(groupKey), models.WithUniqueGroupIndex()))
		ruleStore.PutRule(context.Background(), expectedRules...)

		req := createRequestContext(orgID, nil)
		response := createService(ruleStore).RouteGetRulesGroupConfig(req, folder.Title, groupKey.RuleGroup)

		require.Equal(t, http.StatusAccepted, response.Status())
		result := &apimodels.RuleGroupConfigResponse{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)

		models.RulesGroup(expectedRules).SortByGroupIndex()

		for i, actual := range result.Rules {
			expected := expectedRules[i]
			if actual.GrafanaManagedAlert.UID != expected.UID {
				var actualUIDs []string
				var expectedUIDs []string
				for _, rule := range result.Rules {
					actualUIDs = append(actualUIDs, rule.GrafanaManagedAlert.UID)
				}
				for _, rule := range expectedRules {
					expectedUIDs = append(expectedUIDs, rule.UID)
				}
				require.Fail(t, fmt.Sprintf("rules are not sorted by group index. Expected: %v. Actual: %v", expectedUIDs, actualUIDs))
			}
		}
	})
}

func TestVerifyProvisionedRulesNotAffected(t *testing.T) {
	orgID := rand.Int63()
	group := models.GenerateGroupKey(orgID)
	affectedGroups := make(map[models.AlertRuleGroupKey]models.RulesGroup)
	var allRules []*models.AlertRule
	{
		rules := models.GenerateAlertRules(rand.Intn(3)+1, models.AlertRuleGen(withGroupKey(group)))
		allRules = append(allRules, rules...)
		affectedGroups[group] = rules
		for i := 0; i < rand.Intn(3)+1; i++ {
			g := models.GenerateGroupKey(orgID)
			rules := models.GenerateAlertRules(rand.Intn(3)+1, models.AlertRuleGen(withGroupKey(g)))
			allRules = append(allRules, rules...)
			affectedGroups[g] = rules
		}
	}
	ch := &store.GroupDelta{
		GroupKey:       group,
		AffectedGroups: affectedGroups,
	}

	t.Run("should return error if at least one rule in affected groups is provisioned", func(t *testing.T) {
		rand.Shuffle(len(allRules), func(i, j int) {
			allRules[j], allRules[i] = allRules[i], allRules[j]
		})
		storeResult := make(map[string]models.Provenance, len(allRules))
		storeResult[allRules[0].UID] = models.ProvenanceAPI
		storeResult[allRules[1].UID] = models.ProvenanceFile

		provenanceStore := &provisioning.MockProvisioningStore{}
		provenanceStore.EXPECT().GetProvenances(mock.Anything, orgID, "alertRule").Return(storeResult, nil)

		result := verifyProvisionedRulesNotAffected(context.Background(), provenanceStore, orgID, ch)
		require.Error(t, result)
		require.ErrorIs(t, result, errProvisionedResource)
		assert.Contains(t, result.Error(), allRules[0].GetGroupKey().String())
		assert.Contains(t, result.Error(), allRules[1].GetGroupKey().String())
	})

	t.Run("should return nil if all have ProvenanceNone", func(t *testing.T) {
		storeResult := make(map[string]models.Provenance, len(allRules))
		for _, rule := range allRules {
			storeResult[rule.UID] = models.ProvenanceNone
		}

		provenanceStore := &provisioning.MockProvisioningStore{}
		provenanceStore.EXPECT().GetProvenances(mock.Anything, orgID, "alertRule").Return(storeResult, nil)

		result := verifyProvisionedRulesNotAffected(context.Background(), provenanceStore, orgID, ch)
		require.NoError(t, result)
	})

	t.Run("should return nil if no alerts have provisioning status", func(t *testing.T) {
		provenanceStore := &provisioning.MockProvisioningStore{}
		provenanceStore.EXPECT().GetProvenances(mock.Anything, orgID, "alertRule").Return(make(map[string]models.Provenance, len(allRules)), nil)

		result := verifyProvisionedRulesNotAffected(context.Background(), provenanceStore, orgID, ch)
		require.NoError(t, result)
	})
}

func TestValidateQueries(t *testing.T) {
	delta := store.GroupDelta{
		New: []*models.AlertRule{
			models.AlertRuleGen(func(rule *models.AlertRule) {
				rule.Condition = "New"
			})(),
		},
		Update: []store.RuleDelta{
			{
				Existing: models.AlertRuleGen(func(rule *models.AlertRule) {
					rule.Condition = "Update_Existing"
				})(),
				New: models.AlertRuleGen(func(rule *models.AlertRule) {
					rule.Condition = "Update_New"
				})(),
				Diff: nil,
			},
		},
		Delete: []*models.AlertRule{
			models.AlertRuleGen(func(rule *models.AlertRule) {
				rule.Condition = "Deleted"
			})(),
		},
	}

	t.Run("should validate New and Updated only", func(t *testing.T) {
		validator := &recordingConditionValidator{}
		err := validateQueries(context.Background(), &delta, validator, nil)
		require.NoError(t, err)
		for _, condition := range validator.recorded {
			if condition.Condition == "New" || condition.Condition == "Update_New" {
				continue
			}
			assert.Failf(t, "validated unexpected condition", "condition '%s' was validated but should not", condition.Condition)
		}
	})
	t.Run("should return rule validate error if fails on new rule", func(t *testing.T) {
		validator := &recordingConditionValidator{
			hook: func(c models.Condition) error {
				if c.Condition == "New" {
					return errors.New("test")
				}
				return nil
			},
		}
		err := validateQueries(context.Background(), &delta, validator, nil)
		require.Error(t, err)
		require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
	})
	t.Run("should return rule validate error with UID if fails on updated rule", func(t *testing.T) {
		validator := &recordingConditionValidator{
			hook: func(c models.Condition) error {
				if c.Condition == "Update_New" {
					return errors.New("test")
				}
				return nil
			},
		}
		err := validateQueries(context.Background(), &delta, validator, nil)
		require.Error(t, err)
		require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
		require.ErrorContains(t, err, delta.Update[0].New.UID)
	})
}

func createServiceWithProvenanceStore(store *fakes.RuleStore, provenanceStore provisioning.ProvisioningStore) *RulerSrv {
	svc := createService(store)
	svc.provenanceStore = provenanceStore
	return svc
}

func createService(store *fakes.RuleStore) *RulerSrv {
	return &RulerSrv{
		xactManager:     store,
		store:           store,
		QuotaService:    nil,
		provenanceStore: provisioning.NewFakeProvisioningStore(),
		log:             log.New("test"),
		cfg:             nil,
		ac:              acimpl.ProvideAccessControl(setting.NewCfg()),
	}
}

func createRequestContext(orgID int64, params map[string]string) *contextmodel.ReqContext {
	defaultPerms := map[int64]map[string][]string{orgID: {datasources.ActionQuery: []string{datasources.ScopeAll}}}
	return createRequestContextWithPerms(orgID, defaultPerms, params)
}

func createRequestContextWithPerms(orgID int64, permissions map[int64]map[string][]string, params map[string]string) *contextmodel.ReqContext {
	uri, _ := url.Parse("http://localhost")
	ctx := web.Context{Req: &http.Request{
		URL: uri,
	}}
	if params != nil {
		ctx.Req = web.SetURLParams(ctx.Req, params)
	}

	return &contextmodel.ReqContext{
		IsSignedIn: true,
		SignedInUser: &user.SignedInUser{
			Permissions: permissions,
			OrgID:       orgID,
		},
		Context: &ctx,
	}
}

func createPermissionsForRules(rules []*models.AlertRule, orgID int64) map[int64]map[string][]string {
	permissions := map[string][]string{}
	for _, rule := range rules {
		for _, query := range rule.Data {
			permissions[datasources.ActionQuery] = append(permissions[datasources.ActionQuery], datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
		}
	}
	return map[int64]map[string][]string{orgID: permissions}
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

func withNamespace(namespace *folder.Folder) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.NamespaceUID = namespace.UID
	}
}

func withGroupKey(groupKey models.AlertRuleGroupKey) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.RuleGroup = groupKey.RuleGroup
		rule.OrgID = groupKey.OrgID
		rule.NamespaceUID = groupKey.NamespaceUID
	}
}
