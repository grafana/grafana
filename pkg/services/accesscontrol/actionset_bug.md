# RBAC Action Set Resolution Bug - Reproduction Steps

This document provides a simple way to reproduce the bug where adding plugin permissions to built-in roles causes users to lose dashboard access after the June 13, 2024 upgrade.

## theory

The issue occurs in `pkg/services/accesscontrol/resourcepermissions/service.go` in the `GetPermissions()` method where action set resolution logic incorrectly filters out non-dashboard/folder actions, causing managed roles to lose their permissions.

## Prerequisites

- Grafana v12.1.0-89698 or later (contains the bug)
- Admin access to Grafana
- Ability to create users and assign roles

 UI Reproduction

### 1. Use Grafana UI

1. Login as admin (admin/admin)
2. Go to Administration → Users and access → Roles
3. Find "Editor" role and click on it
4. Add a new permission:
   - Action: `plugins.app:access`
   - Scope: `plugins:id:grafana-testdata-datasource`
5. Save changes

### 2. Test with Editor User

1. Login as the test user
2. Try to access dashboards via the UI
3. Navigate to Dashboards → Browse
4. Should see no dashboards or get permission errors

## Expected Behavior vs Actual Behavior

### Expected (Correct) Behavior
- Adding plugin permissions should **supplement** existing Editor permissions
- User should retain dashboard and folder access from Editor role
- Managed role should inherit or preserve built-in Editor permissions

### Actual (Bug) Behavior
- Adding plugin permissions **replaces** all permissions in managed role
- User loses dashboard and folder access from Editor role
- Managed role only contains explicitly added permissions

## Code Investigation

To investigate the bug, examine this code in `pkg/services/accesscontrol/resourcepermissions/service.go`:

```go
if isFolderOrDashboardAction(action) {
    actionSetActions := s.actionSetSvc.ResolveActionSet(action)
    if len(actionSetActions) > 0 {
        // ... expansion logic
        continue  // ← BUG: Original action is skipped
    }
}
expandedActions = append(expandedActions, action)  // ← Never reached for some actions
```

## Workaround

Until fixed, add explicit dashboard permissions when adding plugin permissions:

```hcl
resource "grafana_builtin_role_assignment" "editor_complete" {
  builtin_role = "Editor"
  
  permissions {
    action = "plugins.app:access"
    scope  = "plugins:id:grafana-testdata-datasource"
  }
  
  # Add missing dashboard permissions explicitly
  permissions {
    action = "dashboards:read"
    scope  = "folders:uid:general"
  }
  
  permissions {
    action = "folders:read" 
    scope  = "folders:uid:general"
  }
}
```