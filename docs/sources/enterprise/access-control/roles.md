+++
title = "Roles"
description = "Understand roles in fine-grained access control"
keywords = ["grafana", "fine-grained-access-control", "roles", "fixed-roles", "built-in-role-assignments", "permissions", "enterprise"]
weight = 105
+++

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

## Built-in role assignments

To control what your users can access or not, you can assign or unassign [Custom roles]({{< ref "#custom-roles" >}}) or [Fixed roles]({{< ref "#fixed-roles" >}}) to the existing [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) or to [Grafana Server Admin]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}) role. 
These assignments are called built-in role assignments.

During startup, Grafana will create default assignments for you. When you make any changes to the built-on role assignments, Grafana will take them into account and won’t overwrite during next start.

For more information, refer to [Fine-grained access control references]({{< relref "./fine-grained-access-control-references.md#default-built-in-role-assignments" >}}).

## Create and remove built-in role assignments

You can create or remove built-in role assignments using [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}}) or using [Grafana Provisioning]({{< relref "./provisioning" >}}).

### Scope of assignments

A built-in role assignment can be either _global_ or _organization local_. _Global_ assignments are not mapped to any specific organization and will be applied to all organizations, whereas _organization local_ assignments are only applied for that specific organization.
You can only create _organization local_ assignments for _organization local_ roles.