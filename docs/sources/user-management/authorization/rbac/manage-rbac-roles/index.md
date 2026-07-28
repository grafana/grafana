---
aliases:
  - ../../../enterprise/access-control/manage-rbac-roles/
  - ../../../enterprise/access-control/manage-role-assignments/
  - ../../../enterprise/access-control/provisioning/
  - ../../../administration/roles-and-permissions/access-control/manage-rbac-roles/
description: Learn how to view permissions associated with roles, create custom roles,
  and update and delete roles in Grafana.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Manage RBAC roles
title: Manage Grafana RBAC roles
weight: 70
refs:
  configure-rbac-configure-rbac-in-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/configure-rbac/#configure-rbac-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/configure-rbac/#configure-rbac-in-grafana
  api-rbac-reset-basic-roles-to-their-default:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#reset-basic-roles-to-their-default
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#reset-basic-roles-to-their-default
  api-rbac-delete-a-custom-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#delete-a-custom-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#delete-a-custom-role
  api-rbac-update-a-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#update-a-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#update-a-role
  api-rbac-get-a-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#get-a-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#get-a-role
  api-rbac-create-a-new-custom-role:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/access_control/#create-a-new-custom-role
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/access_control/#create-a-new-custom-role
  plan-rbac-rollout-strategy:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/plan-rbac-rollout-strategy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/plan-rbac-rollout-strategy/
  custom-role-actions-scopes:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/custom-role-actions-scopes/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/custom-role-actions-scopes/
  rbac-terraform-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/rbac-terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-terraform-provisioning/
  rbac-grafana-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/rbac-grafana-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-grafana-provisioning/
  rbac-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/rbac-fixed-basic-role-definitions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/
  rbac-fixed-basic-role-definitions-basic-role-assignments:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/rbac-fixed-basic-role-definitions/#basic-role-assignments
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
  rbac-for-app-plugins:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/rbac-for-app-plugins/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-for-app-plugins/
  assign-rbac-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/authorization/rbac/assign-rbac-roles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/assign-rbac-roles/
  service-accounts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/user-management/user-identity/service-accounts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/
---

# Manage RBAC roles

{{< admonition type="note" >}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).
{{< /admonition >}}

This section includes instructions for how to view permissions associated with roles, create custom roles, and update and delete roles.

## View basic role definitions

You can retrieve the full definition of a basic role, including all associated permissions, using the API or by navigating directly to the endpoint URL in your browser while logged in as an Admin.

### Using the API

To get the definition of a basic role:

```bash
GET /api/access-control/roles/basic_<role>
```

Where `<role>` is one of: `viewer`, `editor`, `admin`, or `grafana_admin`.

For example, to get the Viewer role definition:

```bash
curl --location 'https://<your-stack-name>.grafana.net/api/access-control/roles/basic_viewer' \
  --header 'Authorization: Bearer <service-account-token>'
```

### Using the browser

You can also view the role definition directly in your browser by navigating to:

```
https://<your-stack-name>.grafana.net/api/access-control/roles/basic_viewer
```

This works when logged in as an Admin user.

For more information, refer to [Get a role](ref:api-rbac-get-a-role).

For a reference of basic and fixed role assignments, refer to [RBAC role definitions](ref:rbac-role-definitions).

## Update role permissions

If the default basic role permissions don't meet your requirements you can change them.

Basic roles are mutable. You can add or remove individual permissions on the `Viewer`, `Editor`, `Admin`, and `Grafana Admin` roles without creating a custom role. Each permission is a combination of an `action` and a `scope`. For example, you can remove access to a specific app plugin from all viewers by removing the relevant permissions from the `basic:viewer` role.

Before you change basic role permissions, decide which roles to modify and how the change affects your users and teams. For planning guidance, refer to [Plan your RBAC rollout strategy](ref:plan-rbac-rollout-strategy).

{{< admonition type="caution" >}}
Changes that you make to a basic role apply to every [organization](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/user-management/authorization/organization-management/) in the Grafana instance. For example, if you add the `fixed:users:writer` role's permissions to the `Viewer` basic role, all viewers in every organization in the instance can create users.

Basic role changes are scoped to a single Grafana instance. On Grafana Cloud, each stack is a separate instance, so you must apply the change to each stack individually.
{{< /admonition >}}

{{< admonition type="note" >}}
If you only need to change access for specific users or teams rather than for every viewer, editor, or admin, leave the basic roles unchanged. Instead, assign the `No Basic Role` organization role and grant fixed or custom roles to those users or teams. For more information, refer to [Assign RBAC roles](ref:assign-rbac-roles).
{{< /admonition >}}

