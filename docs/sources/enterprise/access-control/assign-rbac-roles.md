---
title: 'Assign Grafana RBAC roles'
menuTitle: 'Assign RBAC roles'
description: 'Learn how to assign RBAC roles to users and teams in Grafana.'
aliases:
  [
    '/docs/grafana/latest/enterprise/access-control/manage-role-assignments/manage-user-role-assignments/',
    '/docs/grafana/latest/enterprise/access-control/manage-role-assignments/manage-built-in-role-assignments/',
  ]
weight: 40
---

# Assign RBAC roles

In this topic you'll learn how to use the role picker, provisioning, and the HTTP API to assign fixed and custom roles to users and teams.

## Assign fixed roles in the UI using the role picker

This section describes how to:

- Assign a fixed role to a user or team as an organization administrator.
- Assign a fixed role to a user as a server administrator. This approach enables you to assign a fixed role to a user in multiple organizations, without needing to switch organizations.

In both cases, the assignment applies only to the user or team within the affected organization, and no other organizations. For example, if you grant the user the **Data source editor** role in the **Main** organization, then the user can edit data sources in the **Main** organization, but not in other organizations.

> **Note:** After you apply your changes, user and team permissions update immediately, and the UI reflects the new permissions the next time they reload their browser or visit another page.

<br/>

**Before you begin:**

- [Plan your RBAC rollout strategy]({{< relref "./plan-rbac-rollout-strategy.md" >}}).
- Identify the fixed roles that you want to assign to the user or team.

  For more information about available fixed roles, refer to [RBAC role definitions]({{< relref "./rbac-fixed-basic-role-definitions.md" >}}).

- Ensure that your own user account has the correct permissions:
  - If you are assigning permissions to a user or team within an organization, you must have organization administrator or server administrator permissions.
  - If you are assigning permissions to a user who belongs to multiple organizations, you must have server administrator permissions.
  - Your Grafana user can also assign fixed role if it has either the `fixed:roles:writer` fixed role assigned to the same organization to which you are assigning RBAC to a user, or a custom role with `users.roles:add` and `users.roles:remove` permissions.
  - Your own user account must have the roles you are granting. For example, if you would like to grant the `fixed:users:writer` role to a team, you must have that role yourself.

<br/>

**To assign a fixed role to a user or team:**

1. Sign in to Grafana.
2. Switch to the organization that contains the user or team.

   For more information about switching organizations, refer to [Switch organizations](../../administration/manage-user-preferences/_index.md#switch-organizations).

3. Hover your cursor over **Configuration** (the gear icon) in the left navigation menu, and click **Users** or **Teams**.
4. In the **Role** column, select the fixed role that you want to assign to the user or team.
5. Click **Update**.

![User role picker in an organization](/static/img/docs/enterprise/user_role_picker_in_org.png)

<br/>

**To assign a fixed role as a server administrator:**

1. Sign in to Grafana, hover your cursor over **Server Admin** (the shield icon) in the left navigation menu, and click **Users**.
1. Click a user.
1. In the **Organizations** section, select a role within an organization that you want to assign to the user.
1. Click **Update**.

![User role picker in Organization](/static/img/docs/enterprise/user_role_picker_global.png)

## Assign fixed or custom roles to a team using provisioning

Instead of using the Grafana role picker, you can use file-based provisioning to assign fixed roles to teams. If you have a large number of teams, provisioning can provide an easier approach to assigning and managing role assignments.

</br>

**Before you begin:**

- [Enable role provisioning]({{< relref "./enable-rbac-and-provisioning#enable-role-provisioning" >}})
- Ensure that the team to which you are adding the fixed role exists. For more information about creating teams, refer to [Manage teams]({{< relref "../../administration/manage-users-and-permissions/manage-teams/_index.md">}})

</br>

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

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

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

</br>

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

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

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

> **Note:** If you want to remove a fixed role assignment from a team, remove it from the YAML file, save your changes, and reload the configuration file.

## Assign a fixed or custom role to a basic role

If you want to extend the permissions of a basic role, you can modify it by adding a fixed role or a basic role to it.

You can also remove fixed or custom roles from basic roles. For example, you can remove the `fixed:users:writer` fixed role from the Administrator basic role if you would prefer that administrators not manage users. Learn more in the topic [remove a fixed role from a basic role]({{< relref "manage-rbac-roles.md#remove-a-fixed-role-from-a-basic-role" >}}).

### Assign a fixed role to a basic role using provisioning

If you want to extend the permissions of a basic role, and you identify a fixed role that meets your permission requirements, you can assign a fixed role to a basic role.

</br>

**Before you begin:**

- [Enable role provisioning]({{< relref "./enable-rbac-and-provisioning#enable-role-provisioning" >}})
- Determine which fixed role you want to add to a basic role

</br>

**To add a fixed role to a basic role:**

1. Open the YAML configuration file and locate the `addDefaultAssignments` section.

1. Refer to the following table to add attributes and values.

   | Attribute     | Description                       |
   | ------------- | --------------------------------- |
   | `builtInRole` | Enter the name of the basic role. |
   | `fixedRole`   | Enter the name of the fixed role. |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example restores a default basic and fixed role assignment.

```yaml
# config file version
apiVersion: 1

# list of default basic role assignments that should be added back
addDefaultAssignments:
  - builtInRole: 'Admin'
    fixedRole: 'fixed:reporting:admin:read'
```

### Assign a custom role to a basic role using provisioning

If you want to extend the permissions of a basic role, and assigning fixed roles to the basic role does not meet your permission requirements, you can create a custom role and assign that role to a basic role.

</br>

**Before you begin:**

- [Enable role provisioning]({{< relref "./enable-rbac-and-provisioning#enable-role-provisioning" >}})
- [Add a custom role]({{< relref "./manage-rbac-roles#create-custom-role" >}})

</br>

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

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

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

## Assign a custom role to a basic role using the HTTP API

As an alternative to assigning roles using the role picker or provisioning, you can use the Grafana HTTP API to assign fixed and custom roles to users and teams. For more information about the HTTP API, refer to the [RBAC HTTP API documentation]({{< relref "../../http_api/access_control.md#create-a-basic-role-assignment" >}}).

The following example shows you how to assign a custom role to a basic role using the HTTP API.

**Example request**

```
curl --location --request POST '<grafana_url>/api/access-control/builtin-roles' \
--header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=' \
--header 'Content-Type: application/json' \
--data-raw '{
    "roleUid": "jZrmlLCkGksdka",
    "builtinRole": "Viewer",
    "global": true
}'
```

**Example response**

```
{
    "message": "Built-in role grant added"
}
```
