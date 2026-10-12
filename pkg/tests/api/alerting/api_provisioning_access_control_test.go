package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
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

func TestIntegrationProvisioningRuleGroupPermissionCombinations(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationProvisioningRuleGroupPermissionCombinations)
}

func TestIntegrationProvisioningContactPointsAccessControl(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationProvisioningContactPointsAccessControl)
}

func TestIntegrationProvisioningTemplatesAccessControl(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationProvisioningTemplatesAccessControl)
}

func TestIntegrationProvisioningMuteTimingsAccessControl(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationProvisioningMuteTimingsAccessControl)
}

func TestIntegrationProvisioningNotificationPoliciesAccessControl(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationProvisioningNotificationPoliciesAccessControl)
}

func testIntegrationProvisioningContactPointsAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const otherReceiverUID = "another-receiver"

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		{
			name: "provisioning set status only",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingProvisioningSetStatus},
			}},
		},
		{
			name: "receivers create without provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions:           []string{accesscontrol.ActionAlertingReceiversCreate},
				Resource:          ngmodels.ScopeReceiversRoot,
				ResourceAttribute: "uid",
				ResourceID:        "*",
			}},
		},
		{
			name:    "receivers read and update without provisioning set status",
			canRead: true,
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions:           []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversUpdate},
				Resource:          ngmodels.ScopeReceiversRoot,
				ResourceAttribute: "uid",
				ResourceID:        "*",
			}},
		},
		{
			name:    "receivers read and delete without provisioning set status",
			canRead: true,
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions:           []string{accesscontrol.ActionAlertingReceiversRead, accesscontrol.ActionAlertingReceiversDelete},
				Resource:          ngmodels.ScopeReceiversRoot,
				ResourceAttribute: "uid",
				ResourceID:        "*",
			}},
		},
		{
			name:    "receivers update on another UID",
			canRead: true,
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{accesscontrol.ActionAlertingReceiversRead},
					Resource:          ngmodels.ScopeReceiversRoot,
					ResourceAttribute: "uid",
					ResourceID:        "*",
				},
				{
					Actions:           []string{accesscontrol.ActionAlertingReceiversUpdate},
					Resource:          ngmodels.ScopeReceiversRoot,
					ResourceAttribute: "uid",
					ResourceID:        otherReceiverUID,
				},
				{Actions: []string{accesscontrol.ActionAlertingProvisioningSetStatus}},
			},
		},
		{
			name:    "receivers delete on another UID",
			canRead: true,
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{accesscontrol.ActionAlertingReceiversRead},
					Resource:          ngmodels.ScopeReceiversRoot,
					ResourceAttribute: "uid",
					ResourceID:        "*",
				},
				{
					Actions:           []string{accesscontrol.ActionAlertingReceiversDelete},
					Resource:          ngmodels.ScopeReceiversRoot,
					ResourceAttribute: "uid",
					ResourceID:        otherReceiverUID,
				},
				{Actions: []string{accesscontrol.ActionAlertingProvisioningSetStatus}},
			},
		},
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
				before, status, body := e.adminClient.GetContactPointsByNameWithStatus(t, existing.Name)
				require.Equal(t, http.StatusOK, status, body)

				existing.Settings.Set("message", "updated_message")
				status, body = client.UpdateContactPointWithStatus(t, existing.UID, existing)
				if tc.canUpdate {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
					after, status, body := e.adminClient.GetContactPointsByNameWithStatus(t, existing.Name)
					require.Equal(t, http.StatusOK, status, body)
					require.Equal(t, before, after)
				}
			})

			t.Run("DELETE", func(t *testing.T) {
				status, body := client.DeleteContactPointWithStatus(t, existing.UID)
				if tc.canDelete {
					require.Equalf(t, http.StatusAccepted, status, body)
				} else {
					require.Equalf(t, http.StatusForbidden, status, body)
					remaining, status, body := e.adminClient.GetContactPointsByNameWithStatus(t, existing.Name)
					require.Equal(t, http.StatusOK, status, body)
					require.Len(t, remaining, 1)
					require.Equal(t, existing.UID, remaining[0].UID)
				}
			})
		})
	}
}

func testIntegrationProvisioningTemplatesAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		{
			name: "provisioning set status only",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingProvisioningSetStatus},
			}},
		},
		{
			name: "templates write without provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingNotificationsTemplatesWrite},
			}},
		},
		{
			name: "templates delete without provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingNotificationsTemplatesDelete},
			}},
		},
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

func testIntegrationProvisioningMuteTimingsAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		{
			name: "provisioning set status only",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingProvisioningSetStatus},
			}},
		},
		{
			name: "time intervals write without provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite},
			}},
		},
		{
			name: "time intervals delete without provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingNotificationsTimeIntervalsDelete},
			}},
		},
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

func testIntegrationProvisioningNotificationPoliciesAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	e := setupProvisioningAccessControlTest(t)

	testCases := []provisioningTestCase{
		{
			name: "provisioning set status only",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingProvisioningSetStatus},
			}},
		},
		{
			name: "routes write without provisioning set status",
			permissions: []resourcepermissions.SetResourcePermissionCommand{{
				Actions: []string{accesscontrol.ActionAlertingRoutesWrite},
			}},
		},
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

