---
description: Understand roles in fine-grained access control
keywords:
  - grafana
  - fine-grained-access-control
  - roles
  - fixed-roles
  - built-in-role-assignments
  - permissions
  - enterprise
title: Roles
weight: 105
---

# Roles

A role represents set of permissions that allow you to perform specific actions on Grafana resources. Refer to [Permissions]({{< relref "./permissions.md" >}}) to understand how permissions work.

There are two types of roles:

- [Fixed roles]({{< relref "./roles.md#fixed-roles" >}}), which provide granular access for specific resources within Grafana and are managed by the Grafana itself.
- [Custom roles]({{< relref "./roles.md#custom-roles.md" >}}), which provide granular access based on the user specified set of permissions.

You can use [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}}) to list available roles and permissions.

## Role scopes

A role can be either _global_ or _organization local_. _Global_ roles are not mapped to any specific organization and can be reused across multiple organizations, whereas _organization local_ roles are only available for that specific organization.

## Fixed roles

Fixed roles provide convenience and guarantee of consistent behaviour by combining relevant [permissions]({{< relref "./permissions.md" >}}) together. Fixed roles are created and updated by Grafana during startup.
There are few basic rules for fixed roles:

- All fixed roles are _global_.
- All fixed roles have a `fixed:` prefix.
- You can’t change or delete a fixed role.

For more information, refer to [Fine-grained access control references]({{< relref "./fine-grained-access-control-references.md#fine-grained-access-fixed-roles" >}}).

## Custom roles

Custom roles allow you to manage access to your users the way you want, by mapping [fine-grained permissions]({{< relref "./permissions.md" >}}) to it and creating [built-in role assignments]({{< ref "#built-in-role-assignments.md" >}}).

To create, update or delete a custom role, you can use the [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}}) or [Grafana Provisioning]({{< relref "./provisioning.md" >}}).

### Role name

A role's name is intended as a human friendly identifier for the role, helping administrators understand the purpose of a role. The name cannot be longer than 190 characters, and we recommend using ASCII characters.
Role names must be unique within an organization.

Roles with names prefixed by `fixed:` are fixed roles created by Grafana and cannot be created or modified by users.

### Role display name

A role’s display name is human friendly text that is displayed in the UI. When you create a display name for a role, use up to 190 ASCII-based characters. For fixed roles, the display name is shown as specified. If the display name has not been set the display name replace any `:` (a colon) with ` ` (a space).

### Display name

A role’s display name is a human-friendly identifier for the role, so that users more easily understand the purpose of a role. You can see the display name in the role picker in the UI.

### Group

A role’s group organizes roles in the role picker in the UI.

### Role version

The version of a role is a positive integer which defines the current version of the role. When updating a role, you can either omit the version field to increment the previous value by 1 or set a new version which must be strictly larger than the previous version for the update to succeed.

### Permissions

You manage access to Grafana resources by mapping [permissions]({{< relref "./permissions.md" >}}) to roles. You can create and assign roles without any permissions as placeholders.

### Role UID

Each custom role has a UID defined which is a unique identifier associated with the role allowing you to change or delete the role. You can either generate UID yourself, or let Grafana generate one for you.

The same UID cannot be used for roles in different organizations within the same Grafana instance.

## Create, update and delete roles

You can create, update and delete custom roles by using the [Access Control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by using [Grafana Provisioning]({{< relref "./provisioning.md" >}}).

By default, Grafana Server Admin has a [built-in role assignment]({{< ref "#built-in-role-assignments" >}}) which allows a user to create, update or delete custom roles.
If a Grafana Server Admin wants to delegate that privilege to other users, they can create a custom role with relevant [permissions]({{< relref "./permissions.md" >}}) and `permissions:delegate` scope will allow those users to manage roles themselves.

Note that you won't be able to create, update or delete a custom role with permissions which you yourself do not have. For example, if the only permission you have is a `users:create`, you won't be able to create a role with other permissions.

## Assign roles

[Custom roles]({{< ref "#custom-roles" >}}) and [Fixed roles]({{< ref "#fixed-roles" >}}) can be assigned to users, the existing [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) and to [Grafana Server Admin]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}) role.

Visit [Manage role assignments]({{< relref "manage-role-assignments/_index.md" >}}) page for more details.

### Scope of assignments

A role assignment can be either _global_ or _organization local_. _Global_ assignments are not mapped to any specific organization and will be applied to all organizations, whereas _organization local_ assignments are only applied for that specific organization.
You can only create _organization local_ assignments for _organization local_ roles.
