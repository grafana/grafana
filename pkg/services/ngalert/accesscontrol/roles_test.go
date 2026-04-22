package accesscontrol

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const snapshotDir = "testdata"

func assertSnapshot(t *testing.T, name string, actual []byte) {
	t.Helper()
	expected, err := os.ReadFile(filepath.Join(snapshotDir, name)) //nolint:gosec
	update := err != nil
	if err == nil {
		update = !assert.JSONEq(t, string(expected), string(actual))
	}
	if update {
		require.NoError(t, os.WriteFile(filepath.Join(snapshotDir, name), actual, 0o644))
	}
}

func declareFixedRolesForTest(t *testing.T) []accesscontrol.RoleRegistration {
	t.Helper()
	svc := acmock.New()
	var captured []accesscontrol.RoleRegistration
	svc.DeclareFixedRolesFunc = func(registrations ...accesscontrol.RoleRegistration) error {
		captured = append(captured, registrations...)
		return nil
	}
	require.NoError(t, DeclareFixedRoles(svc, featuremgmt.WithFeatures()))
	require.NotEmpty(t, captured, "DeclareFixedRoles should register at least one role")
	return captured
}

type snapshotPermission struct {
	Action string `json:"action"`
	Scope  string `json:"scope,omitempty"`
}

type snapshotRole struct {
	Name        string               `json:"name"`
	DisplayName string               `json:"displayName"`
	Description string               `json:"description"`
	Group       string               `json:"group"`
	Hidden      bool                 `json:"hidden,omitempty"`
	Permissions []snapshotPermission `json:"permissions"`
	Grants      []string             `json:"grants,omitempty"`
}

func toSnapshotRole(r accesscontrol.RoleRegistration) snapshotRole {
	perms := make([]snapshotPermission, 0, len(r.Role.Permissions))
	for _, p := range r.Role.Permissions {
		perms = append(perms, snapshotPermission{Action: p.Action, Scope: p.Scope})
	}
	sort.Slice(perms, func(i, j int) bool {
		if perms[i].Action != perms[j].Action {
			return perms[i].Action < perms[j].Action
		}
		return perms[i].Scope < perms[j].Scope
	})
	return snapshotRole{
		Name:        r.Role.Name,
		DisplayName: r.Role.DisplayName,
		Description: r.Role.Description,
		Group:       r.Role.Group,
		Hidden:      r.Role.Hidden,
		Permissions: perms,
		Grants:      r.Grants,
	}
}

func TestFixedRoles_Snapshot(t *testing.T) {
	roles := declareFixedRolesForTest(t)
	snapshot := make([]snapshotRole, 0, len(roles))
	for _, r := range roles {
		snapshot = append(snapshot, toSnapshotRole(r))
	}
	data, err := json.MarshalIndent(snapshot, "", "  ")
	require.NoError(t, err)
	data = append(data, '\n')
	assertSnapshot(t, "fixed_roles.snapshot.json", data)
}

func TestBasicRoleGrants_Snapshot(t *testing.T) {
	roles := declareFixedRolesForTest(t)

	type permission struct {
		Action string `json:"action"`
		Scope  string `json:"scope,omitempty"`
	}

	// Map grant -> role names
	rolesByGrant := make(map[string][]string)
	// Map grant -> deduplicated permissions
	permsByGrant := make(map[string]map[permission]struct{})
	for _, r := range roles {
		if len(r.Grants) == 0 {
			continue
		}
		for _, g := range r.Grants {
			rolesByGrant[g] = append(rolesByGrant[g], r.Role.Name)
			if permsByGrant[g] == nil {
				permsByGrant[g] = make(map[permission]struct{})
			}
			for _, p := range r.Role.Permissions {
				permsByGrant[g][permission{Action: p.Action, Scope: p.Scope}] = struct{}{}
			}
		}
	}

	grantNames := make([]string, 0, len(rolesByGrant))
	for g := range rolesByGrant {
		grantNames = append(grantNames, g)
	}
	sort.Strings(grantNames)

	type grantEntry struct {
		Grant       string       `json:"grant"`
		Roles       []string     `json:"roles"`
		Permissions []permission `json:"permissions"`
	}
	result := make([]grantEntry, 0, len(grantNames))
	for _, g := range grantNames {
		roleNames := rolesByGrant[g]
		sort.Strings(roleNames)

		perms := make([]permission, 0, len(permsByGrant[g]))
		for p := range permsByGrant[g] {
			perms = append(perms, p)
		}
		sort.Slice(perms, func(i, j int) bool {
			if perms[i].Action != perms[j].Action {
				return perms[i].Action < perms[j].Action
			}
			return perms[i].Scope < perms[j].Scope
		})

		result = append(result, grantEntry{Grant: g, Roles: roleNames, Permissions: perms})
	}
	data, err := json.MarshalIndent(result, "", "  ")
	require.NoError(t, err)
	data = append(data, '\n')
	assertSnapshot(t, "basic_role_grants.snapshot.json", data)
}