func testIntegrationProvisioningRuleGroupPermissionCombinations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		ruleGroupInterval = time.Minute
		updatedRuleTitle  = "Updated rule"
		// Keep two rules so one request can update a rule and delete another.
		initialRuleCount = 2
	)

	e := setupProvisioningAccessControlTest(t)
	orgID := e.env.Cfg.DefaultOrgID()
	e.adminClient.CreateFolder(t, ruleGroupTargetFolderUID, "Rules target")
	e.adminClient.CreateFolder(t, ruleGroupOtherFolderUID, "Rules other")

	cases := ruleGroupPermissionCases()

	for i, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			group := definitions.AlertRuleGroup{
				Title:     fmt.Sprintf("permissions-%d", i),
				FolderUID: ruleGroupTargetFolderUID,
				Interval:  int64(ruleGroupInterval / time.Second),
			}
			for j := range initialRuleCount {
				uid := fmt.Sprintf("permission-rule-%d-%d", i, j)
				group.Rules = append(group.Rules, provisioningPermissionRule(uid, group.Title, orgID))
			}

			var before definitions.AlertRuleGroup
			var status int
			var body string
			if tc.operation != ruleGroupOperationCreate {
				_, status, body = e.adminClient.CreateOrUpdateRuleGroupProvisioning(t, group)
				require.Equal(t, http.StatusOK, status, body)
				before, status, body = e.adminClient.GetRuleGroupProvisioning(t, group.FolderUID, group.Title)
				require.Equal(t, http.StatusOK, status, body)
			}

			grants := ruleGroupPermissionGrants(tc, group.FolderUID)
			client := e.createUserAndClient(t, provisioningTestCase{permissions: grants})

			if tc.operation != ruleGroupOperationCreate {
				group = before
				group.Rules = slices.Clone(before.Rules)
			}

			switch tc.operation {
			case ruleGroupOperationUpdate:
				group.Rules[0].Title = updatedRuleTitle
			case ruleGroupOperationUpdateAndCreate:
				group.Rules[0].Title = updatedRuleTitle
				uid := fmt.Sprintf("new-rule-%d", i)
				group.Rules = append(group.Rules, provisioningPermissionRule(uid, group.Title, orgID))
			case ruleGroupOperationUpdateAndDelete:
				group.Rules[0].Title = updatedRuleTitle
				group.Rules = group.Rules[:1]
			}

			if tc.operation == ruleGroupOperationDelete {
				status, body = client.DeleteRulesGroupProvisioning(t, group.FolderUID, group.Title)
			} else {
				_, status, body = client.CreateOrUpdateRuleGroupProvisioning(t, group)
			}
			require.Equal(t, tc.wantStatus, status, body)

			after, status, body := e.adminClient.GetRuleGroupProvisioning(t, group.FolderUID, group.Title)
			if tc.operation == ruleGroupOperationDelete {
				require.Equal(t, http.StatusNotFound, status, body)
				return
			}
			require.Equal(t, http.StatusOK, status, body)
			if tc.wantStatus == http.StatusForbidden {
				require.Equal(t, before, after, "denied requests must not partially change the group")
			} else {
				require.Len(t, after.Rules, len(group.Rules))
				for _, expected := range group.Rules {
					index := slices.IndexFunc(after.Rules, func(rule definitions.ProvisionedAlertRule) bool {
						return rule.UID == expected.UID
					})
					require.NotEqual(t, -1, index)
					require.Equal(t, expected.Title, after.Rules[index].Title)
				}
			}
		})
	}
}

func provisioningPermissionRule(uid, group string, orgID int64) definitions.ProvisionedAlertRule {
	const queryRefID = "A"

	return definitions.ProvisionedAlertRule{
		UID:          uid,
		Title:        uid,
		OrgID:        orgID,
		FolderUID:    ruleGroupTargetFolderUID,
		RuleGroup:    group,
		Condition:    queryRefID,
		NoDataState:  definitions.Alerting,
		ExecErrState: definitions.AlertingErrState,
		Data: []definitions.AlertQuery{{
			RefID:         queryRefID,
			DatasourceUID: expr.DatasourceUID,
			Model:         json.RawMessage(`{"type":"math","expression":"1"}`),
		}},
	}
}

