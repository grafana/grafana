package alerting

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type provisioningTestCase struct {
	name        string
	orgRole     org.RoleType
	permissions []resourcepermissions.SetResourcePermissionCommand
	canRead     bool
	canCreate   bool
	canUpdate   bool
	canDelete   bool
}

type provisioningTestEnv struct {
	grafanaListedAddr string
	adminClient       apiClient
	permissionsStore  resourcepermissions.Store
	env               *server.TestEnv
}

func setupProvisioningAccessControlTest(t *testing.T) provisioningTestEnv {
	t.Helper()

	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	return provisioningTestEnv{
		grafanaListedAddr: grafanaListedAddr,
		adminClient:       newAlertingApiClient(grafanaListedAddr, "admin", "admin"),
		permissionsStore:  resourcepermissions.NewStore(env.Cfg, env.SQLStore, featuremgmt.WithFeatures()),
		env:               env,
	}
}

func (e provisioningTestEnv) createUserAndClient(t *testing.T, tc provisioningTestCase) apiClient {
	t.Helper()

	login := util.GenerateShortUID()
	orgRole := org.RoleNone
	if tc.orgRole != "" {
		orgRole = tc.orgRole
	}
	userID := createUser(t, e.env.SQLStore, e.env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(orgRole),
		Password:       user.Password(login),
		Login:          login,
	})

	for _, cmd := range tc.permissions {
		_, err := e.permissionsStore.SetUserResourcePermission(
			context.Background(),
			1,
			accesscontrol.User{ID: userID},
			cmd,
			nil,
		)
		require.NoError(t, err)
	}

	client := newAlertingApiClient(e.grafanaListedAddr, login, login)
	client.ReloadCachedPermissions(t)
	return client
}

func TestIntegrationProvisioningContactPointsAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		// Built-in roles.
		{name: "no permissions"},
		{name: "Viewer", orgRole: org.RoleViewer, canRead: true},
		{name: "Editor", orgRole: org.RoleEditor, canRead: true, canCreate: true, canUpdate: true, canDelete: true},
		{name: "Admin", orgRole: org.RoleAdmin, canRead: true, canCreate: true, canUpdate: true, canDelete: true},
		// Fine-grained RBAC: receiver permissions.
		{
			name: "receivers read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingReceiversRead}, Resource: "receivers", ResourceAttribute: "uid", ResourceID: "*"},
			},
			canRead: true,
		},
		{
			name: "receivers create + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingReceiversCreate, accesscontrol.ActionAlertingProvisioningSetStatus}},
			},
			canCreate: true,
		},
		{
			name: "receivers read + create + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversCreate, accesscontrol.ActionAlertingProvisioningSetStatus}, Resource: "receivers", ResourceAttribute: "uid", ResourceID: "*"},
			},
			canRead: true, canCreate: true,
		},
		{
			name: "receivers read + update + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingProvisioningSetStatus}, Resource: "receivers", ResourceAttribute: "uid", ResourceID: "*"},
			},
			canRead: true, canUpdate: true,
		},
		{
			name: "receivers read + delete + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversDelete, accesscontrol.ActionAlertingProvisioningSetStatus}, Resource: "receivers", ResourceAttribute: "uid", ResourceID: "*"},
			},
			canRead: true, canDelete: true,
		},
		// Legacy notification permissions.
		{
			name:        "legacy notifications read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead}}},
			canRead:     true,
		},
		{
			name:        "legacy notifications read + write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead, accesscontrol.ActionAlertingNotificationsWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canCreate: true, canUpdate: true, canDelete: true,
		},
		// Provisioning-scoped permissions.
		{
			name:        "provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningWrite}}},
			canCreate:   true,
		},
		{
			name:        "provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead, accesscontrol.ActionAlertingProvisioningWrite}}},
			canRead:     true, canCreate: true, canUpdate: true, canDelete: true,
		},
		{
			name:        "notifications provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "notifications provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canCreate:   true,
		},
		{
			name:        "notifications provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead, accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canRead:     true, canCreate: true, canUpdate: true, canDelete: true,
		},
	}

	generateContactPoint := func(name string) definitions.EmbeddedContactPoint {
		integration := ngmodels.IntegrationGen(
			ngmodels.IntegrationMuts.WithValidConfig("email"),
			ngmodels.IntegrationMuts.WithUID(""),
			ngmodels.IntegrationMuts.WithName(name),
		)()
		return provisioning.GrafanaIntegrationConfigToEmbeddedContactPoint(&integration, ngmodels.ProvenanceAPI)
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			client := e.createUserAndClient(t, tc)

			t.Run("GET", func(t *testing.T) {
				_, status, body := client.GetContactPointsWithStatus(t)
				if tc.canRead {
					require.Equalf(t, http.StatusOK, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("POST", func(t *testing.T) {
				cp := generateContactPoint(fmt.Sprintf("cp-%s", tc.name))
				created, status, body := client.CreateContactPointWithStatus(t, cp)
				if !tc.canCreate {
					require.Equalf(t, http.StatusForbidden, status, body)
					return
				}
				require.Equalf(t, http.StatusAccepted, status, body)

				if tc.canRead {
					t.Run("should be able to read created", func(t *testing.T) {
						res, status, body := client.GetContactPointsByNameWithStatus(t, cp.Name)
						require.Equalf(t, http.StatusOK, status, body)
						require.Len(t, res, 1)
					})
				}
				if tc.canUpdate {
					t.Run("should be able to update created", func(t *testing.T) {
						created.Settings.Set("message", "updated_message")
						status, body := client.UpdateContactPointWithStatus(t, created.UID, created)
						require.Equalf(t, http.StatusAccepted, status, body)
					})
				}
				if tc.canDelete {
					t.Run("should be able to delete created", func(t *testing.T) {
						status, body := client.DeleteContactPointWithStatus(t, created.UID)
						require.Equalf(t, http.StatusAccepted, status, body)
					})
				}
			})

			// Create a contact point as admin for PUT and DELETE tests.
			existing, status, body := e.adminClient.CreateContactPointWithStatus(t, generateContactPoint(fmt.Sprintf("cp-for-%s", tc.name)))
			require.Equalf(t, http.StatusAccepted, status, body)

			t.Run("PUT", func(t *testing.T) {
				existing.Settings.Set("message", "updated_message")
				status, body := client.UpdateContactPointWithStatus(t, existing.UID, existing)
				if tc.canUpdate {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("DELETE", func(t *testing.T) {
				status, body := client.DeleteContactPointWithStatus(t, existing.UID)
				if tc.canDelete {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})
		})
	}
}

func TestIntegrationProvisioningTemplatesAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		// Built-in roles.
		{name: "no permissions"},
		{name: "Viewer", orgRole: org.RoleViewer, canRead: true},
		{name: "Editor", orgRole: org.RoleEditor, canRead: true, canUpdate: true, canDelete: true},
		{name: "Admin", orgRole: org.RoleAdmin, canRead: true, canUpdate: true, canDelete: true},
		// Fine-grained RBAC: template permissions.
		{
			name:        "templates read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTemplatesRead}}},
			canRead:     true,
		},
		{
			name:        "templates write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTemplatesWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canUpdate:   true,
		},
		{
			name:        "templates read + write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTemplatesRead, accesscontrol.ActionAlertingNotificationsTemplatesWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canUpdate: true,
		},
		{
			name:        "templates delete + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTemplatesDelete, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canDelete:   true,
		},
		{
			name:        "templates read + delete + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTemplatesRead, accesscontrol.ActionAlertingNotificationsTemplatesDelete, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canDelete: true,
		},
		// Legacy notification permissions.
		{
			name:        "legacy notifications read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead}}},
			canRead:     true,
		},
		{
			name:        "legacy notifications read + write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead, accesscontrol.ActionAlertingNotificationsWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canUpdate: true, canDelete: true,
		},
		// Provisioning-scoped permissions.
		{
			name:        "provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningWrite}}},
			canUpdate:   true, canDelete: true,
		},
		{
			name:        "provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead, accesscontrol.ActionAlertingProvisioningWrite}}},
			canRead:     true, canUpdate: true, canDelete: true,
		},
		{
			name:        "notifications provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "notifications provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canUpdate:   true, canDelete: true,
		},
		{
			name:        "notifications provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead, accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canRead:     true, canUpdate: true, canDelete: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			client := e.createUserAndClient(t, tc)

			t.Run("GET list", func(t *testing.T) {
				_, status, body := client.GetTemplatesWithStatus(t)
				if tc.canRead {
					require.Equalf(t, http.StatusOK, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			// Create a template as admin for GET-by-name, PUT, and DELETE tests.
			tmplName := fmt.Sprintf("tmpl-%s", tc.name)
			_, status, body := e.adminClient.PutTemplateWithStatus(t, tmplName, definitions.NotificationTemplateContent{
				Template: fmt.Sprintf(`{{ define "%s" }}test{{ end }}`, tmplName),
			})
			require.Equalf(t, http.StatusAccepted, status, body)

			t.Run("GET by name", func(t *testing.T) {
				_, status, body := client.GetTemplateByNameWithStatus(t, tmplName)
				if tc.canRead {
					require.Equalf(t, http.StatusOK, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("PUT", func(t *testing.T) {
				_, status, body := client.PutTemplateWithStatus(t, tmplName, definitions.NotificationTemplateContent{
					Template: fmt.Sprintf(`{{ define "%s" }}updated{{ end }}`, tmplName),
				})
				if tc.canUpdate {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("DELETE", func(t *testing.T) {
				status, body := client.DeleteTemplateWithStatus(t, tmplName)
				if tc.canDelete {
					require.Equalf(t, http.StatusNoContent, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})
		})
	}
}

func TestIntegrationProvisioningMuteTimingsAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		// Built-in roles.
		{name: "no permissions"},
		{name: "Viewer", orgRole: org.RoleViewer, canRead: true},
		{name: "Editor", orgRole: org.RoleEditor, canRead: true, canCreate: true, canUpdate: true, canDelete: true},
		{name: "Admin", orgRole: org.RoleAdmin, canRead: true, canCreate: true, canUpdate: true, canDelete: true},
		// Fine-grained RBAC: time-interval permissions.
		{
			name:        "time-intervals read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTimeIntervalsRead}}},
			canRead:     true,
		},
		{
			name:        "time-intervals write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canCreate:   true, canUpdate: true,
		},
		{
			name:        "time-intervals read + write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTimeIntervalsRead, accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canCreate: true, canUpdate: true,
		},
		{
			name:        "time-intervals delete + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTimeIntervalsDelete, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canDelete:   true,
		},
		{
			name:        "time-intervals read + write + delete + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsTimeIntervalsRead, accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite, accesscontrol.ActionAlertingNotificationsTimeIntervalsDelete, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canCreate: true, canUpdate: true, canDelete: true,
		},
		// Legacy notification permissions.
		{
			name:        "legacy notifications read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead}}},
			canRead:     true,
		},
		{
			name:        "legacy notifications read + write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead, accesscontrol.ActionAlertingNotificationsWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canCreate: true, canUpdate: true, canDelete: true,
		},
		// Provisioning-scoped permissions.
		{
			name:        "provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningWrite}}},
			canCreate:   true, canUpdate: true, canDelete: true,
		},
		{
			name:        "provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead, accesscontrol.ActionAlertingProvisioningWrite}}},
			canRead:     true, canCreate: true, canUpdate: true, canDelete: true,
		},
		{
			name:        "notifications provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "notifications provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canCreate:   true, canUpdate: true, canDelete: true,
		},
		{
			name:        "notifications provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead, accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canRead:     true, canCreate: true, canUpdate: true, canDelete: true,
		},
	}

	newMuteTiming := func(name string) definitions.MuteTimeInterval {
		return definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name:          name,
				TimeIntervals: []timeinterval.TimeInterval{},
			},
		}
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			client := e.createUserAndClient(t, tc)

			t.Run("GET list", func(t *testing.T) {
				_, status, body := client.GetAllMuteTimingsWithStatus(t)
				if tc.canRead {
					require.Equalf(t, http.StatusOK, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("POST", func(t *testing.T) {
				mt := newMuteTiming(fmt.Sprintf("mt-%s", tc.name))
				_, status, body := client.CreateMuteTimingWithStatus(t, mt)
				if tc.canCreate {
					require.Equalf(t, http.StatusCreated, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			// Create a mute timing as admin for GET-by-name, PUT, and DELETE tests.
			mtName := fmt.Sprintf("mt-for-%s", tc.name)
			_, status, body := e.adminClient.CreateMuteTimingWithStatus(t, newMuteTiming(mtName))
			require.Equalf(t, http.StatusCreated, status, body)

			t.Run("GET by name", func(t *testing.T) {
				_, status, body := client.GetMuteTimingByNameWithStatus(t, mtName)
				if tc.canRead {
					require.Equalf(t, http.StatusOK, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("PUT", func(t *testing.T) {
				_, status, body := client.UpdateMuteTimingWithStatus(t, newMuteTiming(mtName))
				if tc.canUpdate {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("DELETE", func(t *testing.T) {
				status, body := client.DeleteMuteTimingWithStatus(t, mtName)
				if tc.canDelete {
					require.Equalf(t, http.StatusNoContent, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})
		})
	}
}

func TestIntegrationProvisioningNotificationPoliciesAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		// Built-in roles.
		{name: "no permissions"},
		{name: "Viewer", orgRole: org.RoleViewer, canRead: true},
		{name: "Editor", orgRole: org.RoleEditor, canRead: true, canUpdate: true, canDelete: true},
		{name: "Admin", orgRole: org.RoleAdmin, canRead: true, canUpdate: true, canDelete: true},
		// Fine-grained RBAC: route permissions.
		{
			name:        "routes read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingRoutesRead}}},
			canRead:     true,
		},
		{
			name:        "routes write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingRoutesWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canUpdate:   true, canDelete: true,
		},
		{
			name:        "routes read + write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingRoutesRead, accesscontrol.ActionAlertingRoutesWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canUpdate: true, canDelete: true,
		},
		// Legacy notification permissions.
		{
			name:        "legacy notifications read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead}}},
			canRead:     true,
		},
		{
			name:        "legacy notifications read + write + provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsRead, accesscontrol.ActionAlertingNotificationsWrite, accesscontrol.ActionAlertingProvisioningSetStatus}}},
			canRead:     true, canUpdate: true, canDelete: true,
		},
		// Provisioning-scoped permissions.
		{
			name:        "provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningWrite}}},
			canUpdate:   true, canDelete: true,
		},
		{
			name:        "provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingProvisioningRead, accesscontrol.ActionAlertingProvisioningWrite}}},
			canRead:     true, canUpdate: true, canDelete: true,
		},
		{
			name:        "notifications provisioning read",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead}}},
			canRead:     true,
		},
		{
			name:        "notifications provisioning write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canUpdate:   true, canDelete: true,
		},
		{
			name:        "notifications provisioning read + write",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{Actions: []string{accesscontrol.ActionAlertingNotificationsProvisioningRead, accesscontrol.ActionAlertingNotificationsProvisioningWrite}}},
			canRead:     true, canUpdate: true, canDelete: true,
		},
	}

	defaultRoute := definitions.Route{
		Receiver:   "empty",
		GroupByStr: []string{"..."},
		Routes:     []*definitions.Route{},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			client := e.createUserAndClient(t, tc)

			t.Run("GET", func(t *testing.T) {
				_, status, body := client.GetRouteWithStatus(t)
				if tc.canRead {
					require.Equalf(t, http.StatusOK, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("PUT", func(t *testing.T) {
				status, body := client.UpdateRouteWithStatus(t, defaultRoute, false)
				if tc.canUpdate {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})

			t.Run("DELETE", func(t *testing.T) {
				status, body := client.DeleteRouteWithStatus(t)
				if tc.canDelete {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
				}
			})
		})
	}
}
