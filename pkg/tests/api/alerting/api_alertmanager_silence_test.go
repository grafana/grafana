package alerting

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationSilenceAuth(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	adminApiClient := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	// Create the namespace we'll save our alerts to.
	f1 := folder.Folder{
		UID:   util.GenerateShortUID(),
		Title: "Folder 1",
	}
	adminApiClient.CreateFolder(t, f1.UID, f1.Title)
	f2 := folder.Folder{
		UID:   util.GenerateShortUID(),
		Title: "Folder 2",
	}
	adminApiClient.CreateFolder(t, f2.UID, f2.Title)

	group1 := generateAlertRuleGroup(1, alertRuleGen())
	group2 := generateAlertRuleGroup(1, alertRuleGen())

	respModel, status, _ := adminApiClient.PostRulesGroupWithStatus(t, f1.UID, &group1, false)
	require.Equal(t, http.StatusAccepted, status)
	ruleInFolder1UID := respModel.Created[0]
	respModel, status, _ = adminApiClient.PostRulesGroupWithStatus(t, f2.UID, &group2, false)
	require.Equal(t, http.StatusAccepted, status)
	ruleInFolder2UID := respModel.Created[0]

	type silenceAction string
	const (
		readSilence   silenceAction = "read"
		createSilence silenceAction = "create"
		updateSilence silenceAction = "update"
		deleteSilence silenceAction = "delete"
	)

	type silenceType string
	const (
		generalSilence       silenceType = "generalSilence"
		ruleSilenceInFolder1 silenceType = "ruleSilenceInFolder1"
		ruleSilenceInFolder2 silenceType = "ruleSilenceInFolder2"
	)

	silenceGens := map[silenceType]func() ngmodels.Silence{
		generalSilence:       ngmodels.SilenceGen(),
		ruleSilenceInFolder1: ngmodels.SilenceGen(ngmodels.SilenceMuts.WithMatcher(models.RuleUIDLabel, ruleInFolder1UID, labels.MatchEqual)),
		ruleSilenceInFolder2: ngmodels.SilenceGen(ngmodels.SilenceMuts.WithMatcher(models.RuleUIDLabel, ruleInFolder2UID, labels.MatchEqual)),
	}

	defaultStatus := map[silenceAction]map[bool]int{
		updateSilence: {true: http.StatusAccepted, false: http.StatusForbidden},
		deleteSilence: {true: http.StatusOK, false: http.StatusForbidden},
		createSilence: {true: http.StatusAccepted, false: http.StatusForbidden},
		readSilence:   {true: http.StatusOK, false: http.StatusForbidden},
	}

	testCases := []struct {
		name             string
		orgRole          org.RoleType // default RoleNone
		permissions      []resourcepermissions.SetResourcePermissionCommand
		defaultAllowed   bool                                  // Default allowed/forbidden for actions not in statusExceptions.
		statusExceptions map[silenceType]map[silenceAction]int // Exceptions to defaultAllowed.
		listContents     []silenceType                         // nil = forbidden.
	}{
		// OSS Builtins
		{
			name:    "Viewer permissions",
			orgRole: org.RoleViewer,
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder1: {readSilence: http.StatusOK},
				ruleSilenceInFolder2: {readSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		{
			name:    "Viewer permissions with elevated access to folder1",
			orgRole: org.RoleViewer,
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: ossaccesscontrol.FolderEditActions, Resource: "folders", ResourceAttribute: "uid", ResourceID: f1.UID},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder1: {readSilence: http.StatusOK, updateSilence: http.StatusAccepted, createSilence: http.StatusAccepted, deleteSilence: http.StatusOK},
				ruleSilenceInFolder2: {readSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		{
			name:           "Editor permissions",
			orgRole:        org.RoleEditor,
			defaultAllowed: true,
			listContents:   []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		{
			name:           "Admin permissions",
			orgRole:        org.RoleAdmin,
			defaultAllowed: true,
			listContents:   []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		// RBAC
		{
			name:    "No permissions",
			orgRole: org.RoleNone,
		},
		{
			name: "Global read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingInstanceRead}},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder1: {readSilence: http.StatusOK},
				ruleSilenceInFolder2: {readSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		{
			name: "Global read + create permissions",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingInstanceRead,
					accesscontrol.ActionAlertingInstanceCreate,
				}},
			},
			defaultAllowed: true,
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {updateSilence: http.StatusForbidden, deleteSilence: http.StatusForbidden},
				ruleSilenceInFolder1: {updateSilence: http.StatusForbidden, deleteSilence: http.StatusForbidden},
				ruleSilenceInFolder2: {updateSilence: http.StatusForbidden, deleteSilence: http.StatusForbidden},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		{
			name: "Global read + update permissions",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingInstanceRead,
					accesscontrol.ActionAlertingInstanceUpdate,
				}},
			},
			defaultAllowed: true,
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {createSilence: http.StatusForbidden},
				ruleSilenceInFolder1: {createSilence: http.StatusForbidden},
				ruleSilenceInFolder2: {createSilence: http.StatusForbidden},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		{
			name: "Global read + update + create permissions",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingInstanceRead,
					accesscontrol.ActionAlertingInstanceUpdate,
					accesscontrol.ActionAlertingInstanceCreate,
				}},
			},
			defaultAllowed: true,
			listContents:   []silenceType{generalSilence, ruleSilenceInFolder1, ruleSilenceInFolder2},
		},
		{
			name: "Global update + create permissions, missing read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingInstanceUpdate,
					accesscontrol.ActionAlertingInstanceCreate,
				}},
			},
		},
		{
			name: "Silence read in folder1",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingSilencesRead}, Resource: "folders", ResourceAttribute: "uid", ResourceID: f1.UID},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder1: {readSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1},
		},
		{
			name: "Silence read in folder2",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingSilencesRead}, Resource: "folders", ResourceAttribute: "uid", ResourceID: f2.UID},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder2: {readSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder2},
		},
		{
			name: "Silence read + create in folder1",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingSilencesRead,
					accesscontrol.ActionAlertingSilencesCreate,
				}, Resource: "folders", ResourceAttribute: "uid", ResourceID: f1.UID},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder1: {readSilence: http.StatusOK, createSilence: http.StatusAccepted},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1},
		},
		{
			name: "Silence read + write in folder1",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingSilencesRead,
					accesscontrol.ActionAlertingSilencesWrite,
				}, Resource: "folders", ResourceAttribute: "uid", ResourceID: f1.UID},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder1: {readSilence: http.StatusOK, updateSilence: http.StatusAccepted, deleteSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1},
		},
		{
			name: "Silence read + write + create in folder1",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingSilencesRead,
					accesscontrol.ActionAlertingSilencesWrite,
					accesscontrol.ActionAlertingSilencesCreate,
				}, Resource: "folders", ResourceAttribute: "uid", ResourceID: f1.UID},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence:       {readSilence: http.StatusOK},
				ruleSilenceInFolder1: {readSilence: http.StatusOK, updateSilence: http.StatusAccepted, createSilence: http.StatusAccepted, deleteSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence, ruleSilenceInFolder1},
		},
		{
			name: "Silence read + write + create in other folder",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{
					accesscontrol.ActionAlertingSilencesRead,
					accesscontrol.ActionAlertingSilencesWrite,
					accesscontrol.ActionAlertingSilencesCreate,
				}, Resource: "folders", ResourceAttribute: "uid", ResourceID: "unknown"},
			},
			statusExceptions: map[silenceType]map[silenceAction]int{
				generalSilence: {readSilence: http.StatusOK},
			},
			listContents: []silenceType{generalSilence},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			randomLogin := util.GenerateShortUID()
			orgRole := org.RoleNone
			if tt.orgRole != "" {
				orgRole = tt.orgRole
			}
			testUserId := createUser(t, env.SQLStore, env.SettingsProvider, user.CreateUserCommand{
				DefaultOrgRole: string(orgRole),
				Password:       user.Password(randomLogin),
				Login:          randomLogin,
			})

			apiClient := newAlertingApiClient(grafanaListedAddr, randomLogin, randomLogin)

			// Set permissions.
			permissionsStore := resourcepermissions.NewStore(env.SettingsProvider, env.SQLStore, featuremgmt.WithFeatures())
			for _, cmd := range tt.permissions {
				_, err := permissionsStore.SetUserResourcePermission(
					context.Background(),
					1,
					accesscontrol.User{ID: testUserId},
					cmd,
					nil,
				)
				require.NoError(t, err)
			}
			apiClient.ReloadCachedPermissions(t)

			expectedStatus := func(sType silenceType, action silenceAction) int {
				expectedStatus, ok := defaultStatus[action][tt.defaultAllowed]
				require.True(t, ok, "No default status for action")
				if st, ok := tt.statusExceptions[sType][action]; ok {
					expectedStatus = st
				}
				return expectedStatus
			}

			persistSilence := func(gen func() ngmodels.Silence) apimodels.PostableSilence {
				silence := *notifier.SilenceToPostableSilence(gen())
				silence.ID = ""
				okBody, status, _ := adminApiClient.PostSilence(t, silence)
				require.Equal(t, http.StatusAccepted, status)
				require.NotEmpty(t, okBody.SilenceID)
				silence.ID = okBody.SilenceID
				return silence
			}

			tests := map[silenceAction]func(func() ngmodels.Silence, silenceType) (int, string){
				readSilence: func(gen func() ngmodels.Silence, sType silenceType) (int, string) {
					silence := persistSilence(gen)
					_, status, body := apiClient.GetSilence(t, silence.ID)
					return status, body
				},
				createSilence: func(gen func() ngmodels.Silence, sType silenceType) (int, string) {
					silence := *notifier.SilenceToPostableSilence(gen())
					silence.ID = ""
					_, status, body := apiClient.PostSilence(t, silence)
					return status, body
				},
				updateSilence: func(gen func() ngmodels.Silence, sType silenceType) (int, string) {
					silence := persistSilence(gen)
					_, status, body := apiClient.PostSilence(t, silence)
					return status, body
				},
				deleteSilence: func(gen func() ngmodels.Silence, sType silenceType) (int, string) {
					silence := persistSilence(gen)
					_, status, body := apiClient.DeleteSilence(t, silence.ID)
					return status, body
				},
			}

			for action, test := range tests {
				t.Run(string(action), func(t *testing.T) {
					for sType, gen := range silenceGens {
						expected := expectedStatus(sType, action)
						t.Run(fmt.Sprintf("Silence: %s, Access: %d", sType, expected), func(t *testing.T) {
							status, body := test(gen, sType)
							t.Log(body)
							require.Equal(t, expected, status)
						})
					}
				})
			}

			t.Run("List contents", func(t *testing.T) {
				ids := make(map[silenceType]string)
				idToStype := make(map[string]silenceType)

				// We Create new silences with a unique label. This is both to test the filter param and to
				// simplify the test by having a known set of silences to list.
				filterLabel := util.GenerateShortUID()
				for sType, gen := range silenceGens {
					genWithFilterLabels := func() ngmodels.Silence {
						return ngmodels.CopySilenceWith(gen(), ngmodels.SilenceMuts.WithMatcher(filterLabel, filterLabel, labels.MatchEqual))
					}
					silence := persistSilence(genWithFilterLabels)
					ids[sType] = silence.ID
					idToStype[silence.ID] = sType
				}
				silences, status, body := apiClient.GetSilences(t, fmt.Sprintf("%s=%s", filterLabel, filterLabel))
				t.Log(body)
				if tt.listContents == nil {
					require.Equal(t, http.StatusForbidden, status)
					return
				}
				require.Equal(t, http.StatusOK, status)

				idsInBody := make(map[string]struct{})
				for _, s := range silences {
					idsInBody[*s.ID] = struct{}{}
				}

				for _, sType := range tt.listContents {
					id, ok := ids[sType]
					require.True(t, ok)
					assert.Containsf(t, idsInBody, id, "Silence of type %s not found in list", sType)
				}

				for _, s := range silences {
					sType, ok := idToStype[*s.ID]
					require.True(t, ok, "Unknown listed silence %s", *s.ID)
					assert.Containsf(t, tt.listContents, sType, "Silence of type %s should not be found in list", sType)
				}
				assert.Len(t, silences, len(tt.listContents), "Listed silences count mismatch")
			})
		})
	}
}
