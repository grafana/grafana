---
aliases:
  - ../../../enterprise/access-control/manage-rbac-roles/
  - ../../../enterprise/access-control/manage-role-assignments/
  - ../../../enterprise/access-control/provisioning/
description: Learn how to view permissions associated with roles, create custom roles,
  and update and delete roles in Grafana.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Manage RBAC roles
title: Manage Grafana RBAC roles
weight: 50
refs:
  configure-rbac-configure-rbac-in-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/configure-rbac/#configure-rbac-in-grafana
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
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/plan-rbac-rollout-strategy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/plan-rbac-rollout-strategy/
  custom-role-actions-scopes:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/custom-role-actions-scopes/
  rbac-grafana-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-grafana-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-grafana-provisioning/
  rbac-role-definitions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/
  rbac-fixed-basic-role-definitions-basic-role-assignments:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
---

# Manage RBAC roles

{{% admonition type="note" %}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).
{{% /admonition %}}

{{< table-of-contents >}}

This section includes instructions for how to view permissions associated with roles, create custom roles, and update and delete roles.

The following example includes the base64 username:password Basic Authorization. You cannot use authorization tokens in the request.

## List permissions associated with roles

Use a `GET` command to see the actions and scopes associated with a role. For more information about seeing a list of permissions for each role, refer to [Get a role](ref:api-rbac-get-a-role).

To see the permissions associated with basic roles, refer to the following basic role UIDs:

| Basic role      | UID                   |
| --------------- | --------------------- |
| `None`          | `basic_none`          |
| `Viewer`        | `basic_viewer`        |
| `Editor`        | `basic_editor`        |
| `Admin`         | `basic_admin`         |
| `Grafana Admin` | `basic_grafana_admin` |

**Example request**

```
curl --location --request GET '<grafana_url>/api/access-control/roles/qQui_LCMk' --header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ='
```

**Example response**

```
{
    "version": 2,
    "uid": "qQui_LCMk",
    "name": "fixed:users:writer",
    "displayName": "User writer",
    "description": "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
    "global": true,
    "permissions": [
        {
            "action": "org.users:add",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        },
        {
            "action": "org.users:read",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        },
        {
            "action": "org.users:remove",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        },
        {
            "action": "org.users:write",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        }
    ],
    "updated": "2021-05-17T20:49:18+02:00",
    "created": "2021-05-13T16:24:26+02:00"
}
```

Refer to the [RBAC HTTP API](ref:api-rbac-get-a-role) for more details.

## Create custom roles

This section shows you how to create a custom RBAC role using Grafana provisioning and the HTTP API.

Create a custom role when basic roles and fixed roles do not meet your permissions requirements.

**Before you begin:**

- [Plan your RBAC rollout strategy](ref:plan-rbac-rollout-strategy).
- Determine which permissions you want to add to the custom role. To see a list of actions and scope, refer to [RBAC permissions, actions, and scopes](ref:custom-role-actions-scopes).
- [Enable role provisioning](ref:rbac-grafana-provisioning).
- Ensure that you have permissions to create a custom role.
  - By default, the Grafana Admin role has permission to create custom roles.
  - A Grafana Admin can delegate the custom role privilege to another user by creating a custom role with the relevant permissions and adding the `permissions:type:delegate` scope.

### Create custom roles using provisioning

[File-based provisioning](ref:rbac-grafana-provisioning) is one method you can use to create custom roles.

1. Open the YAML configuration file and locate the `roles` section.

1. Refer to the following table to add attributes and values.

