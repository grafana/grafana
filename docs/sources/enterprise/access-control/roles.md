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

Role name | Permissions | Description
--- | --- | ---
fixed:permissions:admin:read | roles:read<br>roles:list<br>roles.builtin:list | Allows to list and get available roles and built-in role assignments.
fixed:permissions:admin:edit | All permissions from `fixed:permissions:admin:read` and <br>roles:write<br>roles:delete<br>roles.builtin:add<br>roles.builtin:remove | Allows every read action and in addition allows to create, change and delete custom roles and create or remove built-in role assignments.
fixed:reporting:admin:read | reports:read<br>reports:send<br>reports.settings:read | Allows to read reports and report settings.
fixed:reporting:admin:edit | All permissions from `fixed:reporting:admin:read` and <br>reports.admin:write<br>reports:delete<br>reports.settings:write | Allows every read action for reports and in addition allows to administer reports. 
fixed:users:admin:read | users.authtoken:list<br>users.quotas:list<br>users:read<br>users.teams:read | Allows to list and get users and related information.
fixed:users:admin:edit | All permissions from `fixed:users:admin:read` and <br>users.password:update<br>users:write<br>users:create<br>users:delete<br>users:enable<br>users:disable<br>users.permissions:update<br>users:logout<br>users.authtoken:update<br>users.quotas:update | Allows every read action for users and in addition allows to administer users. 
fixed:users:org:read | org.users:read | Allows to get user organizations.
fixed:users:org:edit | All permissions from `fixed:users:org:read` and <br>org.users:add<br>org.users:remove<br>org.users.role:update | Allows every read action for user organizations and in addition allows to administer user organizations.
fixed:ldap:admin:read | ldap.user:read<br>ldap.status:read | Allows to read LDAP information and status.
fixed:ldap:admin:edit | All permissions from `fixed:ldap:admin:read` and <br>ldap.user:sync | Allows every read action for LDAP and in addition allows to administer LDAP.

## Custom roles

Custom roles allow you to manage access to your users the way you want, by mapping [fine-grained permissions]({{< relref "./permissions.md" >}}) to it and creating [built-in role assignments]({{< ref "#built-in-role-assignments.md" >}}).

To create, update or delete a custom role, you can use the [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}}) or [Grafana Provisioning]({{< relref "./provisioning.md" >}}).

##### Role name

A role's name is intended as a human friendly identifier for the role, helping administrators understand the purpose of a role. The name cannot be longer than 190 characters, and we recommend using ASCII characters.
Role names must be unique within an organization.

Roles with names prefixed by `fixed:` are fixed roles created by Grafana and cannot be created or modified by users.

##### Role version

The version of a role is a positive integer which defines the current version of the role. When updating a role, you can either omit the version field to increment the previous value by 1 or set a new version which must be strictly larger than the previous version for the update to succeed.

##### Permissions

You manage access to Grafana resources by mapping [permissions]({{< relref "./permissions.md" >}}) to roles. You can create and assign roles without any permissions as placeholders.

##### Role UID

Each custom role has a UID defined which is a unique identifier associated with the role allowing you to change or delete the role. You can either generate UID yourself, or let Grafana generate one for you.

The same UID cannot be used for roles in different organizations within the same Grafana instance.

### Create, update and delete roles

You can create, update and delete custom roles by using the [Access Control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by using [Grafana Provisioning]({{< relref "./provisioning.md" >}}).

By default, Grafana Server Admin has a [built-in role assignment]({{< ref "#built-in-role-assignments" >}}) which allows a user to create, update or delete custom roles.
If a Grafana Server Admin wants to delegate that privilege to other users, they can create a custom role with relevant [permissions]({{< relref "./permissions.md" >}}) and `permissions:delegate` scope will allow those users to manage roles themselves.

Note that you won't be able to create, update or delete a custom role with permissions which you yourself do not have. For example, if the only permission you have is a `users:create`, you won't be able to create a role with other permissions.

## Built-in role assignments

To control what your users can access or not, you can assign or unassign [Custom roles]({{< ref "#custom-roles" >}}) or [Fixed roles]({{< ref "#fixed-roles" >}}) to the existing [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) or to [Grafana Server Admin]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}})  role. 
These assignments are called built-in role assignments.

During startup, Grafana will create default assignments for you. When you make any changes to the built-on role assignments, Grafana will take them into account and won’t overwrite during next start.

### Create and remove built-in role assignments

You can create or remove built-in role assignments using [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}}) or using [Grafana Provisioning]({{< relref "./provisioning">}}).

### Scope of assignments

A built-in role assignment can be either _global_ or _organization local_. _Global_ assignments are not mapped to any specific organization and will be applied to all organizations, whereas _organization local_ assignments are only applied for that specific organization.
You can only create _organization local_ assignments for _organization local_ roles.

### Default built-in role assignments

Built-in role | Associated role | Description
--- | --- | ---
Grafana Admin | fixed:permissions:admin:edit<br>fixed:permissions:admin:read<br>fixed:reporting:admin:edit<br>fixed:reporting:admin:read<br>fixed:users:admin:edit<br>fixed:users:admin:read<br>fixed:users:org:edit<br>fixed:users:org:read<br>fixed:ldap:admin:edit<br>fixed:ldap:admin:read | Allows access to resources which [Grafana Server Admin]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}) has permissions by default.
Admin | fixed:users:org:edit<br>fixed:users:org:read<br>fixed:reporting:admin:edit<br>fixed:reporting:admin:read | Allows access to resource which [Admin]({{< relref "../../permissions/organization_roles.md" >}}) has permissions by default.
