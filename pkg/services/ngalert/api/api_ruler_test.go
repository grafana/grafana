package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/cmputil"
	"github.com/grafana/grafana/pkg/web"
)

func TestRouteDeleteAlertRules(t *testing.T) {
	getRecordedCommand := func(ruleStore *fakes.RuleStore) []fakes.GenericRecordedQuery {
		results := ruleStore.GetRecordedCommands(func(cmd any) (any, bool) {
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
	gen := models.RuleGen.With(models.RuleGen.WithOrgID(orgID))

	initFakeRuleStore := func(t *testing.T) *fakes.RuleStore {
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		// add random data
		ruleStore.PutRule(context.Background(), gen.GenerateManyRef(1, 5)...)
		return ruleStore
	}

	t.Run("when fine-grained access is enabled", func(t *testing.T) {
		t.Run("and group argument is empty", func(t *testing.T) {
			t.Run("return Forbidden if user is not authorized to access any group in the folder", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				ruleStore.PutRule(context.Background(), gen.With(gen.WithNamespace(folder)).GenerateManyRef(1, 5)...)

				request := createRequestContextWithPerms(orgID, map[int64]map[string][]string{}, nil)

				response := createService(ruleStore).RouteDeleteAlertRules(request, folder.UID, "")
				require.Equalf(t, http.StatusForbidden, response.Status(), "Expected 403 but got %d: %v", response.Status(), string(response.Body()))

				require.Empty(t, getRecordedCommand(ruleStore))
			})
			t.Run("delete only non-provisioned groups that user is authorized", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				provisioningStore := fakes.NewFakeProvisioningStore()

				folderGen := gen.With(gen.WithNamespace(folder))

				authorizedRulesInFolder := folderGen.With(gen.WithGroupPrefix("authz-")).GenerateManyRef(1, 5)

				provisionedRulesInFolder := folderGen.With(gen.WithGroupPrefix("provisioned-")).GenerateManyRef(1, 5)
				for _, rule := range provisionedRulesInFolder {
					err := provisioningStore.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI)
					require.NoError(t, err)
				}

				ruleStore.PutRule(context.Background(), authorizedRulesInFolder...)
				ruleStore.PutRule(context.Background(), provisionedRulesInFolder...)
				// more rules in the same namespace but user does not have access to them
				ruleStore.PutRule(context.Background(), folderGen.With(gen.WithGroupPrefix("unauthz")).GenerateManyRef(1, 5)...)

				permissions := createPermissionsForRules(append(authorizedRulesInFolder, provisionedRulesInFolder...), orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createServiceWithProvenanceStore(ruleStore, provisioningStore).RouteDeleteAlertRules(requestCtx, folder.UID, "")

				require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
				assertRulesDeleted(t, authorizedRulesInFolder, ruleStore)
			})
			t.Run("return 400 if all rules user can access are provisioned", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				provisioningStore := fakes.NewFakeProvisioningStore()

				folderGen := gen.With(gen.WithNamespace(folder))

				provisionedRulesInFolder := folderGen.With(gen.WithSameGroup()).GenerateManyRef(1, 5)
				err := provisioningStore.SetProvenance(context.Background(), provisionedRulesInFolder[0], orgID, models.ProvenanceAPI)
				require.NoError(t, err)

				ruleStore.PutRule(context.Background(), provisionedRulesInFolder...)
				// more rules in the same namespace but user does not have access to them
				ruleStore.PutRule(context.Background(), folderGen.With(gen.WithSameGroup()).GenerateManyRef(1, 5)...)

				permissions := createPermissionsForRules(provisionedRulesInFolder, orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createServiceWithProvenanceStore(ruleStore, provisioningStore).RouteDeleteAlertRules(requestCtx, folder.UID, "")

				require.Equalf(t, 400, response.Status(), "Expected 400 but got %d: %v", response.Status(), string(response.Body()))
				require.Empty(t, getRecordedCommand(ruleStore))
			})
			t.Run("should return 202 if folder is empty", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)

				requestCtx := createRequestContext(orgID, nil)
				response := createService(ruleStore).RouteDeleteAlertRules(requestCtx, folder.UID, "")

				require.Equalf(t, 202, response.Status(), "Expected 202 but got %d: %v", response.Status(), string(response.Body()))
				require.Empty(t, getRecordedCommand(ruleStore))
			})
		})
		t.Run("and group argument is not empty", func(t *testing.T) {
			t.Run("return Forbidden if user is not authorized to access the group", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)

				groupGen := gen.With(gen.WithNamespace(folder), gen.WithSameGroup())

				authorizedRulesInGroup := groupGen.GenerateManyRef(1, 5)
				ruleStore.PutRule(context.Background(), authorizedRulesInGroup...)
				// more rules in the same group but user is not authorized to access them
				ruleStore.PutRule(context.Background(), groupGen.GenerateManyRef(1, 5)...)

				permissions := createPermissionsForRules(authorizedRulesInGroup, orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createService(ruleStore).RouteDeleteAlertRules(requestCtx, folder.UID, authorizedRulesInGroup[0].RuleGroup)

				require.Equalf(t, http.StatusForbidden, response.Status(), "Expected 403 but got %d: %v", response.Status(), string(response.Body()))
				deleteCommands := getRecordedCommand(ruleStore)
				require.Empty(t, deleteCommands)
			})
			t.Run("return 400 if group is provisioned", func(t *testing.T) {
				ruleStore := initFakeRuleStore(t)
				provisioningStore := fakes.NewFakeProvisioningStore()

				groupGen := gen.With(gen.WithNamespace(folder), gen.WithSameGroup())

				provisionedRulesInFolder := groupGen.GenerateManyRef(1, 5)
				err := provisioningStore.SetProvenance(context.Background(), provisionedRulesInFolder[0], orgID, models.ProvenanceAPI)
				require.NoError(t, err)

				ruleStore.PutRule(context.Background(), provisionedRulesInFolder...)

				permissions := createPermissionsForRules(provisionedRulesInFolder, orgID)
				requestCtx := createRequestContextWithPerms(orgID, permissions, nil)

				response := createServiceWithProvenanceStore(ruleStore, provisioningStore).RouteDeleteAlertRules(requestCtx, folder.UID, provisionedRulesInFolder[0].RuleGroup)

				require.Equalf(t, 400, response.Status(), "Expected 400 but got %d: %v", response.Status(), string(response.Body()))
				deleteCommands := getRecordedCommand(ruleStore)
				require.Empty(t, deleteCommands)
			})
		})
	})
}