You can change basic roles' permissions [via the configuration file](#update-basic-role-permissions-in-the-configuration-file) or [using the RBAC API](#update-basic-role-permissions-using-the-rbac-api).

### Update basic role permissions in the configuration file

Before you begin, determine the permissions you want to add or remove from a basic role. For more information about the permissions associated with basic roles, refer to [RBAC role definitions](ref:rbac-fixed-basic-role-definitions-basic-role-assignments).

{{< admonition type="note" >}}
You cannot modify the `None` permissions.
{{< /admonition >}}

To change permissions for a basic role:

1. Open the YAML configuration file and locate the `roles` section.

1. Refer to the following table to add attributes and values.

   | Attribute             | Description                                                                                                                                               |
   | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`                | The name of the basic role you want to update. You can specify a `uid` instead of a role name. The role `name` or the `uid` are required.                 |
   | `orgId`               | Identifies the organization to which the role belongs. `global` can be used instead to specify it's a global role.                                        |
   | `version`             | Identifies the version of the role, which prevents overwriting newer changes.                                                                             |
   | `overrideRole`        | If set to true, role will be updated regardless of its version in the database. There is no need to specify `version` if `overrideRole` is set to `true`. |
   | `from`                | List of roles from which to copy permissions.                                                                                                             |
   | `permissions > state` | The state of the permission. You can set it to `absent` to ensure it exclusion from the copy list.                                                        |

1. Reload the provisioning configuration file. For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/admin/#reload-provisioning-configurations).

#### Example: Modify the Grafana Admin role

The following example modifies the `Grafana Admin` basic role permissions.

In the new configuration:

- Permissions to list, grant, and revoke roles to teams are removed.
- Permission to read and write Grafana folders is added.

```yaml
# config file version
apiVersion: 2

roles:
  - name: 'basic:grafana_admin'
    global: true
    version: 3
    from:
      - name: 'basic:grafana_admin'
        global: true
    permissions:
      # Permissions to remove
      - action: 'teams.roles:read'
        scope: 'teams:*'
        state: 'absent'
      - action: 'teams.roles:remove'
        scope: 'permissions:type:delegate'
        state: 'absent'
      - action: 'teams.roles:add'
        scope: 'permissions:type:delegate'
        state: 'absent'
      # Permissions to add
      - action: 'folders:read'
        scope: 'folder:*'
      - action: 'folders:write'
        scope: 'folder:*'
```

{{< admonition type="note" >}}
You can add multiple `fixed`, `basic` or `custom` roles to the `from` section. Their permissions will be copied and added to the basic role.
Make sure to **increment** the role version for the changes to be accounted for.
{{< /admonition >}}

### Update basic role permissions using the RBAC API

Use the RBAC HTTP API when you want to change basic role permissions programmatically, for example from a script or a CI pipeline. The API uses two endpoints:

- `GET /api/access-control/roles/{roleUID}` returns a basic role and all of its permissions. Refer to [Get a role](ref:api-rbac-get-a-role).
- `PUT /api/access-control/roles/{roleUID}` replaces the role's permissions with the set that you send. Refer to [Update a role](ref:api-rbac-update-a-role).

Basic role UIDs follow the pattern `basic_<role>`, where `<role>` is `viewer`, `editor`, `admin`, or `grafana_admin`.

Because `PUT` replaces the entire permission set, fetch the current role first, modify its permissions, increment its `version`, and then send the result back. Each request authenticates with a [service account token](ref:service-accounts) that has the `Role writer` role, or with basic authentication as a `Grafana Admin`.

{{< admonition type="note" >}}
Send `global: true` in the request body when you update a global basic role, and set `version` to a value higher than the current version. Grafana rejects updates that don't increase the version.
{{< /admonition >}}

#### Example: Modify the Grafana Admin role using the API

The following example makes the same change as the [configuration file example](#example-modify-the-grafana-admin-role) using the API instead. It removes the permissions to list, grant, and revoke roles to teams, and adds permissions to read and write Grafana folders.

The script fetches the `basic:grafana_admin` role, removes and adds permissions with `jq`, increments the version, and updates the role:

```bash
# Fetch the role, modify its permissions, and increment its version
curl -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" \
  -X GET '<GRAFANA_URL>/api/access-control/roles/basic_grafana_admin' | \
  jq 'del(.created) | del(.updated) | del(.permissions[].created) | del(.permissions[].updated) | .version += 1' | \
  jq 'del(.permissions[] | select(.action == "teams.roles:read")) | del(.permissions[] | select(.action == "teams.roles:add")) | del(.permissions[] | select(.action == "teams.roles:remove"))' | \
  jq '.permissions += [{"action": "folders:read", "scope": "folders:*"}, {"action": "folders:write", "scope": "folders:*"}]' > basic_grafana_admin.json

