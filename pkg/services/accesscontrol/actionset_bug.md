# RBAC Action Set Resolution Bug

This document is a investigation documentation for potentially reproducing the bug where adding plugin permissions to built-in roles causes users to lose dashboard access.

## theory

The issue occurs in `pkg/services/accesscontrol/resourcepermissions/service.go` in the `GetPermissions()` method where action set resolution logic incorrectly filters out non-dashboard/folder actions, causing managed roles to lose their permissions.

current status: NOT REPRODUCABLE


## Prerequisites

- Grafana v12.1.0-89698 or later (contains the bug)
- Modify Editor Role via API


## Workaround

Until fixed, add explicit dashboard permissions when adding plugin permissions:

```hcl
resource "grafana_builtin_role_assignment" "editor_complete" {
  builtin_role = "Editor"
  
  permissions {
    action = "plugins.app:access"
    scope  = "plugins:id:grafana-testdata-datasource"
  }
  
  permissions {
    action = "folders:read" 
    scope  = "folders:uid:general"
  }
}
```

1. create folders and dashboards in grafana, parents and children, there should at least be one dashboard nested in a folder, both in general folder and in a sub-folder
2. remove editor managed role for certain dashboards and others leave it. (expect that only editors are able to see the dashboards assigned)
3. if the bug exist, we should see no dashboards or get permission errors

## Expected Behavior vs Actual Behavior

### Expected (Correct) Behavior
- Adding plugin permissions should **supplement** existing Editor permissions
- User should retain dashboard and folder access from Editor role

### Actual (Bug) Behavior
- Adding plugin permissions seems to have been **replacing** all permissions in managed role
- User loses dashboard and folder access from Editor role

## Potential Code Investigation

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

## Workaround for the customer that worked.

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