| Attribute     | Description                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | A human-friendly identifier for the role that helps administrators understand the purpose of a role. `name` is required and cannot be longer than 190 characters. We recommend that you use ASCII characters. Role names must be unique within an organization.                                                                                                                                                      |
| `uid`         | A unique identifier associated with the role. The UID enables you to change or delete the role. You can either generate a UID yourself, or let Grafana generate one for you. You cannot use the same UID within the same Grafana instance.                                                                                                                                                                           |
| `orgId`       | Identifies the organization to which the role belongs. The [default org ID](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#auto_assign_org_id) is used if you do not specify `orgId`.                                                                                                                                                                                                              |
| `global`      | Global roles are not associated with any specific organization, which means that you can reuse them across all organizations. This setting overrides `orgId`.                                                                                                                                                                                                                                                        |
| `displayName` | Human-friendly text that is displayed in the UI. Role display name cannot be longer than 190 ASCII-based characters. For fixed roles, the display name is shown as specified. If you do not set a display name the display name replaces `':'` (a colon) with `' '` (a space).                                                                                                                                       |
| `description` | Human-friendly text that describes the permissions a role provides.                                                                                                                                                                                                                                                                                                                                                  |
| `group`       | Organizes roles in the role picker.                                                                                                                                                                                                                                                                                                                                                                                  |
| `version`     | A positive integer that defines the current version of the role, which prevents overwriting newer changes.                                                                                                                                                                                                                                                                                                           |
| `hidden`      | Hidden roles do not appear in the role picker.                                                                                                                                                                                                                                                                                                                                                                       |
| `state`       | State of the role. Defaults to `present`, but if set to `absent` the role will be removed.                                                                                                                                                                                                                                                                                                                           |
| `force`       | Can be used in addition to state `absent`, to force the removal of a role and all its assignments.                                                                                                                                                                                                                                                                                                                   |
| `from`        | An optional list of roles from which you want to copy permissions.                                                                                                                                                                                                                                                                                                                                                   |
| `permissions` | Provides users access to Grafana resources. For a list of permissions, refer to [RBAC permissions actions and scopes](ref:rbac-role-definitions). If you do not know which permissions to assign, you can create and assign roles without any permissions as a placeholder. Using the `from` attribute, you can specify additional permissions or permissions to remove by adding a `state` to your permission list. |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations](/docs/grafana/<GRAFANA_VERSION>/developers/http_api/admin/#reload-provisioning-configurations).

The following example creates a local role:

```yaml
# config file version
apiVersion: 2

roles:
  - name: custom:users:writer
    description: 'List, create, or update other users.'
    version: 1
    orgId: 1
    permissions:
      - action: 'users:read'
        scope: 'global.users:*'
      - action: 'users:write'
        scope: 'global.users:*'
      - action: 'users:create'
```

The following example creates a hidden global role. The `global: true` option creates a global role, and the `hidden: true` option hides the role from the role picker.

```yaml
# config file version
apiVersion: 2

roles:
  - name: custom:users:writer
    description: 'List, create, or update other users.'
    version: 1
    global: true
    hidden: true
    permissions:
      - action: 'users:read'
        scope: 'global.users:*'
      - action: 'users:write'
        scope: 'global.users:*'
      - action: 'users:create'
```

The following example creates a global role based on other fixed roles. The `from` option contains the roles from which we want to
copy permissions. The permission `state: absent` option can be used to specify permissions to exclude from the copy.

```yaml
# config file version
apiVersion: 2

roles:
  - name: custom:org.users:writer
    description: 'List and remove other users from the organization.'
    version: 1
    global: true
    from:
      - name: 'fixed:org.users:reader'
        global: true
      - name: 'fixed:org.users:writer'
        global: true
    permissions:
      - action: 'org.users:write'
        scope: 'users:*'
        state: 'absent'
      - action: 'org.users:add'
        scope: 'users:*'
        state: 'absent'
```

### Create custom roles using the HTTP API

The following examples show you how to create a custom role using the Grafana HTTP API. For more information about the HTTP API, refer to [Create a new custom role](ref:api-rbac-create-a-new-custom-role).

{{% admonition type="note" %}}
You cannot create a custom role with permissions that you do not have. For example, if you only have `users:create` permissions, then you cannot create a role that includes other permissions.
{{% /admonition %}}

The following example creates a `custom:users:admin` role and assigns the `users:create` action to it.

**Example request**

```
curl --location --request POST '<grafana_url>/api/access-control/roles/' \
--header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=' \
--header 'Content-Type: application/json' \
--data-raw '{
    "version": 1,
    "uid": "jZrmlLCkGksdka",
    "name": "custom:users:admin",
    "displayName": "custom users admin",
    "description": "My custom role which gives users permissions to create users",
    "global": true,
    "permissions": [
        {
            "action": "users:create"
        }
    ]
}'
```

**Example response**

```
{
    "version": 1,
    "uid": "jZrmlLCkGksdka",
    "name": "custom:users:admin",
    "displayName": "custom users admin",
    "description": "My custom role which gives users permissions to create users",
    "global": true,
    "permissions": [
        {
            "action": "users:create"
            "updated": "2021-05-17T22:07:31.569936+02:00",
            "created": "2021-05-17T22:07:31.569935+02:00"
        }
    ],
    "updated": "2021-05-17T22:07:31.564403+02:00",
    "created": "2021-05-17T22:07:31.564403+02:00"
}
```

Refer to the [RBAC HTTP API](ref:api-rbac-create-a-new-custom-role) for more details.

## Update basic role permissions

If the default basic role definitions do not meet your requirements, you can change their permissions.

**Before you begin:**

- Determine the permissions you want to add or remove from a basic role. For more information about the permissions associated with basic roles, refer to [RBAC role definitions](ref:rbac-fixed-basic-role-definitions-basic-role-assignments).

{{% admonition type="note" %}}
You cannot modify the `No Basic Role` permissions.
{{% /admonition %}}

**To change permissions from a basic role:**

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

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations](/docs/grafana/<GRAFANA_VERSION>/developers/http_api/admin/#reload-provisioning-configurations).

The following example modifies the `Grafana Admin` basic role permissions.

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

{{% admonition type="note" %}}
You can add multiple `fixed`, `basic` or `custom` roles to the `from` section. Their permissions will be copied and added to the basic role.
Make sure to **increment** the role version for the changes to be accounted for.
{{% /admonition %}}

You can also change basic roles' permissions using the API. Refer to the [RBAC HTTP API](ref:api-rbac-update-a-role) for more details.

## Reset basic roles to their default

This section describes how to reset the basic roles to their default.

You have two options to reset the basic roles permissions to their default.

### Use the configuration option

> **Note**: Available as of Grafana Enterprise 9.4.

> Warning: If this option is left to true, permissions will be reset on every boot.

Use the [reset_basic_roles](ref:configure-rbac-configure-rbac-in-grafana) option to reset
basic roles permissions to their default on Grafana instance boot up.

1. Open you configuration file and update the rbac section as follow:

```bash
[rbac]
reset_basic_roles = true
```

### Use the http endpoint

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

## Delete a custom role using Grafana provisioning

Delete a custom role when you no longer need it. When you delete a custom role, the custom role is removed from users and teams to which it is assigned.

**Before you begin:**

- Identify the role or roles that you want to delete.
- Ensure that you have access to the YAML configuration file.

**To delete a custom role:**

1. Open the YAML configuration file and locate the `roles` section.

1. Refer to the following table to add attributes and values.

   | Attribute | Description                                                                                                                                |
   | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
   | `name`    | The name of the custom role you want to delete. You can specify a `uid` instead of a role name. The role `name` or the `uid` are required. |
   | `orgId`   | Identifies the organization to which the role belongs.                                                                                     |
   | `state`   | The state of the role set to `absent` to trigger its removal.                                                                              |
   | `force`   | When set to `true`, the roles are removed even if there are existing assignments.                                                          |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations](/docs/grafana/<GRAFANA_VERSION>/developers/http_api/admin/#reload-provisioning-configurations).

The following example deletes a custom role:

```yaml
# config file version
apiVersion: 2

roles:
  - name: 'custom:reports:editor'
    orgId: 1
    state: 'absent'
    force: true
```

You can also delete a custom role using the API. Refer to the [RBAC HTTP API](ref:api-rbac-delete-a-custom-role) for more details.