func TestRouteGetNamespaceRulesConfig(t *testing.T) {
	gen := models.RuleGen
	t.Run("fine-grained access is enabled", func(t *testing.T) {
		t.Run("should return all rules, with or without data source access", func(t *testing.T) {
			orgID := rand.Int63()
			folder := randFolder()
			ruleStore := fakes.NewRuleStore(t)
			ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
			folderGen := gen.With(gen.WithOrgID(orgID), gen.WithNamespace(folder))
			queryAccessRules := folderGen.GenerateManyRef(2, 6)
			ruleStore.PutRule(context.Background(), queryAccessRules...)
			noQueryAccessRules := folderGen.GenerateManyRef(2, 6)
			ruleStore.PutRule(context.Background(), noQueryAccessRules...)

			allRules := make([]*models.AlertRule, 0, len(queryAccessRules)+len(noQueryAccessRules))
			allRules = append(allRules, queryAccessRules...)
			allRules = append(allRules, noQueryAccessRules...)

			permissions := createPermissionsForRules(queryAccessRules, orgID)
			req := createRequestContextWithPerms(orgID, permissions, nil)

			response := createService(ruleStore).RouteGetNamespaceRulesConfig(req, folder.UID)

			require.Equal(t, http.StatusAccepted, response.Status())
			result := &apimodels.NamespaceConfigResponse{}
			require.NoError(t, json.Unmarshal(response.Body(), result))
			require.NotNil(t, result)
			for namespace, groups := range *result {
				require.Equal(t, folder.Fullpath, namespace)
				for _, group := range groups {
				grouploop:
					for _, actualRule := range group.Rules {
						for i, expected := range allRules {
							if actualRule.GrafanaManagedAlert.UID == expected.UID {
								allRules = append(allRules[:i], allRules[i+1:]...)
								continue grouploop
							}
						}
						assert.Failf(t, "rule in a group was not found in expected", "rule %s group %s", actualRule.GrafanaManagedAlert.Title, group.Name)
					}
				}
			}
			assert.Emptyf(t, allRules, "not all expected rules were returned")
		})
	})
	t.Run("should return the provenance of the alert rules", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		expectedRules := gen.With(gen.WithOrgID(orgID), gen.WithNamespace(folder)).GenerateManyRef(2, 6)
		ruleStore.PutRule(context.Background(), expectedRules...)

		svc := createService(ruleStore)

		// add provenance to the first generated rule
		rule := &models.AlertRule{
			UID: expectedRules[0].UID,
		}
		err := svc.provenanceStore.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI)
		require.NoError(t, err)

		perms := createPermissionsForRules(expectedRules, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)
		response := svc.RouteGetNamespaceRulesConfig(req, folder.UID)

		require.Equal(t, http.StatusAccepted, response.Status())
		result := &apimodels.NamespaceConfigResponse{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)
		found := false
		for namespace, groups := range *result {
			require.Equal(t, folder.Fullpath, namespace)
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

		expectedRules := gen.With(gen.WithGroupKey(groupKey), gen.WithUniqueGroupIndex()).GenerateManyRef(5, 10)
		ruleStore.PutRule(context.Background(), expectedRules...)

		perms := createPermissionsForRules(expectedRules, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)
		response := createService(ruleStore).RouteGetNamespaceRulesConfig(req, folder.UID)

		require.Equal(t, http.StatusAccepted, response.Status())
		result := &apimodels.NamespaceConfigResponse{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)

		models.RulesGroup(expectedRules).SortByGroupIndex()

		groups, ok := (*result)[folder.Fullpath]
		require.True(t, ok)
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

func TestRouteGetRuleByUID(t *testing.T) {
	t.Run("rule is successfully fetched with the correct UID", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		groupKey := models.GenerateGroupKey(orgID)
		groupKey.NamespaceUID = folder.UID
		gen := models.RuleGen.With(models.RuleGen.WithGroupKey(groupKey))

		createdRules := gen.With(
			gen.WithUniqueGroupIndex(), gen.WithUniqueID(),
			gen.WithEditorSettingsSimplifiedQueryAndExpressionsSection(true),
			gen.WithEditorSettingsSimplifiedNotificationsSection(true),
		).GenerateManyRef(3)
		require.Len(t, createdRules, 3)
		ruleStore.PutRule(context.Background(), createdRules...)

		perms := createPermissionsForRules(createdRules, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)

		expectedRule := createdRules[1]
		response := createService(ruleStore).RouteGetRuleByUID(req, expectedRule.UID)

		require.Equal(t, http.StatusOK, response.Status())
		result := &apimodels.GettableExtendedRuleNode{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)

		require.Equal(t, expectedRule.UID, result.GrafanaManagedAlert.UID)
		require.Equal(t, expectedRule.RuleGroup, result.GrafanaManagedAlert.RuleGroup)
		require.Equal(t, expectedRule.Title, result.GrafanaManagedAlert.Title)
		require.True(t, result.GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection)
		require.True(t, result.GrafanaManagedAlert.Metadata.EditorSettings.SimplifiedNotificationsSection)

		t.Run("should resolve Updated_by with user service", func(t *testing.T) {
			testcases := []struct {
				desc             string
				UpdatedBy        *models.UserUID
				User             *user.User
				UserServiceError error
				Expected         *apimodels.UserInfo
			}{
				{
					desc:             "nil if UpdatedBy is nil",
					UpdatedBy:        nil,
					User:             nil,
					UserServiceError: nil,
					Expected:         nil,
				},
				{
					desc:             "just UID if user is not found",
					UpdatedBy:        util.Pointer(models.UserUID("test-uid")),
					User:             nil,
					UserServiceError: nil,
					Expected: &apimodels.UserInfo{
						UID: "test-uid",
					},
				},
				{
					desc:             "just UID if error",
					UpdatedBy:        util.Pointer(models.UserUID("test-uid")),
					UserServiceError: errors.New("error"),
					Expected: &apimodels.UserInfo{
						UID: "test-uid",
					},
				},
				{
					desc:      "login if it's known user",
					UpdatedBy: util.Pointer(models.UserUID("test-uid")),
					User: &user.User{
						Login: "Test",
					},
					UserServiceError: nil,
					Expected: &apimodels.UserInfo{
						UID:  "test-uid",
						Name: "Test",
					},
				},
				{
					desc:             "recognize system identifier (alerting)",
					UpdatedBy:        &models.AlertingUserUID,
					User:             nil,
					UserServiceError: nil,
					Expected: &apimodels.UserInfo{
						UID: string(models.AlertingUserUID),
					},
				},
				{
					desc:             "recognize system identifier (provisioning)",
					UpdatedBy:        &models.FileProvisioningUserUID,
					User:             nil,
					UserServiceError: nil,
					Expected: &apimodels.UserInfo{
						UID: string(models.FileProvisioningUserUID),
					},
				},
			}
			for _, tc := range testcases {
				t.Run(tc.desc, func(t *testing.T) {
					expectedRule.UpdatedBy = tc.UpdatedBy
					svc := createService(ruleStore)
					usvc := usertest.NewUserServiceFake()
					usvc.ExpectedUser = tc.User
					usvc.ExpectedError = tc.UserServiceError
					svc.userService = usvc

					response := svc.RouteGetRuleByUID(req, expectedRule.UID)

					require.Equal(t, http.StatusOK, response.Status())
					result := &apimodels.GettableExtendedRuleNode{}
					require.NoError(t, json.Unmarshal(response.Body(), result))
					require.NotNil(t, result)

					require.Equal(t, tc.Expected, result.GrafanaManagedAlert.UpdatedBy)
				})
			}
		})
	})

	t.Run("error when fetching rule with non-existent UID", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		groupKey := models.GenerateGroupKey(orgID)
		groupKey.NamespaceUID = folder.UID
		gen := models.RuleGen.With(models.RuleGen.WithGroupKey(groupKey))

		createdRules := gen.With(gen.WithUniqueGroupIndex(), gen.WithUniqueID()).GenerateManyRef(3)
		require.Len(t, createdRules, 3)
		ruleStore.PutRule(context.Background(), createdRules...)

		perms := createPermissionsForRules(createdRules, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)
		response := createService(ruleStore).RouteGetRuleByUID(req, "foobar")

		require.Equal(t, http.StatusNotFound, response.Status())
	})
}

