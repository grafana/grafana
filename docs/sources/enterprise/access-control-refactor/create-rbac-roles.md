---
title: 'Create, update, or delete a custom role using Grafana provisioning'
menuTitle: 'Create, update, or delete custom roles'
description: 'xxx.'
aliases: [docs/grafana/latest/manage-built-in-role-assignments]
weight: 50
keywords:
  - xxx
---

# Create, update, or delete a custom role using Grafana provisioning

You can create a custom role when the default roles and fixed roles do not meet you permissions requirements.

Update a custom role when you want to change permissions associated with the custom role. Delete a custom role when you no longer need it. You cannot create or modify `fixed:` roles.

When you delete a custom role...what happens? Need to articulate impact.

> **Note:** You cannot create, update, or delete a custom role with permissions that you do not have. For example, if the only have `users:create` permissions, then you cannot create a role that includes other permissions.

## Create or update a custom role

Create a custom role when the fixed roles that Grafana provides do not meet your needs.

### Before you begin

- [Enable Grafana to provision custom roles]({{< relref "./enable-provisioning.md" >}}).
- Ensure that you have permissions to create, update, or delete a custom role.
  - By default, the Grafana Admin role has permission to create, update, and delete custom roles.
  - A Grafana Admin can delegate the custom role privilege to another user by creating a custom role with the relevant permissions and adding the `permissions:delegate` scope.

**To create or update a custom role:**

1. Open the YAML configuration file and locate the `roles` section. Where is the YAML file?

1. Refer to the following table to add attributes and values.

   | Attribute           | Description                                                                                                                                                                                                                                                                                                                                                                                          |
   | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`              | A human-friendly identifier for the role that helps administrators understand the purpose of a role. `name` is required and cannot be longer than 190 characters. We recommend that you use ASCII characters. Role names must be unique within an organization.                                                                                                                                      |
   | `Role display name` | Human-friendly text that is displayed in the UI. Role display name cannot be longer than 190 ASCII-based characters. For fixed roles, the display name is shown as specified. If you do not set a display name the display name replaces a `:` (a colon) with ` ` (a space).                                                                                                                         |
   | `Display name`      | A human-friendly identifier that appears in the role picker UI. `Display name` helps the user to understand the purpose of the role.                                                                                                                                                                                                                                                                 |
   | `Group`             | Organizes roles in the role picker.                                                                                                                                                                                                                                                                                                                                                                  |
   | `version`           | A positive integer that defines the current version of the role. When you update a role, you can either omit the version field to increment the previous value by 1, or set a new version which must be larger than the previous version.                                                                                                                                                            |
   | `permissions`       | Provides users access to Grafana resources. For a list of permissions, refer to [Role-based access control permissions actions and scopes]({{< relref "../rbac-fixed-role-definitions.md" >}}). If you do not know which permissions to assign, you can create and assign roles without any permissions as a placeholder.                                                                            |
   | `Role UID`          | A unique identifier associated with the role. The UID enables you to change or delete the role. You can either generate a UID yourself, or let Grafana generate one for you. You cannot use the same UID within the same Grafana instance.                                                                                                                                                           |
   | `orgId`             | Identifies the organization to which the role belongs. If you do not specify `orgId`, the `orgId` is inherited from `role`. For global roles, the default `orgId` is used. `orgId` in the `role` and in the assignment must be the same for non-global roles. The [default org ID]({{< relref "../../../administration/configuration#auto_assign_org_id" >}}) is used if you do not specify `orgId`. |
   | `global`            | Makes the role available to all organizations. This setting overrides `orgId`.                                                                                                                                                                                                                                                                                                                       |
   | `hidden`            | Hides the role from the role picker.                                                                                                                                                                                                                                                                                                                                                                 |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example creates a local role with a set of user permissions:

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

The following example creates a hidden global role with a set of user permissions. The `global:true` option creates a global role, and the `hidden:true` option hides the role from the role picker.

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

# Create and assign a custom role using the HTTP API

The following examples show you how to create a custom role using the Grafana HTTP API. For more information about the HTTP API, refer to [Create a new custom role]({{< relref "../../../http_api/access_control.md#create-a-new-custom-role" >}}).

## Before you begin

- [Enable role-based access control]({{< relref "../enable-rbac.md" >}}).
- Determine which actions and scopes you want to add to the custom role. To see a list of actions and scope, refer to [Role-based access control permissions actions and scopes]({{< relref "../custom-role-actions-scopes.md" >}}).

## Create custom role example

The following example creates a `custom:users:admin` role and assigns the `users:create` action to it.

### Example request

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

### Example response

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
