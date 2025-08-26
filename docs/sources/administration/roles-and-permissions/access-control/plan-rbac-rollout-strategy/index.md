---
aliases:
  - ../../../enterprise/access-control/plan-rbac-rollout-strategy/
  - ../../../enterprise/access-control/usage-scenarios/
description: Plan your RBAC rollout strategy before you begin assigning roles to users
  and teams.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Plan your RBAC rollout strategy
title: Plan your Grafana RBAC rollout strategy
weight: 20
refs:
  api-rbac-update-a-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#update-a-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#update-a-role
  rbac-fixed-basic-role-definitions-basic-role-assignments:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
  rbac-fixed-basic-role-definitions-fixed-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/#fixed-role-definitions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/#fixed-role-definitions
  manage-rbac-roles-update-basic-role-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/manage-rbac-roles/#update-basic-role-permissions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/manage-rbac-roles/#update-basic-role-permissions
  service-accounts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/
---

# Plan your RBAC rollout strategy

{{< admonition type="note" >}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

An RBAC rollout strategy helps you determine _how_ you want to implement RBAC prior to assigning RBAC roles to users and teams.

Your rollout strategy should help you answer the following questions:

- Should I assign basic roles to users, or should I assign fixed roles or custom roles to users?
- When should I create custom roles?
- To which entities should I apply fixed and custom roles? Should I apply them to users, teams? Should I modify the basic roles permissions instead?
- How do I roll out permissions in a way that makes them easy to manage?
- Which approach should I use when assigning roles? Should I use the Grafana UI, provisioning, or the API?

## Review basic role and fixed role definitions

As a first step in determining your permissions rollout strategy, we recommend that you become familiar with basic role and fixed role definitions. In addition to assigning fixed roles to any user and team, you can also modify basic roles permissions, which changes what a Viewer, Editor, or Admin can do. This flexibility means that there are many combinations of role assignments for you to consider. If you have a large number of Grafana users and teams, we recommend that you make a list of which fixed roles you might want to use. Keep in mind that `No Basic Role`, which is a role without permissions, cannot be modified or updated.

To learn more about basic roles and fixed roles, refer to the following documentation:

- [Basic role definitions](ref:rbac-fixed-basic-role-definitions-basic-role-assignments)
- [Fixed role definitions](ref:rbac-fixed-basic-role-definitions-fixed-role-definitions)

## User and team considerations

RBAC is a flexible and powerful feature with many possible permissions assignment combinations available. Consider the follow guidelines when assigning permissions to users and teams.

- **Assign roles to users** when you have a one-off scenario where a small number of users require access to a resource or when you want to assign temporary access. If you have a large number of users, this approach can be difficult to manage as you scale your use of Grafana. For example, a member of your IT department might need the `fixed:licensing:reader` and `fixed:licensing:writer` roles so that they can manage your Grafana Enterprise license.

- **Assign roles to teams** when you have a subset of users that align to your organizational structure, and you want all members of the team to have the same level of access. For example, all members of a particular engineering team might need the `fixed:reports:reader` and `fixed:reports:writer` roles to be able to manage reports.

  When you assign additional users to a team, the system automatically assigns permissions to those users.

### Authentication provider considerations

You can take advantage of your current authentication provider to manage user and team permissions in Grafana. When you map users and teams to SAML and LDAP groups, you can synchronize those assignments with Grafana.

For example:

1. Map SAML, LDAP, or Oauth roles to Grafana basic roles (viewer, editor, or admin).

2. Use the Grafana Enterprise team sync feature to synchronize teams from your SAML, LDAP, or Oauth provider to Grafana. For more information about team sync, refer to [Team sync](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-team-sync/).

3. Within Grafana, assign RBAC permissions to users and teams.

## When to modify basic roles or create custom roles

Consider the following guidelines when you determine if you should modify basic roles or create custom roles.

- **Modify basic roles** when Grafana's definitions of what viewers, editors, and admins can do does not match your definition of these roles. You can add or remove permissions from any basic role.

  {{< admonition type="note" >}}
  Changes that you make to basic roles impact the role definition for all [organizations](/docs/grafana/<GRAFANA_VERSION>/administration/organization-management/) in the Grafana instance. For example, when you add the `fixed:users:writer` role's permissions to the viewer basic role, all viewers in any org in the Grafana instance can create users within that org.
  {{< /admonition >}}

  {{< admonition type="note" >}}
  You cannot modify the `No Basic Role` permissions.
  {{< /admonition >}}

- **Create custom roles** when fixed role definitions don't meet you permissions requirements. For example, the `fixed:dashboards:writer` role allows users to delete dashboards. If you want some users or teams to be able to create and update but not delete dashboards, you can create a custom role with a name like `custom:dashboards:creator` that lacks the `dashboards:delete` permission.

## How to assign RBAC roles

Use any of the following methods to assign RBAC roles to users and teams.

- **Grafana UI:** Use the Grafana UI when you want to assign a limited number of RBAC roles to users and teams. The UI contains a role picker that you can use to select roles.
- **Grafana HTTP API:** Use the Grafana HTTP API if you would like to automate role assignment.
- **Terraform:** Use Terraform to assign and manage user and team role assignments if you use Terraform for provisioning.
- **Grafana provisioning:** Grafana provisioning provides a robust approach to assigning, removing, and deleting roles. Within a single YAML file you can include multiple role assignment and removal entries.

## Permissions scenarios

We've compiled the following permissions rollout scenarios based on current Grafana implementations.

{{< admonition type="note" >}}
If you have a use case that you'd like to share, feel free to contribute to this docs page. We'd love to hear from you!
{{< /admonition >}}

### Provide internal viewer employees with the ability to use Explore, but prevent external viewer contractors from using Explore

1. In Grafana, create a team with the name `Internal employees`.
1. Assign the `fixed:datasources:explorer` role to the `Internal employees` team.
1. Add internal employees to the `Internal employees` team, or map them from a SAML, LDAP, or Oauth team using [Team Sync](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-team-sync/).
1. Assign the viewer role to both internal employees and contractors.

### Limit viewer, editor, or admin permissions

1. Review the list of permissions associated with the basic role.
1. [Change the permissions of the basic role](ref:manage-rbac-roles-update-basic-role-permissions).

### Allow only members of one team to manage Alerts

1. Create an `Alert Managers` team, and assign that team all applicable Alerting fixed roles.
1. Add users to the `Alert Managers` team.
1. Remove all permissions with actions prefixed with `alert.` from the Viewer, Editor, and Admin basic roles.

### Provide dashboards to users in two or more geographies

1. Create a folder for each geography, for example, create a `US` folder and an `EU` folder.
1. Add dashboards to each folder.
1. Use folder permissions to add US-based users as Editors to the `US` folder and assign EU-based users as Editors to the `EU` folder.

### Assign a user specific set of roles

1. Create a user with the `No Basic Role` selected under organization roles.
1. Assign the user a set of fixed roles that meet your requirements.

### Create a custom role to access alerts in a specific folder

To see an alert rule in Grafana, the user must have read access to the folder that stores the alert rule, permission to read alerts in the folder, and permission to query all data sources that the rule uses.

The API command in this example is based on the following:

- A `Test-Folder` with ID `92`
- Two data sources: `DS1` with UID `_oAfGYUnk`, and `DS2` with UID `YYcBGYUnk`
- An alert rule that is stored in `Test-Folder` and queries the two data sources.

The following request creates a custom role that includes permissions to access the alert rule:

```
curl --location --request POST '<grafana_url>/api/access-control/roles/' \
--header 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' \
--header 'Content-Type: application/json' \
--data-raw '{
    "version": 1,
    "name": "custom:alerts.reader.in.folder.123",
    "displayName": "Read-only access to alerts in folder Test-Folder",
    "description": "Let user query DS1 and DS2, and read alerts in folder Test-Folders",
    "group":"Custom",
    "global": false,
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

By default, only a Grafana Server Admin can create and manage custom roles. If you want your `Editors` to do the same, [update the `Editor` basic role permissions](ref:manage-rbac-roles-update-basic-role-permissions). There are two ways to achieve this:

- Add the following permissions to the `basic:editor` role, using provisioning or the [RBAC HTTP API](ref:api-rbac-update-a-role):

  | action         | scope                       |
  | -------------- | --------------------------- |
  | `roles:read`   | `roles:*`                   |
  | `roles:write`  | `permissions:type:delegate` |
  | `roles:delete` | `permissions:type:delegate` |

  As an example, here is a small bash script that fetches the role, modifies it using `jq` and updates it:

  ```bash
  # Fetch the role, modify it to add the desired permissions and increment its version
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' \
    -X GET '<grafana_url>/api/access-control/roles/basic_editor' | \
    jq 'del(.created)| del(.updated) | del(.permissions[].created) | del(.permissions[].updated) | .version += 1' | \
    jq '.permissions += [{"action": "roles:read", "scope": "roles:*"}, {"action": "roles:write", "scope": "permissions:type:delegate"}, {"action": "roles:delete", "scope": "permissions:type:delegate"}]' > /tmp/basic_editor.json

  # Update the role
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' -H 'Content-Type: application/json' \
    -X PUT-d @/tmp/basic_editor.json '<grafana_url>/api/access-control/roles/basic_editor'
  ```

- Or add the `fixed:roles:writer` role permissions to the `basic:editor` role using the `role > from` list of your provisioning file:

  ```yaml
  apiVersion: 2

  roles:
    - name: 'basic:editor'
      global: true
      version: 3
      from:
        - name: 'basic:editor'
          global: true
        - name: 'fixed:roles:writer'
          global: true
  ```

> **Note:** Any user or service account with the ability to modify roles can only create, update, or delete roles with permissions they have been granted. For example, a user with the `Editor` role would be able to create and manage roles only with the permissions they have or with a subset of them.

### Enable viewers to create reports

If you want your `Viewers` to create reports, [update the `Viewer` basic role permissions](ref:manage-rbac-roles-update-basic-role-permissions). There are two ways to achieve this:

- Add the following permissions to the `basic:viewer` role, using provisioning or the [RBAC HTTP API](ref:api-rbac-update-a-role):

  | Action           | Scope                           |
  | ---------------- | ------------------------------- |
  | `reports:create` | n/a                             |
  | `reports:write`  | `reports:*` <br> `reports:id:*` |
  | `reports:read`   | `reports:*`                     |
  | `reports:send`   | `reports:*`                     |

  As an example, here is a small bash script that fetches the role, modifies it using `jq` and updates it:

  ```bash
  # Fetch the role, modify it to add the desired permissions and increment its version
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' \
    -X GET '<grafana_url>/api/access-control/roles/basic_viewer' | \
    jq 'del(.created)| del(.updated) | del(.permissions[].created) | del(.permissions[].updated) | .version += 1' | \
    jq '.permissions += [{"action": "reports:create"}, {"action": "reports:read", "scope": "reports:*"}, {"action": "reports:write", "scope": "reports:*"}, {"action": "reports:send", "scope": "reports:*"}]' > /tmp/basic_viewer.json

  # Update the role
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' -H 'Content-Type: application/json' \
    -X PUT-d @/tmp/basic_viewer.json '<grafana_url>/api/access-control/roles/basic_viewer'
  ```

- Or add the `fixed:reports:writer` role permissions to the `basic:viewer` role using the `role > from` list of your provisioning file:

  ```yaml
  apiVersion: 2

  roles:
    - name: 'basic:viewer'
      global: true
      version: 3
      from:
        - name: 'basic:viewer'
          global: true
        - name: 'fixed:reports:writer'
          global: true
  ```

> **Note:** The `fixed:reports:writer` role assigns more permissions than just creating reports. For more information about fixed role permission assignments, refer to [Fixed role definitions](ref:rbac-fixed-basic-role-definitions-fixed-role-definitions).

### Prevent a Grafana Admin from creating and inviting users

To prevent a Grafana Admin from creating users and inviting them to join an organization, you must [update a basic role permission](ref:manage-rbac-roles-update-basic-role-permissions).
The permissions to remove are:

| Action          | Scope     |
| --------------- | --------- |
| `users:create`  |           |
| `org.users:add` | `users:*` |

There are two ways to achieve this:

- Use [RBAC HTTP API](ref:api-rbac-update-a-role).

  As an example, here is a small bash script that fetches the role, modifies it using `jq` and updates it:

  ```bash
  # Fetch the role, modify it to remove the undesired permissions and increment its version
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' \
    -X GET '<grafana_url>/api/access-control/roles/basic_grafana_admin' | \
    jq 'del(.created)| del(.updated) | del(.permissions[].created) | del(.permissions[].updated) | .version += 1' | \
    jq 'del(.permissions[] | select (.action == "users:create")) | del(.permissions[] | select (.action == "org.users:add" and .scope == "users:*"))' > /tmp/basic_grafana_admin.json

  # Update the role
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' -H 'Content-Type: application/json' \
    -X PUT-d @/tmp/basic_grafana_admin.json '<grafana_url>/api/access-control/roles/basic_grafana_admin'
  ```

- Or use the `role > from` list and `permission > state` option of your provisioning file:

  ```yaml
  apiVersion: 2

  roles:
    - name: 'basic:grafana_admin'
      global: true
      version: 3
      from:
        - name: 'basic:grafana_admin'
          global: true
      permissions:
        - action: 'users:create'
          state: 'absent'
        - action: 'org.users:add'
          scope: 'users:*'
          state: 'absent'
  ```

### Prevent Viewers from accessing an App Plugin

By default, Viewers, Editors and Admins have access to all App Plugins that their organization role allows them to access.
To change this default behavior and prevent Viewers from accessing an App plugin, you must [update a basic role's permissions](ref:manage-rbac-roles-update-basic-role-permissions).

In this example, three App plugins have been installed and enabled:
| Name | ID | Required Org role |
|--------------------|-----------------------------|-------------------|
| On Call | grafana-oncall-app | Viewer |
| Kentik Connect Pro | kentik-connect-app | Viewer |
| Enterprise logs | grafana-enterprise-logs-app | Admin |

By default, Viewers will hence be able to see both, On Call and Kentik Connect Pro App plugins.
If you want to revoke their access to the On Call App plugin, you need to:

1. Remove the permission to access all application plugins:
   | Action | Scope |
   |----------------------|-------------|
   | `plugins.app:access` | `plugins:*` |
1. Grant the permission to access the Kentik Connect Pro App plugin only:
   | Action | Scope |
   |----------------------|---------------------------------|
   | `plugins.app:access` | `plugins:id:kentik-connect-app` |

Here are two ways to achieve this:

- Use [RBAC HTTP API](ref:api-rbac-update-a-role).

  As an example, here is a small bash script that fetches the role, modifies it using `jq` and updates it:

  ```bash
  # Fetch the role, modify it to remove the undesired permissions, add the new permission and increment its version
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' \
    -X GET '<grafana_url>/api/access-control/roles/basic_viewer' | \
    jq 'del(.created)| del(.updated) | del(.permissions[].created) | del(.permissions[].updated) | .version += 1' | \
    jq 'del(.permissions[] | select (.action == "plugins.app:access" and .scope == "plugins:*"))' | \
    jq '.permissions += [{"action": "plugins.app:access", "scope": "plugins:id:kentik-connect-app"}]' > /tmp/basic_viewer.json

  # Update the role
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' -H 'Content-Type: application/json' \
    -X PUT -d @/tmp/basic_viewer.json '<grafana_url>/api/access-control/roles/basic_viewer'
  ```

  The token that is used in this request is the [service account token](ref:service-accounts).

- Or use the `role > from` list and `permission > state` option of your provisioning file:

  ```yaml
  ---
  apiVersion: 2

  roles:
    - name: 'basic:viewer'
      version: 8
      global: true
      from:
        - name: 'basic:viewer'
          global: true
      permissions:
        - action: 'plugins.app:access'
          scope: 'plugins:*'
          state: 'absent'
        - action: 'plugins.app:access'
          scope: 'plugins:id:kentik-connect-app'
          state: 'present'
  ```

  If your goal is to remove an access to an app you should remove it from the role and update it. For example:

  ```bash
  # Fetch the role, modify it to remove permissions to kentik-connect-app and increment role version
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' \
    -X GET '<grafana_url>/api/access-control/roles/basic_viewer' | \
    jq 'del(.created)| del(.updated) | del(.permissions[].created) | del(.permissions[].updated) | .version += 1' | \
    jq 'del(.permissions[] | select (.action == "plugins.app:access" and .scope == "plugins:id:kentik-connect-app"))'

  # Update the role
  curl -H 'Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt' -H 'Content-Type: application/json' \
    -X PUT -d @/tmp/basic_viewer.json '<grafana_url>/api/access-control/roles/basic_viewer'
  ```

### Manage user permissions through teams

In the scenario where you want users to grant access by the team they belong to, we recommend to set users role to `No Basic Role` and let the team assignment assign the role instead.

1. In Grafana, ensure the following configuration settings are enabled.

   ```
   [users]
   # Set to true to automatically assign new users to the default organization (id 1)
   auto_assign_org = true

   # Set this value to automatically add new users to the provided organization (if auto_assign_org above is set to true)
   auto_assign_org_id = <org_id>

   # Default role new users will be automatically assigned (if auto_assign_org above is set to true)
   auto_assign_org_role = None
   ```

1. Restart the Grafana instance.
1. Create a team with the desired name.
1. Assign fixed roles to the team.
1. Add users to the team.

A user will be added to the default organization automatically but won't have any permissions until assigned to a team.

### Reduce scope of service accounts

Using Service Accounts is an efficient way to facilitate M2M communications. However, they can pose a security threat if not scoped appropriately. To limit the scope of a service account, you can begin by creating a Service Account with `No Basic Role` and then assign the necessary permissions for the account.

1. Refer to [Service Accounts](ref:service-accounts) and add a new Service Account.
1. Set the basic role to `No Basic Role`.
1. Set the fixed roles needed for the Service Account.

This will reduce the required permissions for the Service Account and minimize the risk of compromise.