func TestRouteGetRuleHistoryByUID(t *testing.T) {
	orgID := rand.Int63()
	f := randFolder()
	groupKey := models.GenerateGroupKey(orgID)
	groupKey.NamespaceUID = f.UID
	gen := models.RuleGen.With(models.RuleGen.WithGroupKey(groupKey), models.RuleGen.WithUniqueID())

	t.Run("rule history is successfully fetched with the correct UID", func(t *testing.T) {
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], f)

		rule := gen.GenerateRef()
		history := gen.With(gen.WithUID(rule.UID)).GenerateManyRef(3)
		// simulate order of the history
		rule.ID = 100
		for i, alertRule := range history {
			alertRule.ID = rule.ID - int64(i) - 1
		}

		ruleStore.PutRule(context.Background(), rule)
		ruleStore.History[rule.GUID] = append(ruleStore.History[rule.GUID], history...)

		perms := createPermissionsForRules([]*models.AlertRule{rule}, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)

		svc := createService(ruleStore)
		response := svc.RouteGetRuleVersionsByUID(req, rule.UID)

		require.Equal(t, http.StatusOK, response.Status())
		var result apimodels.GettableRuleVersions
		require.NoError(t, json.Unmarshal(response.Body(), &result))
		require.NotNil(t, result)

		require.Len(t, result, len(history)+1) // history + current version

		t.Run("should be in correct order", func(t *testing.T) {
			expectedHistory := append([]*models.AlertRule{rule}, history...)
			for i, rul := range expectedHistory {
				assert.Equal(t, rul.UID, result[i].GrafanaManagedAlert.UID)
			}
		})
	})

	t.Run("NotFound when rule does not exist", func(t *testing.T) {
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], f)
		ruleKey := models.AlertRuleKey{
			OrgID: orgID,
			UID:   "test",
		}
		guid := uuid.NewString()
		history := gen.With(gen.WithGUID(guid), gen.WithKey(ruleKey)).GenerateManyRef(3)
		ruleStore.History[guid] = append(ruleStore.History[guid], history...) // even if history is full of records

		perms := createPermissionsForRules(history, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)
		response := createService(ruleStore).RouteGetRuleVersionsByUID(req, ruleKey.UID)

		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("Empty result when rule history is empty", func(t *testing.T) {
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], f)
		ruleKey := models.AlertRuleKey{
			OrgID: orgID,
			UID:   "test",
		}
		guid := uuid.NewString()
		rule := gen.With(gen.WithKey(ruleKey), gen.WithGUID(guid)).GenerateRef()
		ruleStore.PutRule(context.Background(), rule)
		ruleStore.History[guid] = nil

		perms := createPermissionsForRules([]*models.AlertRule{rule}, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)
		response := createService(ruleStore).RouteGetRuleVersionsByUID(req, ruleKey.UID)

		require.Equal(t, http.StatusOK, response.Status())

		var result apimodels.GettableRuleVersions
		require.NoError(t, json.Unmarshal(response.Body(), &result))
		require.Empty(t, result)
	})

	t.Run("Unauthorized if user does not have access to the current rule", func(t *testing.T) {
		ruleStore := fakes.NewRuleStore(t)
		anotherFolder := randFolder()
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], f, anotherFolder)
		ruleKey := models.AlertRuleKey{
			OrgID: orgID,
			UID:   "test",
		}
		guid := uuid.NewString()
		rule := gen.With(gen.WithGUID(guid), gen.WithKey(ruleKey), gen.WithNamespaceUID(anotherFolder.UID)).GenerateRef()
		ruleStore.PutRule(context.Background(), rule)
		history := gen.With(gen.WithGUID(guid), gen.WithKey(ruleKey)).GenerateManyRef(3)
		ruleStore.History[guid] = history

		perms := createPermissionsForRules(history, orgID) // grant permissions to all records in history but not the rule itself
		req := createRequestContextWithPerms(orgID, perms, nil)
		response := createService(ruleStore).RouteGetRuleVersionsByUID(req, ruleKey.UID)

		require.Equal(t, http.StatusForbidden, response.Status())
	})
}

