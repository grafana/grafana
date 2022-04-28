---
title: 'Plan your Grafana RBAC rollout strategy'
menuTitle: 'Plan your RBAC rollout strategy'
description: 'Plan your RBAC rollout strategy before you begin assigning roles to users and teams.'
aliases: [docs/grafana/latest/enterprise/access-control/usage-scenarios/]
weight: 20
---

# Plan your RBAC rollout strategy

An RBAC rollout strategy helps you determine _how_ you want to implement RBAC prior to assigning RBAC roles to users and teams.

Your rollout strategy should help you answer the following questions:

- Should I assign basic roles to users, or should I assign fixed roles or custom roles to users?
- When should I create custom roles?
- To which entities should I apply fixed and custom roles? Should I apply them to users, teams, or to basic roles?
- How do I roll out permissions in a way that makes them easy to manage?
- Which approach should I use when assigning roles? Should I use the Grafana UI, provisioning, or the API?

## Review basic role and fixed role definitions

As a first step in determining your permissions rollout strategy, we recommend that you become familiar with basic role and fixed role definitions. In addition to assigning fixed roles to any user and team, you can also assign fixed roles to basic roles, which changes what a Viewer, Editor, or Admin can do. This flexibility means that there are many combinations of role assignments for you to consider. If you have a large number of Grafana users and teams, we recommend that you make a list of which fixed roles you might want to use.

To learn more about basic roles and fixed roles, refer to the following documentation:

- [Basic role definitions]({{< relref "./rbac-fixed-basic-role-definitions#basic-role-assignments" >}})
- [Fixed role definitions]({{< relref "./rbac-fixed-basic-role-definitions#fixed-role-definitions" >}})

## User and team considerations

RBAC is a flexible and powerful feature with many possible permissions assignment combinations available. Consider the follow guidelines when assigning permissions to users and teams.

- **Assign roles to users** when you have a one-off scenario where a small number of users require access to a resource or when you want to assign temporary access. If you have a large number of users, this approach can be difficult to manage as you scale your use of Grafana. For example, a member of your IT department might need the `fixed:licensing:reader` and `fixed:licensing:writer` roles so that they can manage your Grafana Enterprise license.

- **Assign roles to teams** when you have a subset of users that align to your organizational structure, and you want all members of the team to have the same level of access. For example, all members of a particular engineering team might need the `fixed:reports:reader` and `fixed:reports:writer` roles to be able to manage reports.

  When you assign additional users to a team, the system automatically assigns permissions to those users.

### Authentication provider considerations

You can take advantage of your current authentication provider to manage user and team permissions in Grafana. When you map users and teams to SAML and LDAP groups, you can synchronize those assignments with Grafana.

For example:

1. Map SAML, LDAP, or Oauth roles to Grafana basic roles (viewer, editor, or admin).
2. Use the Grafana Enterprise team sync feature to synchronize teams from your SAML, LDAP, or Oauth provider to Grafana.

   - If a team does not exist in Grafana, team sync creates it.
   - If a team exists in Grafana, team sync updates its membership.

   For more information about team sync, refer to [Team sync]({{< relref "../team-sync.md" >}}).

3. Within Grafana, assign RBAC permissions to roles and teams.

## When to modify basic roles or create custom roles

Consider the following guidelines when you determine if you should modify basic roles or create custom roles.

- **Modify basic roles** when Grafana's definitions of what viewers, editors, and admins can do does not match your definition of these roles. You can add or remove fixed roles from any basic role.

  > **Note:** Changes that you make to basic roles impact the role definition for all [organizations]({{< relref "../../administration/manage-organizations/_index.md" >}}) in the Grafana instance. For example, when you assign the `fixed:users:writer` role to the viewer basic role, all viewers in any org in the Grafana instance can create users within that org.

- **Create custom roles** when fixed role definitions don't meet you permissions requirements. For example, the `fixed:dashboards:writer` role allows users to delete dashboards. If you want some users or teams to be able to create and update but not delete dashboards, you can create a custom role with a name like `custom:dashboards:creator` that lacks the `dashboards:delete` permission.

## How to assign RBAC roles

Use any of the following methods to assign RBAC roles to users and teams.

- **Grafana UI:** Use the Grafana UI when you want to assign a limited number of RBAC roles to users and teams. The UI contains a role picker that you can use to select roles.
- **Grafana HTTP API:** Use the Grafana HTTP API if you would like to automate role assignment.
- **Terraform:** Use Terraform to assign and manage user and team role assignments if you use Terraform for provisioning.
- **Grafana provisioning:** Grafana provisioning provides a robust approach to assigning, removing, and deleting roles. Within a single YAML file you can include multiple role assignment and removal entries.

## Permissions scenarios

We've compiled the following permissions rollout scenarios based on current Grafana implementations.

> **Note:** If you have a use case that you'd like to share, feel free to contribute to this docs page. We'd love to hear from you!

### Provide internal viewer employees with the ability to use Explore, but prevent external viewer contractors from using Explore