# Update the role with the modified permissions
curl -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" -H "Content-Type: application/json" \
  -X PUT -d @basic_grafana_admin.json \
  '<GRAFANA_URL>/api/access-control/roles/basic_grafana_admin'
```

Replace the following placeholders:

- _`<SERVICE_ACCOUNT_TOKEN>`_: A service account token with permission to read and write roles, for example `glsa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`. To use basic authentication instead, replace the `Authorization` header with `-u admin:<PASSWORD>`.
- _`<GRAFANA_URL>`_: The base URL of your Grafana instance, for example `https://<YOUR_STACK_NAME>.grafana.net` on Grafana Cloud or `http://localhost:3000` for a local instance.

The `jq` filters first strip the read-only `created` and `updated` timestamps and increment the role `version`, then remove the unwanted permissions, and finally append the new ones. The `PUT` request sends the resulting role definition back to Grafana.

#### Example: Remove Grafana Assistant access from Viewers

By default, viewers can access all app plugins that their organization role allows, including Grafana Assistant. To prevent viewers from accessing Grafana Assistant, remove the following permissions from the `basic:viewer` role:

| Action                               | Scope                              |
| ------------------------------------ | ---------------------------------- |
| `grafana-assistant-app.chats:access` |                                    |
| `plugins.app:access`                 | `plugins:id:grafana-assistant-app` |

You can remove these permissions with the configuration file or with the API.

Use the `role > from` list and `permission > state` option of your provisioning file to remove the permissions:

```yaml
apiVersion: 2

roles:
  - name: 'basic:viewer'
    global: true
    version: 9
    from:
      - name: 'basic:viewer'
        global: true
    permissions:
      - action: 'grafana-assistant-app.chats:access'
        state: 'absent'
      - action: 'plugins.app:access'
        scope: 'plugins:id:grafana-assistant-app'
        state: 'absent'
```

Alternatively, use the RBAC HTTP API. The following script fetches the `basic:viewer` role, removes the two Grafana Assistant permissions, increments the version, and updates the role:

```bash
# Fetch the role, remove the Grafana Assistant permissions, and increment its version
curl -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" \
  -X GET '<GRAFANA_URL>/api/access-control/roles/basic_viewer' | \
  jq 'del(.created) | del(.updated) | del(.permissions[].created) | del(.permissions[].updated) | .version += 1' | \
  jq 'del(.permissions[] | select(.action == "grafana-assistant-app.chats:access")) | del(.permissions[] | select(.action == "plugins.app:access" and .scope == "plugins:id:grafana-assistant-app"))' > basic_viewer.json

# Update the role with the modified permissions
curl -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" -H "Content-Type: application/json" \
  -X PUT -d @basic_viewer.json \
  '<GRAFANA_URL>/api/access-control/roles/basic_viewer'
```

Replace the following placeholders:

- _`<SERVICE_ACCOUNT_TOKEN>`_: A service account token with permission to read and write roles.
- _`<GRAFANA_URL>`_: The base URL of your Grafana instance.

To find the IDs of other app plugins, refer to [RBAC for app plugins](ref:rbac-for-app-plugins). That page also explains how to grant fine-grained app plugin access to specific users and teams without changing the basic roles.

## Reset basic roles to their default

You have two options to reset the basic roles permissions to their default.

### Use the configuration option

> **Note**: Available as of Grafana Enterprise 9.4.

> Warning: If this option is left to true, permissions will be reset on every boot.

Use the [`reset_basic_roles`](ref:configure-rbac-configure-rbac-in-grafana) option to reset basic roles permissions to their default on Grafana instance boot up.

1. Open you configuration file and update the rbac section as follow:

```bash
[rbac]
reset_basic_roles = true
```

### Use the HTTP endpoint

An alternative to the configuration option is to use the HTTP endpoint.

1. Open the YAML configuration file and locate the `roles` section.

1. Grant the `action: "roles:write", scope: "permissions:type:escalate` permission to `Grafana Admin`. Note that this permission has not been granted to any basic roles by default, because users could acquire more permissions than they previously had through the basic role permissions reset.

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
         # Permission allowing to reset basic roles
         - action: 'roles:write'
           scope: 'permissions:type:escalate'
   ```

1. As a `Grafana Admin`, call the API endpoint to reset the basic roles to their default. Refer to the [RBAC HTTP API](ref:api-rbac-reset-basic-roles-to-their-default) for more details.