func TestRouteGetRulesConfig(t *testing.T) {
	gen := models.RuleGen
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

			group1 := gen.With(gen.WithGroupKey(group1Key)).GenerateManyRef(2, 6)
			group2 := gen.With(gen.WithGroupKey(group2Key)).GenerateManyRef(2, 6)
			ruleStore.PutRule(context.Background(), append(group1, group2...)...)

			t.Run("and do not return group if user does not have access to one of rules", func(t *testing.T) {
				permissions := createPermissionsForRules(append(group1, group2[1:]...), orgID)
				request := createRequestContextWithPerms(orgID, permissions, nil)

				response := createService(ruleStore).RouteGetRulesConfig(request)
				require.Equal(t, http.StatusOK, response.Status())

				result := &apimodels.NamespaceConfigResponse{}
				require.NoError(t, json.Unmarshal(response.Body(), result))
				require.NotNil(t, result)

				require.Contains(t, *result, folder1.Fullpath)
				require.NotContains(t, *result, folder2.UID)

				groups := (*result)[folder1.Fullpath]
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

		expectedRules := gen.With(gen.WithGroupKey(groupKey), gen.WithUniqueGroupIndex()).GenerateManyRef(5, 10)
		ruleStore.PutRule(context.Background(), expectedRules...)

		perms := createPermissionsForRules(expectedRules, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)
		response := createService(ruleStore).RouteGetRulesConfig(req)

		require.Equal(t, http.StatusOK, response.Status())
		result := &apimodels.NamespaceConfigResponse{}
		require.NoError(t, json.Unmarshal(response.Body(), result))
		require.NotNil(t, result)

		models.RulesGroup(expectedRules).SortByGroupIndex()

		groups, ok := (*result)[folder.Fullpath]
		require.True(t, ok)
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
	gen := models.RuleGen
	t.Run("should return rules in group sorted by group index", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		groupKey := models.GenerateGroupKey(orgID)
		groupKey.NamespaceUID = folder.UID

		expectedRules := gen.With(gen.WithGroupKey(groupKey), gen.WithUniqueGroupIndex()).GenerateManyRef(5, 10)
		ruleStore.PutRule(context.Background(), expectedRules...)

		perms := createPermissionsForRules(expectedRules, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)

		response := createService(ruleStore).RouteGetRulesGroupConfig(req, folder.UID, groupKey.RuleGroup)

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
	t.Run("should return a 404 when fetching a group that doesn't exist", func(t *testing.T) {
		orgID := rand.Int63()
		folder := randFolder()
		ruleStore := fakes.NewRuleStore(t)
		ruleStore.Folders[orgID] = append(ruleStore.Folders[orgID], folder)
		groupKey := models.GenerateGroupKey(orgID)
		groupKey.NamespaceUID = folder.UID

		expectedRules := gen.With(gen.WithGroupKey(groupKey), gen.WithUniqueGroupIndex()).GenerateManyRef(5, 10)
		ruleStore.PutRule(context.Background(), expectedRules...)

		perms := createPermissionsForRules(expectedRules, orgID)
		req := createRequestContextWithPerms(orgID, perms, nil)

		response := createService(ruleStore).RouteGetRulesGroupConfig(req, folder.UID, "non-existent-rule-group")

		require.Equal(t, http.StatusNotFound, response.Status())
	})
}

func TestVerifyProvisionedRulesNotAffected(t *testing.T) {
	orgID := rand.Int63()
	group := models.GenerateGroupKey(orgID)
	affectedGroups := make(map[models.AlertRuleGroupKey]models.RulesGroup)
	gen := models.RuleGen
	var allRules []*models.AlertRule
	{
		rules := gen.With(gen.WithGroupKey(group)).GenerateManyRef(1, 4)
		allRules = append(allRules, rules...)
		affectedGroups[group] = rules
		for i := 0; i < rand.Intn(3)+1; i++ {
			g := models.GenerateGroupKey(orgID)
			rules := gen.With(gen.WithGroupKey(g)).GenerateManyRef(1, 4)
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
	gen := models.RuleGen
	delta := store.GroupDelta{
		New: []*models.AlertRule{
			gen.With(gen.WithCondition("New")).GenerateRef(),
		},
		Update: []store.RuleDelta{
			{
				Existing: gen.With(gen.WithCondition("New")).GenerateRef(),
				New:      gen.With(gen.WithCondition("Update_New")).GenerateRef(),
				Diff: cmputil.DiffReport{
					cmputil.Diff{
						Path: "SomeField",
					},
				},
			},
			{
				Existing: gen.With(gen.WithCondition("Update_Index_Existing")).GenerateRef(),
				New:      gen.With(gen.WithCondition("Update_Index_New")).GenerateRef(),
				Diff: cmputil.DiffReport{
					cmputil.Diff{
						Path: "RuleGroupIndex",
					},
				},
			},
		},
		Delete: gen.With(gen.WithCondition("Deleted")).GenerateManyRef(1),
	}

	t.Run("should not validate deleted rules or updated rules with ignored fields", func(t *testing.T) {
		validator := &recordingConditionValidator{}
		err := validateQueries(context.Background(), &delta, validator, nil)
		require.NoError(t, err)
		noValidate := []string{"Deleted", "Update_Index_New"}
		for _, condition := range validator.recorded {
			if !slices.Contains(noValidate, condition.Condition) {
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
		provenanceStore: fakes.NewFakeProvisioningStore(),
		log:             log.New("test"),
		cfg: &setting.UnifiedAlertingSettings{
			BaseInterval: 10 * time.Second,
		},
		authz:          accesscontrol.NewRuleService(acimpl.ProvideAccessControl(featuremgmt.WithFeatures())),
		amConfigStore:  &fakeAMRefresher{},
		amRefresher:    &fakeAMRefresher{},
		featureManager: featuremgmt.WithFeatures(featuremgmt.FlagGrafanaManagedRecordingRules),
		userService:    usertest.NewUserServiceFake(),
	}
}

type fakeAMRefresher struct {
}

func (f *fakeAMRefresher) ApplyConfig(ctx context.Context, orgId int64, dbConfig *models.AlertConfiguration) error {
	return nil
}

func (f *fakeAMRefresher) GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error) {
	return nil, nil
}

func createRequestContext(orgID int64, params map[string]string) *contextmodel.ReqContext {
	defaultPerms := map[int64]map[string][]string{orgID: {datasources.ActionQuery: []string{datasources.ScopeAll}}}
	return createRequestContextWithPerms(orgID, defaultPerms, params)
}

func createRequestContextWithPerms(orgID int64, permissions map[int64]map[string][]string, params map[string]string) *contextmodel.ReqContext {
	uri, _ := url.Parse("http://localhost")
	ctx := web.Context{
		Req: &http.Request{
			URL:    uri,
			Header: make(http.Header),
			Form:   make(url.Values),
		},
		Resp: web.NewResponseWriter("GET", httptest.NewRecorder()),
	}
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
	ns := map[string]any{}
	permissions := map[string][]string{}
	for _, rule := range rules {
		if _, ok := ns[rule.NamespaceUID]; !ok {
			scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.NamespaceUID)
			permissions[dashboards.ActionFoldersRead] = append(permissions[dashboards.ActionFoldersRead], scope)
			permissions[ac.ActionAlertingRuleRead] = append(permissions[ac.ActionAlertingRuleRead], scope)
			ns[rule.NamespaceUID] = struct{}{}
		}
		for _, query := range rule.Data {
			permissions[datasources.ActionQuery] = append(permissions[datasources.ActionQuery], datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))
		}
	}
	return map[int64]map[string][]string{orgID: permissions}
}
