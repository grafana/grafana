---
title: 'Manage RBAC roles'
menuTitle: 'Manage RBAC roles'
description: 'Learn how to view permissions associated with roles, create custom roles, and update and delete roles in Grafana.'
aliases:
  [
    '/docs/grafana/latest/enterprise/access-control/manage-role-assignments/',
    '/docs/grafana/latest/enterprise/access-control/provisioning/',
  ]
weight: 50
---

# Manage RBAC roles

This section includes instructions for how to view permissions associated with roles, create custom roles, and update and delete roles.

## View basic role assignments using the HTTP API

You can use the [RBAC HTTP API]({{< relref "../../http_api/access_control.md#get-all-built-in-role-assignments" >}}) to see all available basic role assignments.
The response contains a mapping between one of the organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin` to the custom or fixed roles.

**Before you begin:**

- [Enable role-based access control]({{< relref "./enable-rbac-and-provisioning#enable-rback" >}}).

The following example includes the base64 username:password Basic Authorization. You cannot use authorization tokens in the request.

**Example request**

```
curl --location --request GET '<grafana_url>/api/access-control/builtin-roles' --header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ='
```

**Example response**

```
{
    "Admin": [
        ...
        {
            "version": 2,
            "uid": "qQui_LCMk",
            "name": "fixed:users:org:writer",
            "displayName": "Users Organization writer",
            "description": "Within a single organization, add a user, invite a user, read information about a user and their role, remove a user from that organization, or change the role of a user.",
            "global": true,
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        },
        {
            "version": 1,
            "uid": "Kz9m_YjGz",
            "name": "fixed:reports:writer",
            "displayName": "Report writer",
            "description": "Create, read, update, or delete all reports and shared report settings.",
            "global": true,
            "updated": "2021-05-13T16:24:26+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        }
        ...
    ],
    "Grafana Admin": [
        ...
        {
            "version": 2,
            "uid": "qQui_LCMk",
            "name": "fixed:users:writer",
            "displayName": "User writer",
            "description": "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
            "global": true,
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        },
        {
            "version": 2,
            "uid": "ajum_YjGk",
            "name": "fixed:users:reader",
            "displayName": "User reader",
            "description": "Allows every read action for user organizations and in addition allows to administer user organizations.",
            "global": true,
            "updated": "2021-05-17T20:49:17+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        },
        ...
    ]
}
```

### List permissions associated with roles

Use a `GET` command to see the actions and scopes associated with a role. For more information about seeing a list of permissions for each role, refer to [Get a role]({{< relref "../../http_api/access_control.md#get-a-role" >}}).

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
            "action": "org.users.role:update",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        }
    ],
    "updated": "2021-05-17T20:49:18+02:00",
    "created": "2021-05-13T16:24:26+02:00"
}
```

Refer to the [RBAC HTTP API]({{< relref "../../http_api/access_control.md#get-a-role" >}}) for more details.

## Create custom roles

This section shows you how to create a custom RBAC role using Grafana provisioning and the HTTP API.

Create a custom role when basic roles and fixed roles do not meet your permissions requirements.

**Before you begin:**

- [Plan your RBAC rollout strategy]({{< relref "./plan-rbac-rollout-strategy" >}}).
- Determine which permissions you want to add to the custom role. To see a list of actions and scope, refer to [RBAC permissions actions and scopes]({{< relref "./custom-role-actions-scopes.md" >}}).
- [Enable role provisioning]({{< relref "./enable-rbac-and-provisioning#enable-rbac" >}}).
- Ensure that you have permissions to create a custom role.
  - By default, the Grafana Admin role has permission to create custom roles.
  - A Grafana Admin can delegate the custom role privilege to another user by creating a custom role with the relevant permissions and adding the `permissions:delegate` scope.

### Create custom roles using provisioning

File-based provisioning is one method you can use to create custom roles.

1. Open the YAML configuration file and locate the `roles` section.

1. Refer to the following table to add attributes and values.

   | Attribute           | Description                                                                                                                                                                                                                                                                                                                                                                                       |
   | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`              | A human-friendly identifier for the role that helps administrators understand the purpose of a role. `name` is required and cannot be longer than 190 characters. We recommend that you use ASCII characters. Role names must be unique within an organization.                                                                                                                                   |
   | `Role display name` | Human-friendly text that is displayed in the UI. Role display name cannot be longer than 190 ASCII-based characters. For fixed roles, the display name is shown as specified. If you do not set a display name the display name replaces a `:` (a colon) with ` ` (a space).                                                                                                                      |
   | `Display name`      | A human-friendly identifier that appears in the role picker UI. `Display name` helps the user to understand the purpose of the role.                                                                                                                                                                                                                                                              |
   | `Group`             | Organizes roles in the role picker.                                                                                                                                                                                                                                                                                                                                                               |
   | `version`           | A positive integer that defines the current version of the role. When you update a role, you can either omit the version field to increment the previous value by 1, or set a new version which must be larger than the previous version.                                                                                                                                                         |
   | `permissions`       | Provides users access to Grafana resources. For a list of permissions, refer to [RBAC permissions actions and scopes]({{< relref "./rbac-fixed-basic-role-definitions.md" >}}). If you do not know which permissions to assign, you can create and assign roles without any permissions as a placeholder.                                                                                         |
   | `Role UID`          | A unique identifier associated with the role. The UID enables you to change or delete the role. You can either generate a UID yourself, or let Grafana generate one for you. You cannot use the same UID within the same Grafana instance.                                                                                                                                                        |
   | `orgId`             | Identifies the organization to which the role belongs. If you do not specify `orgId`, the `orgId` is inherited from `role`. For global roles, the default `orgId` is used. `orgId` in the `role` and in the assignment must be the same for non-global roles. The [default org ID]({{< relref "../../administration/configuration#auto_assign_org_id" >}}) is used if you do not specify `orgId`. |
   | `global`            | Global roles are not associated with any specific organization, which means that you can reuse them across all organizations. This setting overrides `orgId`.                                                                                                                                                                                                                                     |
   | `hidden`            | Hidden roles do not appear in the role picker.                                                                                                                                                                                                                                                                                                                                                    |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example creates a local role:

```yaml
# config file version
apiVersion: 1

# Roles to insert into the database, or roles to update in the database
roles:
  - name: custom:users:editor
    description: 'This role allows users to list, create, or update other users within the organization.'
    version: 1
    orgId: 1
    permissions:
      - action: 'users:read'
        scope: 'users:*'
      - action: 'users:write'
        scope: 'users:*'
      - action: 'users:create'
        scope: 'users:*'
```

The following example creates a hidden global role. The `global:true` option creates a global role, and the `hidden:true` option hides the role from the role picker.

```yaml
# config file version
apiVersion: 1

# Roles to insert into the database, or roles to update in the database
roles:
  - name: custom:users:editor
    description: 'This role allows users to list, create, or update other users within the organization.'
    version: 1
    global: true
    hidden: true
    permissions:
      - action: 'users:read'
        scope: 'users:*'
      - action: 'users:write'
        scope: 'users:*'
      - action: 'users:create'
        scope: 'users:*'
```

### Create custom roles using the HTTP API

The following examples show you how to create a custom role using the Grafana HTTP API. For more information about the HTTP API, refer to [Create a new custom role]({{< relref "../../http_api/access_control.md#create-a-new-custom-role" >}}).

> **Note:** You cannot create a custom role with permissions that you do not have. For example, if you only have `users:create` permissions, then you cannot create a role that includes other permissions.

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

</br>

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

Refer to the [RBAC HTTP API]({{< relref "../../http_api/access_control.md#create-a-new-custom-role" >}}) for more details.

## Remove a fixed role from a basic role

If the basic role definitions that are available by default do not meet your requirements, you can change them by removing fixed role permissions from basic roles.

</br>

**Before you begin:**

- Determine the fixed roles you want to remove from a basic role. For more information about the fixed roles associated with basic roles, refer to [RBAC role definitions]({{< relref "./rbac-fixed-basic-role-definitions#basic-role-assignments" >}}).

</br>

**To remove a fixed role from a basic role:**

1. Open the YAML configuration file and locate the `removeDefaultAssignments` section.

1. Refer to the following table to add attributes and values.

   | Attribute     | Description                       |
   | ------------- | --------------------------------- |
   | `builtInRole` | Enter the name of the basic role. |
   | `fixedRole`   | Enter the name of the fixed role. |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example removes the `fixed:permissions:admin` from the `Grafana Admin` basic role.

```yaml
# config file version
apiVersion: 1

# list of default basic role assignments that should be removed
removeDefaultAssignments:
  - builtInRole: 'Grafana Admin'
    fixedRole: 'fixed:permissions:admin'
```

You can also remove fixed roles from basic roles using the API. Refer to the [RBAC HTTP API]({{< relref "../../http_api/access_control.md#remove-a-built-in-role-assignment" >}}) for more details.

## Delete a custom role using Grafana provisioning

Delete a custom role when you no longer need it. When you delete a custom role, the custom role is removed from users and teams to which it is assigned.

> **Note:** If you use the same configuration file to both add and remove roles, the system deletes roles identified in the `deleteRoles` section before it adds roles identified in the `roles` section.

</br>

**Before you begin:**

- Identify the role or roles that you want to delete.
- Ensure that you have access to the YAML configuration file.

</br>

**To delete a custom role:**

1. Open the YAML configuration file and locate the `deleteRoles` section.

1. Refer to the following table to add attributes and values.

   | Attribute | Description                                                                                                                            |
   | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`    | The name of the custom role you want to delete. You can add a `uid` instead of a role name. The role `name` or the `uid` are required. |
   | `orgId`   | Identifies the organization to which the role belongs.                                                                                 |
   | `force`   | Sets the force parameter.                                                                                                              |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example deletes a custom role:

```yaml
# config file version
apiVersion: 1

# list of roles that should be deleted
deleteRoles:
  - name: custom:reports:editor
    orgId: 1
    force: true
```

You can also delete a custom role using the API. Refer to the [RBAC HTTP API]({{< relref "../../http_api/access_control.md#delete-a-custom-role" >}}) for more details.
