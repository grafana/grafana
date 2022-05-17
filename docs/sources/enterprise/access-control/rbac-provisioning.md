---
title: 'RBAC provisioning in Grafana'
menuTitle: 'RBAC provisioning'
description: 'Learn how to use RBAC provisioning in Grafana.'
aliases: []
weight: 30
---

## RBAC provisioning

You can create, change or remove [Custom roles]({{< relref "./manage-rbac-roles.md#create-custom-roles-using-provisioning" >}}) and create or remove [basic role assignments]({{< relref "./assign-rbac-roles.md#assign-a-fixed-role-to-a-basic-role-using-provisioning" >}}), by adding one or more YAML configuration files in the `provisioning/access-control/` directory.

If you choose to use provisioning to assign and manage role, you must first enable it.

Grafana performs provisioning during startup. After you make a change to the configuration file, you can reload it during runtime. You do not need to restart the Grafana server for your changes to take effect.

**Before you begin:**

- Ensure that you have access to files on the server where Grafana is running.

**To manage and assign RBAC roles using provisioning:**

1. Sign in to the Grafana server.

2. Locate the Grafana provisioning folder.

3. Create a new YAML in the following folder: **provisioning/access-control**. For example, `provisioning/access-control/custom-roles.yml`

4. Add RBAC provisioning details to the configuration file. See [manage RBAC roles]({{< relref "manage-rbac-roles.md" >}}) and [assign RBAC roles]({{< relref "assign-rbac-roles.md" >}}) for instructions, and see this [example role provisioning file]({{< relref "rbac-provisioning#example" >}}) for a complete example of a provisioning file.

5. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

## Example role configuration file using Grafana provisioning

The following example shows a complete YAML configuration file that:

- Removes a default role assignment
- Adds a default role assignment
- Deletes custom roles
- Adds custom roles to basic roles
- Adds a custom role to a fixed role

## Example

```yaml
# config file version
apiVersion: 1

# list of default basic role assignments that should be removed
removeDefaultAssignments:
  # <string>, must be one of the Organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin`
  - builtInRole: 'Grafana Admin'
    # <string>, must be one of the existing fixed roles
    fixedRole: 'fixed:permissions:admin'

# list of default basic role assignments that should be added back
addDefaultAssignments:
  # <string>, must be one of the Organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin`
  - builtInRole: 'Admin'
    # <string>, must be one of the existing fixed roles
    fixedRole: 'fixed:reporting:admin:read'

# list of roles that should be deleted
deleteRoles:
  # <string> name of the role you want to create. Required if no uid is set
  - name: 'custom:reports:editor'
    # <string> uid of the role. Required if no name
    uid: 'customreportseditor1'
    # <int> org id. will default to Grafana's default if not specified
    orgId: 1
    # <bool> force deletion revoking all grants of the role
    force: true
  - name: 'custom:global:reports:reader'
    uid: 'customglobalreportsreader1'
    # <bool> overwrite org id and removes a global role
    global: true
    force: true

# list of roles to insert/update depending on what is available in the database
roles:
  # <string, required> name of the role you want to create. Required
  - name: 'custom:users:editor'
    # <string> uid of the role. Has to be unique for all orgs.
    uid: customuserseditor1
    # <string> description of the role, informative purpose only.
    description: 'Role for our custom user editors'
    # <int> version of the role, Grafana will update the role when increased
    version: 2
    # <int> org id. will default to Grafana's default if not specified
    orgId: 1
    # <list> list of the permissions granted by this role
    permissions:
      # <string, required> action allowed
      - action: 'users:read'
        #<string> scope it applies to
        scope: 'users:*'
      - action: 'users:write'
        scope: 'users:*'
      - action: 'users:create'
        scope: 'users:*'
    # <list> list of basic roles the role should be assigned to
    builtInRoles:
      # <string, required> name of the basic role you want to assign the role to
      - name: 'Editor'
        # <int> org id. will default to the role org id
        orgId: 1
  - name: 'custom:global:users:reader'
    uid: 'customglobalusersreader1'
    description: 'Global Role for custom user readers'
    version: 1
    # <bool> overwrite org id and creates a global role
    global: true
    permissions:
      - action: 'users:read'
        scope: 'users:*'
    builtInRoles:
      - name: 'Viewer'
        orgId: 1
      - name: 'Editor'
        # <bool> overwrite org id and assign role globally
        global: true
  - name: fixed:users:writer
    global: true
    # <list> list of teams the role should be assigned to
    teams:
      - name: 'user editors'
        orgId: 1
```