func setupProvisioningAccessControlTest(t *testing.T) provisioningTestEnv {
	t.Helper()

	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
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
			e.env.Cfg.DefaultOrgID(),
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

const (
	ruleGroupOperationCreate          = "create"
	ruleGroupOperationUpdate          = "update"
	ruleGroupOperationDelete          = "delete"
	ruleGroupOperationUpdateAndCreate = "update and create"
	ruleGroupOperationUpdateAndDelete = "update and delete"

	ruleGroupTargetFolderUID = "rules-target"
	ruleGroupOtherFolderUID  = "rules-other"
)

type ruleGroupPermissionCase struct {
	name               string
	operation          string
	missingAction      string
	wrongScopeAction   string
	provisioningAction string
	mutationAction     string
	wantStatus         int
}

func ruleGroupPermissionCases() []ruleGroupPermissionCase {
	return []ruleGroupPermissionCase{
		{
			name:           "update",
			operation:      ruleGroupOperationUpdate,
			mutationAction: accesscontrol.ActionAlertingRuleUpdate,
			wantStatus:     http.StatusOK,
		},
		{
			name:           "create",
			operation:      ruleGroupOperationCreate,
			mutationAction: accesscontrol.ActionAlertingRuleCreate,
			wantStatus:     http.StatusOK,
		},
		{
			name:           "delete group",
			operation:      ruleGroupOperationDelete,
			mutationAction: accesscontrol.ActionAlertingRuleDelete,
			wantStatus:     http.StatusNoContent,
		},
		{
			name:           "missing rule read",
			operation:      ruleGroupOperationUpdate,
			mutationAction: accesscontrol.ActionAlertingRuleUpdate,
			missingAction:  accesscontrol.ActionAlertingRuleRead,
			wantStatus:     http.StatusForbidden,
		},
		{
			name:           "missing folder read",
			operation:      ruleGroupOperationUpdate,
			mutationAction: accesscontrol.ActionAlertingRuleUpdate,
			missingAction:  folder.ActionFoldersRead,
			wantStatus:     http.StatusForbidden,
		},
		{
			name:           "missing set status",
			operation:      ruleGroupOperationUpdate,
			mutationAction: accesscontrol.ActionAlertingRuleUpdate,
			missingAction:  accesscontrol.ActionAlertingProvisioningSetStatus,
			wantStatus:     http.StatusForbidden,
		},
		{
			name:       "missing mutation permission",
			operation:  ruleGroupOperationUpdate,
			wantStatus: http.StatusForbidden,
		},
		{
			name:             "update scoped to another folder",
			operation:        ruleGroupOperationUpdate,
			mutationAction:   accesscontrol.ActionAlertingRuleUpdate,
			wrongScopeAction: accesscontrol.ActionAlertingRuleUpdate,
			wantStatus:       http.StatusForbidden,
		},
		{
			name:             "read scoped to another folder",
			operation:        ruleGroupOperationUpdate,
			mutationAction:   accesscontrol.ActionAlertingRuleUpdate,
			wrongScopeAction: accesscontrol.ActionAlertingRuleRead,
			wantStatus:       http.StatusForbidden,
		},
		{
			name:           "update cannot also create",
			operation:      ruleGroupOperationUpdateAndCreate,
			mutationAction: accesscontrol.ActionAlertingRuleUpdate,
			wantStatus:     http.StatusForbidden,
		},
		{
			name:           "update cannot also delete",
			operation:      ruleGroupOperationUpdateAndDelete,
			mutationAction: accesscontrol.ActionAlertingRuleUpdate,
			wantStatus:     http.StatusForbidden,
		},
		{
			name:               "provisioning write alternative",
			operation:          ruleGroupOperationUpdate,
			provisioningAction: accesscontrol.ActionAlertingProvisioningWrite,
			wantStatus:         http.StatusOK,
		},
		{
			name:               "rules provisioning write alternative",
			operation:          ruleGroupOperationUpdate,
			provisioningAction: accesscontrol.ActionAlertingRulesProvisioningWrite,
			wantStatus:         http.StatusOK,
		},
	}
}

func ruleGroupPermissionGrants(tc ruleGroupPermissionCase, folderUID string) []resourcepermissions.SetResourcePermissionCommand {
	if tc.provisioningAction != "" {
		return []resourcepermissions.SetResourcePermissionCommand{
			{Actions: []string{tc.provisioningAction}},
			{
				Actions:           []string{folder.ActionFoldersRead},
				Resource:          folder.ScopeFoldersRoot,
				ResourceAttribute: "uid",
				ResourceID:        folderUID,
			},
		}
	}

	scopedActions := []string{accesscontrol.ActionAlertingRuleRead, folder.ActionFoldersRead}
	if tc.mutationAction != "" {
		scopedActions = append(scopedActions, tc.mutationAction)
	}
	scopedActions = slices.DeleteFunc(scopedActions, func(action string) bool {
		return action == tc.missingAction || action == tc.wrongScopeAction
	})

	grants := []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           scopedActions,
			Resource:          folder.ScopeFoldersRoot,
			ResourceAttribute: "uid",
			ResourceID:        folderUID,
		},
	}
	if tc.missingAction != accesscontrol.ActionAlertingProvisioningSetStatus {
		grants = append(grants, resourcepermissions.SetResourcePermissionCommand{
			Actions: []string{accesscontrol.ActionAlertingProvisioningSetStatus},
		})
	}
	if tc.wrongScopeAction != "" {
		grants = append(grants, resourcepermissions.SetResourcePermissionCommand{
			Actions:           []string{tc.wrongScopeAction},
			Resource:          folder.ScopeFoldersRoot,
			ResourceAttribute: "uid",
			ResourceID:        ruleGroupOtherFolderUID,
		})
	}

	return grants
}