func TestAllAlertingActions_BoundToFixedRoles(t *testing.T) {
	roles := declareFixedRolesForTest(t)

	// Collect all actions bound in fixed roles
	boundActions := make(map[string][]string)
	for _, r := range roles {
		for _, p := range r.Role.Permissions {
			boundActions[p.Action] = append(boundActions[p.Action], r.Role.Name)
		}
	}

	allActions := allAlertingActions()
	require.NotEmpty(t, allActions, "should find ActionAlerting* constants")

	var unbound []string
	for _, action := range allActions {
		if _, ok := boundActions[action]; !ok {
			unbound = append(unbound, action)
		}
	}
	sort.Strings(unbound)

	// Snapshot the action-to-role bindings
	type actionBinding struct {
		Action string   `json:"action"`
		Roles  []string `json:"roles"`
	}
	bindings := make([]actionBinding, 0, len(allActions))
	for _, action := range allActions {
		roles := dedup(sorted(boundActions[action]))
		bindings = append(bindings, actionBinding{Action: action, Roles: roles})
	}
	data, err := json.MarshalIndent(bindings, "", "  ")
	require.NoError(t, err)
	data = append(data, '\n')
	assertSnapshot(t, "alerting_actions_bindings.snapshot.json", data)

	assert.Empty(t, unbound, fmt.Sprintf("The following ActionAlerting* actions are not bound to any fixed role:\n%s", strings.Join(unbound, "\n")))
}

// allAlertingActions returns all ActionAlerting* constant values from the accesscontrol package.
func allAlertingActions() []string {
	actions := []string{
		accesscontrol.ActionAlertingRuleCreate,
		accesscontrol.ActionAlertingRuleRead,
		accesscontrol.ActionAlertingRuleUpdate,
		accesscontrol.ActionAlertingRuleDelete,
		accesscontrol.ActionAlertingInstanceCreate,
		accesscontrol.ActionAlertingInstanceUpdate,
		accesscontrol.ActionAlertingInstanceRead,
		accesscontrol.ActionAlertingSilencesRead,
		accesscontrol.ActionAlertingSilencesCreate,
		accesscontrol.ActionAlertingSilencesWrite,
		accesscontrol.ActionAlertingNotificationsRead,
		accesscontrol.ActionAlertingNotificationsWrite,
		accesscontrol.ActionAlertingNotificationsTemplatesRead,
		accesscontrol.ActionAlertingNotificationsTemplatesWrite,
		accesscontrol.ActionAlertingNotificationsTemplatesDelete,
		accesscontrol.ActionAlertingNotificationsTemplatesTest,
		accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
		accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite,
		accesscontrol.ActionAlertingNotificationsTimeIntervalsDelete,
		accesscontrol.ActionAlertingNotificationsInhibitionRulesRead,
		accesscontrol.ActionAlertingNotificationsInhibitionRulesWrite,
		accesscontrol.ActionAlertingNotificationsInhibitionRulesDelete,
		accesscontrol.ActionAlertingReceiversList,
		accesscontrol.ActionAlertingReceiversRead,
		accesscontrol.ActionAlertingReceiversReadSecrets,
		accesscontrol.ActionAlertingReceiversCreate,
		accesscontrol.ActionAlertingReceiversUpdate,
		accesscontrol.ActionAlertingReceiversUpdateProtected,
		accesscontrol.ActionAlertingReceiversDelete,
		accesscontrol.ActionAlertingReceiversTest,
		accesscontrol.ActionAlertingReceiversTestCreate,
		accesscontrol.ActionAlertingReceiversPermissionsRead,
		accesscontrol.ActionAlertingReceiversPermissionsWrite,
		accesscontrol.ActionAlertingRoutesRead,
		accesscontrol.ActionAlertingRoutesWrite,
		accesscontrol.ActionAlertingManagedRoutesRead,
		accesscontrol.ActionAlertingManagedRoutesWrite,
		accesscontrol.ActionAlertingManagedRoutesCreate,
		accesscontrol.ActionAlertingManagedRoutesDelete,
		accesscontrol.ActionAlertingRoutesPermissionsRead,
		accesscontrol.ActionAlertingRoutesPermissionsWrite,
		accesscontrol.ActionAlertingRuleExternalWrite,
		accesscontrol.ActionAlertingRuleExternalRead,
		accesscontrol.ActionAlertingInstancesExternalWrite,
		accesscontrol.ActionAlertingInstancesExternalRead,
		accesscontrol.ActionAlertingNotificationsExternalWrite,
		accesscontrol.ActionAlertingNotificationsExternalRead,
		accesscontrol.ActionAlertingProvisioningRead,
		accesscontrol.ActionAlertingProvisioningReadSecrets,
		accesscontrol.ActionAlertingProvisioningWrite,
		accesscontrol.ActionAlertingRulesProvisioningRead,
		accesscontrol.ActionAlertingRulesProvisioningWrite,
		accesscontrol.ActionAlertingNotificationsProvisioningRead,
		accesscontrol.ActionAlertingNotificationsProvisioningWrite,
		accesscontrol.ActionAlertingProvisioningSetStatus,
	}
	sort.Strings(actions)
	return actions
}

func sorted(s []string) []string {
	sort.Strings(s)
	return s
}

func dedup(s []string) []string {
	if len(s) == 0 {
		return s
	}
	result := []string{s[0]}
	for i := 1; i < len(s); i++ {
		if s[i] != s[i-1] {
			result = append(result, s[i])
		}
	}
	return result
}