1. In Grafana, create a team with the name `Internal employees`.
1. Assign the `fixed:datasources:querier` role to the `Internal employees` team.
1. Add internal employees to the `Internal employees` team, or map them from a SAML, LDAP, or Oauth team using [Team Sync]({{< relref "../team-sync.md" >}}).
1. Assign the viewer role to both internal employees and contractors.

### Limit viewer, editor, or admin permissions

1. Review the list of fixed roles associated with the basic role.
1. [Remove the fixed roles from the basic role]({{< relref "manage-rbac-roles.md#remove-a-fixed-role-from-a-basic-role" >}}).

### Allow only members of one team to manage Alerts

1. Remove all fixed roles starting with `fixed:alerts` from the Viewer, Editor, and Admin basic roles.
2. Create an `Alert Managers` team, and assign that team all applicable Alerting fixed roles.
3. Add users to the `Alert Managers` team.

### Provide dashboards to users in two or more geographies

1. Create a folder for each geography, for example, create a `US` folder and an `EU` folder.
1. Add dashboards to each folder.
1. Use folder permissions to add US-based users as Editors to the `US` folder and assign EU-based users as Editors to the `EU` folder.

### Create a custom role to access alerts in a specific folder

To see an alert rule in Grafana, the user must have read access to the folder that stores the alert rule, permission to read alerts in the folder, and permission to query all data sources that the rule uses.

The API command in this example is based on the following:

- A `Test-Folder` with ID `92`
- Two data sources: `DS1` with UID `_oAfGYUnk`, and `DS2` with UID `YYcBGYUnk`
- An alert rule that is stored in `Test-Folder` and queries the two data sources.

The following request creates a custom role that includes permissions to access the alert rule:

```
curl --location --request POST '<grafana_url>/api/access-control/roles/' \
--header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=' \
--header 'Content-Type: application/json' \
--data-raw '{
    "version": 1,
    "name": "custom:alerts.reader.in.folder.123",
    "displayName": "Read-only access to alerts in folder Test-Folder",
    "description": "Let user query DS1 and DS2, and read alerts in folder Test-Folders",
    "group":"Custom",
    "global": true,
    "permissions": [
        {
            "action": "folders:read",
            "scope": "folders:uid:YEcBGYU22"
        },
        {
            "action": "alert.rules:read",
            "scope": "folders:uid:YEcBGYU22"
        },
        {
            "action": "datasources:query",
            "scope": "datasources:uid:_oAfGYUnk"
        },
        {
            "action": "datasources:query",
            "scope": "datasources:uid:YYcBGYUnk"
        }
    ]
}'
```

### Enable an editor to create custom roles

By default, the Grafana Server Admin is the only user who can create and manage custom roles. If you want your users to do the same, you have two options:

1. Create a basic role assignment and map `fixed:permissions:admin:edit` and `fixed:permissions:admin:read` fixed roles to the `Editor` basic role.
1. [Create a custom role]({{< ref "./manage-rbac-roles#create-custom-roles" >}}) with `roles.builtin:add` and `roles:write` permissions, then create a basic role assignment for `Editor` organization role.

   > **Note:** any user or service account with the ability to modify roles can only create, update or delete roles with permissions they themselves have been granted. For example, a user with the `Editor` role would be able to create and manage roles only with the permissions they have, or with a subset of them.

### Enable viewers to create reports

This section describes two ways that you can enable viewers to create reports.

- Assign the `fixed:reporting:admin:edit` role to the `Viewer` basic role. For more information about assigning a fixed role to a basic role, refer to [Assign a fixed role to a basic role using provisioning]({{< relref "./assign-rbac-roles#assign-a-fixed-role-to-a-basic-role-using-provisioning" >}}).

  > **Note:** The `fixed:reporting:admin:edit` role assigns more permissions than just creating reports. For more information about fixed role permission assignments, refer to [Fixed role definitions]({{< relref "./rbac-fixed-basic-role-definitions#fixed-role-definitions" >}}).

- [Create a custom role]({{< ref "./manage-rbac-roles#create-custom-roles" >}}) that includes the `reports.admin:write` permission, and add the custom role to the `Viewer` basic role.
  - For more information about assigning a custom role to a basic role, refer to [Assign a custom role to a basic role using provisioning]({{< relref "./assign-rbac-roles#assign-a-custom-role-to-a-basic-role-using-provisioning" >}}) or [Assign a custom role to a basic role using the HTTP API]({{< relref "./assign-rbac-roles#assign-a-custom-role-to-a-basic-role-using-the-http-api" >}}).

### Prevent a Grafana Admin from creating and inviting users

This topic describes how to remove the `users:create` permissions from the Grafana Admin role, which prevents the Grafana Admin from creating users and inviting them to join an organization.

1. [View basic role assignments]({{< relref "./rbac-fixed-basic-role-definitions#basic-role-assignments" >}}) to determine which basic role assignments are available.
1. To determine which role provides `users:create` permission, refer to [Fixed role definitions]({{< relref "./rbac-fixed-basic-role-definitions#fixed-role-definitions" >}}).
1. Use the [Role-based access control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or Grafana provisioning to [Remove a fixed role from a basic role]({{< relref "./manage-rbac-roles#remove-a-fixed-role-from-a-basic-role" >}}).
