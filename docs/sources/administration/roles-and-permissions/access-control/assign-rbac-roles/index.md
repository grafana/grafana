---
aliases:
  - ../../../enterprise/access-control/assign-rbac-roles/
  - ../../../enterprise/access-control/manage-role-assignments/manage-built-in-role-assignments/
  - ../../../enterprise/access-control/manage-role-assignments/manage-user-role-assignments/
description: Learn how to assign RBAC roles to users and teams in Grafana.
menuTitle: Assign RBAC roles
title: Assign Grafana RBAC roles
weight: 40
---

# Assign RBAC roles

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Advanced]({{< ref "/docs/grafana-cloud" >}}).

In this topic you'll learn how to use the role picker, provisioning, and the HTTP API to assign fixed and custom roles to users and teams.

## Assign fixed roles in the UI using the role picker

This section describes how to:

- Assign a fixed role to a user, team or service account as an organization administrator.
- Assign a fixed role to a user as a server administrator. This approach enables you to assign a fixed role to a user in multiple organizations, without needing to switch organizations.

In both cases, the assignment applies only to the user, team or service account within the affected organization, and no other organizations. For example, if you grant the user the **Data source editor** role in the **Main** organization, then the user can edit data sources in the **Main** organization, but not in other organizations.

<br/>

**Before you begin:**

- [Plan your RBAC rollout strategy]({{< relref "./plan-rbac-rollout-strategy/" >}}).
- Identify the fixed roles that you want to assign to the user, team or service account.

  For more information about available fixed roles, refer to [RBAC role definitions]({{< relref "./rbac-fixed-basic-role-definitions/" >}}).

- Ensure that your own user account has the correct permissions:
  - If you are assigning permissions to a user, team or service account within an organization, you must have organization administrator or server administrator permissions.
  - If you are assigning permissions to a user who belongs to multiple organizations, you must have server administrator permissions.
  - Your Grafana user can also assign fixed role if it has either the `fixed:roles:writer` fixed role assigned to the same organization to which you are assigning RBAC to a user, or a custom role with `users.roles:add` and `users.roles:remove` permissions.
  - Your own user account must have the roles you are granting. For example, if you would like to grant the `fixed:users:writer` role to a team, you must have that role yourself.

<br/>

**To assign a fixed role to a user, team or service account:**

1. Sign in to Grafana.
2. Switch to the organization that contains the user, team or service account.

   For more information about switching organizations, refer to [Switch organizations]({{< relref "../../../user-management/user-preferences/_index.md#switch-organizations" >}}).

3. Hover your cursor over **Configuration** (the gear icon) in the left navigation menu, and click **Users** or **Teams** or **Service Accounts**.
4. In the **Role** column, select the fixed role that you want to assign to the user, team or service account.
5. Click **Update**.

**To assign a fixed role as a server administrator:**

1. Sign in to Grafana, hover your cursor over **Server Admin** (the shield icon) in the left navigation menu, and click **Users**.
1. Click a user.
1. In the **Organizations** section, select a role within an organization that you want to assign to the user.
1. Click **Update**.

## Assign fixed or custom roles to a team using provisioning

Instead of using the Grafana role picker, you can use file-based provisioning to assign fixed roles to teams. If you have a large number of teams, provisioning can provide an easier approach to assigning and managing role assignments.

**Before you begin:**

- Refer to [Role provisioning]({{< relref "../rbac-grafana-provisioning" >}})
- Ensure that the team to which you are adding the fixed role exists. For more information about creating teams, refer to [Manage teams]({{< relref "../../../team-management/" >}})

**To assign a role to a team:**

1. Open the YAML configuration file.

