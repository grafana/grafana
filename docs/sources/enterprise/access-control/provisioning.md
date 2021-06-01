+++
title = "Provisioning roles and assignments"
description = "Understand how to provision roles and assignments in fine-grained access control"
keywords = ["grafana", "fine-grained-access-control", "roles", "provisioning", "assignments", "permissions", "enterprise"]
weight = 120
+++

# Provisioning
 
You can create, change or remove [Custom roles]({{< relref "./roles.md#custom-roles" >}}) and create or remove [built-in role assignments]({{< relref "./roles.md#built-in-role-assignments" >}}), by adding one or more YAML configuration files in the [`provisioning/access-control/`]({{< relref "../../administration/configuration/#provisioning" >}}) directory.
Refer to [Grafana provisioning]({{< relref "../../administration/configuration/#provisioning" >}}) to learn more about provisioning.

If you want to manage roles and built-in role assignments by API, refer to the [Fine-grained access control HTTP API]({{< relref "../../http_api/access_control/" >}}).

## Configuration

The configuration files must be located in the [`provisioning/access-control/`]({{< relref "../../administration/configuration/#provisioning" >}}) directory.
Grafana performs provisioning during the startup. Refer to the [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}) to understand how you can reload configuration at runtime.

## Manage custom roles

You can create, update and delete custom roles, as well as create and remove built-in role assignments for them.

### Create or update roles

To create or update custom roles, you can add a list of `roles` in the configuration.

Note that in order to update a role, you would need to increment the [version]({{< relref "./roles.md#custom-roles" >}}). 

When setting the global flag on a role it overwrites the `orgId`.

### Delete roles 

To delete a role, you can add a list of roles under `deleteRoles` section in the configuration file. Note that deletion is performed after role insertion/update.

### Create and remove built-in role assignments

To create a built-in role assignment, you can add list of assignments under `builtInRoles` section in the configuration file, as an element of `roles`. To remove a built-in role assignment, leave `builtInRoles` list empty. 

Note that it is only possibly to provision [organization local]({{< relref "./roles#built-in-role-assignments" >}}) assignments. For creating or updating _global_ assignments, refer to the [Fine-grained access control HTTP API]({{< relref "../../http_api/access_control.md" >}}).

## Manage default built-in role assignments

During the startup, Grafana creates [default built-in role assignments]({{< relref "./roles#default-built-in-role-assignments" >}}) with [fixed roles]({{< relref "./roles#fixed-roles" >}}). You can remove and add back later those assignments by using provisioning.

### Remove default assignment

To remove default built-in role assignment, you can use `removeDefaultAssignments` element in the configuration file. You would need to provide built-in role name and fixed role name.

### Add back default assignment

To add back default built-in role assignment, you can use `addDefaultAssignments` element in the configuration file. You would need to provide built-in role name and fixed role name.

## Example of a role configuration file

```yaml
# config file version
apiVersion: 1

# list of default built-in role assignments that should be removed
removeDefaultAssignments:
  # <string>, must be one of the Organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin`
  - builtInRole: "Grafana Admin"
    # <string>, must be one of the existing fixed roles
    fixedRole: "fixed:permissions:admin"

# list of default built-in role assignments that should be added back
addDefaultAssignments:
  # <string>, must be one of the Organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin`
  - builtInRole: "Admin"
    # <string>, must be one of the existing fixed roles
    fixedRole: "fixed:reporting:admin:read"
    
# list of roles that should be deleted
deleteRoles:
  # <string> name of the role you want to create. Required if no uid is set
  - name: ReportEditor
    # <string> uid of the role. Required if no name
    uid: reporteditor1
    # <int> org id. will default to Grafana's default if not specified
    orgId: 1
    # <bool> force deletion revoking all grants of the role
    force: true

# list of roles to insert/update depending on what is available in the database
roles:
  # <string, required> name of the role you want to create. Required
  - name: CustomEditor
    # <string> uid of the role. Has to be unique for all orgs.
    uid: customeditor1
    # <string> description of the role, informative purpose only.
    description: "Role for our custom user editors"
    # <int> version of the role, Grafana will update the role when increased
    version: 2
    # <int> org id. will default to Grafana's default if not specified
    orgId: 1    
    # <list> list of the permissions granted by this role
    permissions:
      # <string, required> action allowed
      - action: "users:read"
        #<string, required> scope it applies to
        scope: "users:*"
      - action: "users:write"
        scope: "users:*"
      - action: "users:create"
        scope: "users:*"
    # <list> list of builtIn roles the role should be assigned to
    builtInRoles:
      # <string, required> name of the builtin role you want to assign the role to
      - name: "Editor"
        # <int> org id. will default to the role org id
        orgId: 1        
  - name: GlobalReader
    uid: globalreader
    description: "Global Role for custom user reader"
    version: 1
    # <bool> overwrite org id and creates a global role
    global: true
    permissions:
      - action: "users:read"
        scope: "users:*"
    builtInRoles:
      - name: "Viewer"
        orgId: 1        
      - name: "Editor"
        # <bool> overwrite org id and assign role globally
        global: true
```

## Supported settings

The following sections detail the supported settings for roles and built-in role assignments.

- Refer to [Permissions]({{< relref "./permissions.md#action-definitions" >}}) for full list of valid permissions.
- Check [Custom roles]({{< relref "./roles.md#custom-roles" >}}) to understand attributes for roles.
- The [default org ID]({{< relref "../../administration/configuration#auto_assign_org_id" >}}) is used if `orgId` is not specified in any of the configuration blocks.

## Validation rules

A basic set of validation rules are applied to the input `yaml` files.

### Roles

- `name` must not be empty
- `name` must not have `fixed:` prefix. 

### Built-in role assignments

- `name` must be one of the Organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin`. 
- When `orgId` is not specified, it inherits the `orgId` from `role`. For global roles the default `orgId` is used.
- `orgId` in the `role` and in the assignment must be the same for none global roles. 

### Role deletion

- Either the role `name` or `uid` must be provided
