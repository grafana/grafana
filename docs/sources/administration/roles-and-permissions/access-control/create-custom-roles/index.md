---
aliases:
  - ../manage-rbac-roles#create-custom-roles
description: Create custom RBAC roles.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Create custom roles
title: Create custom Grafana RBAC roles
weight: 55
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
  rbac-terraform-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-terraform-provisioning/
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
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/access-control/rbac-fixed-basic-role-definitions/#basic-role-assignments
---

# Create custom RBAC roles

{{< admonition type="note" >}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).
{{< /admonition >}}

Create a custom RBAC role when basic roles and fixed roles do not meet your permissions requirements. For a list of the actions and scopes you can customize a role with, refer to [Grafana RBAC permission actions and scopes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

{{< admonition type="caution" >}}
**Before creating custom roles**, consider whether you can meet your access requirements using:

- **[Folder permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/folder-access-control/)**: Control access to dashboards, alert rules, and other resources by folder
- **[Fixed roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/)**: Pre-built roles for common access patterns

Use custom roles only when you need fine-grained control that these options don't provide.
{{< /admonition >}}

Creating and editing custom roles is not currently possible in the Grafana UI. Instead, use one of the following methods:

- The [RBAC HTTP API](#create-custom-roles-using-the-http-api)
- [Terraform](#create-custom-roles-using-terraform)
- [Grafana provisioning](#create-custom-roles-using-file-based-provisioning) using a YAML file

## Before you begin

Before you begin, keep in mind the following:

- [Plan your RBAC rollout strategy](ref:plan-rbac-rollout-strategy).
- Determine which permissions you want to add to the custom role. To see a list of actions and scope, refer to [RBAC permissions, actions, and scopes](ref:custom-role-actions-scopes).
- Ensure that you have permissions to create a custom role.
  - By default, the Grafana Admin role has permission to create custom roles.
  - A Grafana Admin can delegate the custom role privilege to another user by creating a custom role with the relevant permissions and adding the `permissions:type:delegate` scope.

## Create custom roles using the HTTP API

The following examples show you how to create a custom role using the Grafana HTTP API. For more information about the HTTP API, refer to [Create a new custom role](ref:api-rbac-create-a-new-custom-role).

{{< admonition type="note" >}}
When you create a custom role you can only give it the same permissions you already have. For example, if you only have `users:create` permissions, then you can't create a role that includes other permissions.
{{< /admonition >}}

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
            "action": "users:create",
            "updated": "2021-05-17T22:07:31.569936+02:00",
            "created": "2021-05-17T22:07:31.569935+02:00"
        }
    ],
    "updated": "2021-05-17T22:07:31.564403+02:00",
    "created": "2021-05-17T22:07:31.564403+02:00"
}
```

Refer to the [RBAC HTTP API](ref:api-rbac-create-a-new-custom-role) for more details.

## Create custom roles using Terraform

You can use the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to manage custom roles and their assignments. This is the recommended method for Grafana Cloud users who want to manage RBAC as code. For more information, refer to [Provisioning RBAC with Terraform](ref:rbac-terraform-provisioning).

The following example creates a custom role and assigns it to a team:

```terraform
resource "grafana_role" "custom_folder_manager" {
  name        = "custom:folders:manager"
  description = "Custom role for reading and creating folders"
  uid         = "custom-folders-manager"
  version     = 1
  global      = true

  permissions {
    action = "folders:read"
    scope  = "folders:*"
  }

  permissions {
    action = "folders:create"
    scope  = "folders:uid:general" # Allows creating folders at the root level
  }
}

resource "grafana_role_assignment" "custom_folder_manager_assignment" {
  role_uid = grafana_role.custom_folder_manager.uid
  teams    = ["<TEAM_UID>"]
}
```

For more information, refer to the [`grafana_role`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role) and [`grafana_role_assignment`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role_assignment) documentation in the Terraform Registry.

## Create custom roles using file-based provisioning

You can use [file-based provisioning](ref:rbac-grafana-provisioning) to create custom roles for self-managed instances.

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
