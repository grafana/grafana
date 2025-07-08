# RBAC Action Set Resolution Bug - Reproduction Steps

This document provides a simple way to reproduce the bug where adding plugin permissions to built-in roles causes users to lose dashboard access after the June 13, 2024 upgrade.

## Bug Summary

The issue occurs in `pkg/services/accesscontrol/resourcepermissions/service.go` in the `GetPermissions()` method where action set resolution logic incorrectly filters out non-dashboard/folder actions, causing managed roles to lose their permissions.

## Prerequisites

- Grafana v12.1.0-89698 or later (contains the bug)
- Admin access to Grafana
- Ability to create users and assign roles

## Step-by-Step Reproduction

### 1. Create Test Environment

```bash
# Start Grafana in development mode
make run

# Or using Docker
docker run -d -p 3000:3000 --name grafana-test grafana/grafana:latest
```

### 2. Create Test User with Editor Role

```bash
# Using Grafana API
curl -X POST \
  http://admin:admin@localhost:3000/api/admin/users \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "login": "testuser",
    "password": "testpass",
    "OrgId": 1
  }'

# Set user role to Editor
curl -X PATCH \
  http://admin:admin@localhost:3000/api/org/users/2 \
  -H 'Content-Type: application/json' \
  -d '{
    "role": "Editor"
  }'
```

### 3. Verify Dashboard Access (Before)

```bash
# Login as test user and verify dashboard access
curl -u testuser:testpass \
  http://localhost:3000/api/dashboards/home

# Should return dashboard data successfully

# Check folder permissions
curl -u testuser:testpass \
  http://localhost:3000/api/folders
```

### 4. Add Plugin Permission to Editor Role

Using Terraform configuration:

```hcl
# main.tf
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 3.0"
    }
  }
}

provider "grafana" {
  url  = "http://localhost:3000"
  auth = "admin:admin"
}

resource "grafana_builtin_role_assignment" "editor_plugin_access" {
  builtin_role = "Editor"
  
  permissions {
    action = "plugins.app:access"
    scope  = "plugins:id:grafana-testdata-datasource"
  }
}
```

Or using API directly:

```bash
# Add plugin permission to Editor role
curl -X POST \
  http://admin:admin@localhost:3000/api/access-control/builtin-roles/Editor/role-permissions \
  -H 'Content-Type: application/json' \
  -d '{
    "permissions": [
      {
        "action": "plugins.app:access",
        "scope": "plugins:id:grafana-testdata-datasource"
      }
    ]
  }'
```

### 5. Verify Dashboard Access Loss (After)

```bash
# Test dashboard access - should now fail
curl -u testuser:testuser \
  http://localhost:3000/api/dashboards/home

# Check specific permission endpoint
curl -u testuser:testuser \
  http://localhost:3000/api/access-control/user/permissions

# Check folder access
curl -u testuser:testuser \
  http://localhost:3000/api/folders
```

Expected result: Dashboard access should be denied even though the user still has Editor role.

### 6. Debug: Check Managed Role Creation

```bash
# Check if managed role was created
curl -X GET \
  http://admin:admin@localhost:3000/api/access-control/roles \
  | jq '.[] | select(.name | contains("managed:builtins:editor"))'

# Check permissions on the managed role
curl -X GET \
  http://admin:admin@localhost:3000/api/access-control/roles/managed:builtins:editor:permissions/permissions
```

Expected result: Managed role should only contain plugin permission, missing dashboard/folder permissions.

## Alternative UI Reproduction

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

## Cleanup

```bash
# Remove test resources
curl -X DELETE http://admin:admin@localhost:3000/api/admin/users/2
docker stop grafana-test && docker rm grafana-test
```

This reproduction demonstrates how the action set resolution bug causes permission loss when plugin permissions are added to built-in roles.