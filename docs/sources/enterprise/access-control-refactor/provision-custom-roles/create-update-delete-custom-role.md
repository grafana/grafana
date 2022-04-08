---
title: 'Create, update, or delete a custom role using Grafana provisioning'
menuTitle: 'Create, update, or delete custom roles'
description: 'xxx.'
aliases: [xxx]
weight: 30
keywords:
  - xxx
---

# Create, update, or delete a custom role using Grafana provisioning

You can create a custom role when the default roles and fixed roles do not meet you permissions requirements.

Update a custom role when you want to change permissions associated with the custom role. Delete a custom role when you no longer need it.

When you delete a custom role...what happens? What

Need more info here on when to create a custom role and when to update a custom role.


By default, Grafana Server Admin has a [built-in role assignment]({{< ref "#built-in-role-assignments" >}}) which allows a user to create, update, or delete custom roles.
If a Grafana Server Admin wants to delegate that privilege to other users, they can create a custom role with relevant [permissions]({{< relref "./permissions.md" >}}) and `permissions:delegate` scope will allow those users to manage roles themselves.

Note that you won't be able to create, update or delete a custom role with permissions which you yourself do not have. For example, if the only permission you have is a `users:create`, you won't be able to create a role with other permissions.

## Create or update a custom role

Create a custom role when the fixed roles that Grafana provides do not meet your need.

### Before you begin

- [Enable Grafana to provision custom roles]({{< relref "./enable-provisioning.md" >}})
- Ensure that you have permissions to create, update, or delete a custom role.
  - By default, the Grafana Admin role has permission to create and update custom roles

**To create or update a custom role:**

1. Open the YAML configuration file and locate the `roles` section.

1. Refer to the following table to add attributes and values.

   | Attribute           | Description                                                                                                                                                                                                                                                                                                                                                                                                                        |
   | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`              | A human-friendly identifier for the role that helps administrators understand the purpose of a role. `name` is required and cannot be longer than 190 characters. We recommend that you use ASCII characters. Role names must be unique within an organization. You cannot create or modify `fixed:` roles.                                                                                                                        |
   | `Role display name` | Human-friendly text that is displayed in the UI. Role display name cannot be longer than 190 ASCII-based characters. For fixed roles, the display name is shown as specified. If you do not set a display name the display name replaces a `:` (a colon) with ` ` (a space).                                                                                                                                                       |
   | `Display name`      | A human-friendly identifier that appears in the role picker UI. `Display name` helps user to understand the purpose of the role.                                                                                                                                                                                                                                                                                                   |
   | `Group`             | Organizes roles in the role picker in the UI.                                                                                                                                                                                                                                                                                                                                                                                      |
   | `version`           | A positive integer that defines the current version of the role. When you update a role, you can either omit the version field to increment the previous value by 1, or set a new version which must be larger than the previous version for the update to succeed.                                                                                                                                                                |
   | `permissions`       | Provides users access to Grafana resources. For a list of permissions refer to [Action definitions]({{< relref "XXXXXXXXX" >}}) to roles. You can create and assign roles without any permissions as placeholders.                                                                                                                                                                                                                 |
   | `Role UID`          | Each custom role has a UID defined which is a unique identifier associated with the role, which enables you to change or delete the role. You can either generate a UID yourself, or let Grafana generate a UID for you. The same UID cannot be used for roles in different organizations within the same Grafana instance.                                                                                                        |
   | `orgId`             | Identifies the organization to which the role belongs. If you do not specify `orgId`, the `orgId` is inherited from `role`. For global roles, the default `orgId` is used. `orgId` in the `role` and in the assignment must be the same for non-global roles. The [default org ID]({{< relref "../../administration/configuration#auto_assign_org_id" >}}) is used if `orgId` is not specified in any of the configuration blocks. |
   | `global`            | Makes the role available to all organizations. This setting overrides `orgId`.                                                                                                                                                                                                                                                                                                                                                     |
   | `hidden`            | Hides the role from the role picker.                                                                                                                                                                                                                                                                                                                                                                                               |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).

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

## Delete a custom role using Grafana provisioning

Delete a custom role when you no longer need it. When you delete a custom role [impact statement here of what happends when a custom role is deleted.]

> **Note:** Any role in the `deleteRoles` section is deleted before any role in the `roles` section is saved.

### Before you begin

- Identify the role or roles that you want to delete.
- Ensure that you have access to the YAML configuration file.

**To delete a role a custom role:**

1. Open the YAML configuration file and locate the `deleteRoles` section.

1. Refer to the following table to add attributes and values.

   | Attribute | Description                                                                                                                            |
   | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`    | The name of the custom role you want to delete. You can add a `uid` instead of a role name. The role `name` or the `uid` are required. |
   | `orgId`   | Identifies the organization to which the role belongs.                                                                                 |
   | `force`   | xxxxx.                                                                                                                                 |

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
