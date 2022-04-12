---
title: 'Assign a custom role to a basic role, a team, or a fixed role'
menuTitle: 'Assign a custom role to a basic role, a team, or a fixed role'
description: 'xxx.'
aliases: [xxx]
weight: 40
keywords:
  - xxx
---

# Assign a custom role to a basic role, a team, or a fixed role

Complete the following instructions when you want to assign a custom role to a basic role, a team, or a fixed role.

> **Note:** If you want to remove a custom role assignment from a team, remove it from the YAML file, save your changes, and restart Grafana.

## Assign a custom role to a basic role

Information here about why a user would want to do this. What are the benefits?

### Before you begin

- [Enable Grafana to provision custom roles]({{< relref "./enable-provisioning.md" >}}).
- [Add a custom role]({{< relref "./create-update-delete-custom-role.md" >}})

**To assign a custom role to a basic role:**

1. Open the YAML configuration file and locate the `builtInRoles` section.

1. Refer to the following table to add attributes and values.

| Attribute      | Description                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`         | Enter the name of the custom role.                                                                                                                                                                                                                           |
| `version`      | Enter the custom role version number. Assignments are updated if the version of the role is greater than or equal to the version number stored internally. If you are updating a role assignment, you are not required to increment the role version number. |
| `orgId`        | If you do not enter an `orgId`, it inherits the `orgId` from `role`. For global roles the default `orgId` is used. `orgId` in the `role` and in the assignment must be the same for non-global roles.                                                        |
| `permissions`  | Enter the permissions `action` and `scope` values. For more information about permissions actions and scopes, refer to [LINK]                                                                                                                                |
| `builtInRoles` | Enter the `name` of an organization role, for example `Viewer`, `Editor`, or `Admin`, or enter `Grafana Admin`.                                                                                                                                              |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example assigns the `users:editor` custom role to the basic editor and admin roles.

```yaml
# config file version
apiVersion: 1

# Roles to insert/update in the database
roles:
  - name: custom:users:editor
    description: 'This role allows users to list/create/update other users in the organization'
    version: 1
    orgId: 1
    permissions:
      - action: 'users:read'
        scope: 'users:*'
      - action: 'users:write'
        scope: 'users:*'
      - action: 'users:create'
        scope: 'users:*'
    builtInRoles:
      - name: 'Editor'
      - name: 'Admin'
```

## Assign a custom role to a team

Need information here on why a user would want to complete this task. What are the benefits?

Not sure what to do with this prose: Assignments to basic roles will be ignored. Use `addDefaultAssignments` and `removeDefaultAssignments` instead.

> **Note:** If you want to remove a custom role assignment from a team, remove it from the YAML file, save your changes, and restart Grafana.

### Before you begin

- Ensure that the team to which you are adding the fixed role exists. For more information about creating teams, refer to [Manage teams]({{< relref "../../../administration/manage-users-and-permissions/manage-teams/_index.md">}}).

**To assign a custom role to a team:**

1. Open the YAML configuration file.

1. Refer to the following table to add attributes and values.

| Attribute     | Description                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | Enter the name of the custom role.                                                                                                                                                                                                                           |
| `version`     | Enter the custom role version number. Assignments are updated if the version of the role is greater then or equal to the version number stored internally. If you are updating a role assignment, you are not required to increment the role version number. |
| `global`      | Enter `true` or `false`                                                                                                                                                                                                                                      |
| `permissions` | Enter the permissions `action` and `scope` values. For more information about permissions actions and scopes, refer to [LINK]                                                                                                                                |
| `teams`       | Enter the team or teams to which you are adding the custom role.                                                                                                                                                                                             |
| `orgId`       | Because teams belong to organizations, you must add the `orgId` value.                                                                                                                                                                                       |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example assigns the `custom:users:writer` role to the `user editors` and `user admins` teams:

```yaml
# config file version
apiVersion: 1

# Roles to insert/update in the database
roles:
  - name: custom:users:writer
    description: 'List/update other users in the organization'
    version: 1
    global: true
    permissions:
      - action: 'org.users:read'
        scope: 'users:*'
      - action: 'org.users:write'
        scope: 'users:*'
    teams:
      - name: 'user editors'
        orgId: 1
      - name: 'user admins'
        orgId: 1
```

## Assign a fixed role to a team

Need information here on why a user would want to complete this task. What are the benefits?

> **Note:** If you want to remove a fixed role assignment from a team, remove it from the YAML file, save your changes, and restart Grafana.

### Before you begin

- Ensure that the team to which you are adding the fixed role exists. For more information about creating teams, refer to [Manage teams]({{< relref "../../../administration/manage-users-and-permissions/manage-teams/_index.md">}}).

**To assign a fixed role to a team:**

1. Open the YAML configuration file.

1. Refer to the following table to add attributes and values.

| Attribute | Description                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `name`    | Enter the name of the fixed role.                                                                                              |
| `global`  | Enter `true`. Because fixed roles are global, you must specify the global attribute. You cannot change fixed role definitions. |
| `teams`   | Enter the team or teams to which you are adding the fixed role.                                                                |
| `orgId`   | Because teams belong to organizations, you must add the `orgId` value.                                                         |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example assigns the `users:writer` fixed role to the `user editors` and `user admins` teams:

```yaml
# config file version
apiVersion: 1

# Roles to insert/update in the database
roles:
  - name: fixed:users:writer
    global: true
    teams:
      - name: 'user editors'
        orgId: 1
      - name: 'user admins'
        orgId: 1
```
