+++
title = "Provisioning roles and assignments"
description = "Understand how to provision roles and assignments in fine-grained access control"
keywords = ["grafana", "fine-grained-access-control", "roles", "provisioning", "assignments", "permissions", "enterprise"]
weight = 120
+++

# Provisioning

> Available only when [fine-grained access control]({{< relref "./_index.md" >}}) is enabled.

> Refer to [Fine-Grained Access Control HTTP API]({{< relref "../../http_api/access_control/" >}}) to understand how to manage roles and assignments by API.
 
You can create, change or remove [Custom roles]({{< relref "./concepts/roles.md" >}}) and create or remove [built-in role assignments]({{< relref "./concepts/roles.md#built-in-role-assignments" >}}), by adding one or more YAML configuration files in the [`provisioning/access-control/`]({{< relref "../../administration/configuration/#provisioning" >}}) directory. 

## Before you begin

- Understand [Grafana provisioning]({{< relref "../../administration/configuration/#provisioning" >}}).
- Learn about basic [Concepts]({{< relref "./concepts/_index.md" >}})
- Learn about [Managing roles and permissions]({{< relref "./managing-roles-permissions.md" >}})

## Configuration

Each config file can contain a list of `roles` that will be created or updated during start up. 
Upon version increment, Grafana updates the role to match the configuration file. The configuration file can also contain a list of roles that should be deleted. That list is called `deleteRoles`. Grafana will perform deletion after role insertion/update.

## Example of a Role Configuration File

```yaml
# config file version
apiVersion: 1

# list of roles that should be deleted from the database
deleteRoles:
  # <string> name of the role you want to create. Required if no uid
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
    # <boolean> indicates if the role is `global` or not
    global: false
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
        # <boolean> indicates if the assignment is `global` or not
        global: false
```

## Supported settings

The following sections detail the supported settings for roles and built-in role assignments.

1. Refer to [Permissions]({{< relref "./concepts/permissions.md#available-permissions" >}}) for full list of valid permissions.
1. Check [Custom roles]({{< relref "./concepts/custom-roles.md" >}}) to understand attributes for roles.
1. The [default org ID]({{< relref "../../administration/configuration/#auto_assign_org_id" >}}) is used if `orgId` is not specified in any of the configuration blocks.

## Validation rules

A basic set of validation rules are applied to the input `yaml` files.

### Roles

1. `name` must not be empty
1. `name` must not have `grafana:roles:` prefix. 

### Built-in role assignments

1. `name` must be one of the Organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin`. 
1. When `orgId` is not specified, it inherits the `orgId` from `role`.
1. `orgId` in the `role` and in the assignment must be the same.

### Role deletion

1. Either the role `name` or `uid` must be provided