1. Refer to the following table to add attributes and values.

   | Attribute                | Description                                                                                                                                                                                                    |
   | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `roles`                  | Enter the custom role or custom roles you want to create/update.                                                                                                                                               |
   | `roles > name`           | Enter the name of the custom role.                                                                                                                                                                             |
   | `roles > version`        | Enter the custom role version number. Role assignments are independent of the role version number.                                                                                                             |
   | `roles > global`         | Enter `true`. You can specify the `orgId` otherwise.                                                                                                                                                           |
   | `roles > permissions`    | Enter the permissions `action` and `scope` values. For more information about permissions actions and scopes, refer to [RBAC permissions, actions, and scopes]({{< relref "./custom-role-actions-scopes/" >}}) |
   | `teams`                  | Enter the team or teams to which you are adding the custom role.                                                                                                                                               |
   | `teams > orgId`          | Because teams belong to organizations, you must add the `orgId` value.                                                                                                                                         |
   | `teams > name`           | Enter the name of the team.                                                                                                                                                                                    |
   | `teams > roles`          | Enter the custom or fixed role or roles that you want to grant to the team.                                                                                                                                    |
   | `teams > roles > name`   | Enter the name of the role.                                                                                                                                                                                    |
   | `teams > roles > global` | Enter `true`, or specify `orgId` of the role you want to assign to the team. Fixed roles are global.                                                                                                           |

   For more information about managing custom roles, refer to [Create custom roles using provisioning]({{< relref "./manage-rbac-roles/#create-custom-roles-using-provisioning" >}}).

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../../developers/http_api/admin/#reload-provisioning-configurations" >}}).

The following example creates the `custom:users:writer` role and assigns it to the `user writers` and `user admins` teams along with the `fixed:users:writer` role:

The following example:

- Creates the `custom:users:writer` role.
- Assigns the `custom:users:writer` role and the `fixed:users:writer` role to the `user admins` and `user writers` teams.

```yaml
# config file version
apiVersion: 2

# Roles to insert/update in the database
roles:
  - name: 'custom:users:writer'
    description: 'List/update other users in the organization'
    version: 1
    global: true
    permissions:
      - action: 'org.users:read'
        scope: 'users:*'
      - action: 'org.users:write'
        scope: 'users:*'

# Assignments to teams
teams:
  - name: 'user writers'
    orgId: 1
    roles:
      # Custom role assignment
      - name: 'custom:users:writer'
        global: true
      # Fixed role assignment
      - name: 'fixed:users:writer'
        global: true
  - name: 'user admins'
    orgId: 1
    roles:
      - name: 'custom:users:writer'
        global: true
      - name: 'fixed:users:writer'
        global: true
```

> **Note**: The roles don't have to be defined in the provisioning configuration files to be assigned. If roles exist in the database, they can be assigned.

**Remove a role assignment from a team:**

If you want to remove an assignment from a team, add `state: absent` to the `teams > roles` section, and reload the configuration file.

The following example:

- Creates the `custom:users:writer` role
- Assigns the `custom:users:writer` role and the `fixed:users:writer` role to the `user admins` team
- Removes the `custom:users:writer` and the `fixed:users:writer` assignments from the `user writers` team, if those assignments exist.

```yaml
# config file version
apiVersion: 2

# Roles to insert/update in the database
roles:
  - name: 'custom:users:writer'
    description: 'List/update other users in the organization'
    version: 1
    global: true
    permissions:
      - action: 'org.users:read'
        scope: 'users:*'
      - action: 'org.users:write'
        scope: 'users:*'

# Assignments to teams
teams:
  - name: 'user writers'
    orgId: 1
    roles:
      - name: 'fixed:users:writer'
        global: true
        state: 'absent' # Remove assignment
      - name: 'custom:users:writer'
        global: true
        state: 'absent' # Remove assignment
  - name: 'user admins'
    orgId: 1
    roles:
      - name: 'fixed:users:writer'
        global: true
      - name: 'custom:users:writer'
        global: true
```

> **Note**: The roles don't have to be defined in the provisioning configuration files to be revoked. If roles exist in the database, they can be revoked.
