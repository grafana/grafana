+++
title = "Roles"
description = "Understand roles in fine-grained access control"
keywords = ["grafana", "fine-grained-access-control", "roles", "predefined-roles", "built-in-role-assignments", "permissions", "enterprise"]
weight = 110
+++

# Roles

A role represents set of permissions that allows you to perform specific actions on Grafana resources. Refer to [Permissions]({{< relref "./permissions.md" >}}) to learn more about permissions and scopes.

There are two types of roles:
1. [Predefined roles]({{< relref "./roles.md#predefined-roles" >}}), which provide granular access for specific resources within Grafana and are managed by the Grafana itself. All predefined roles start with a prefix `grafana:roles:` and can’t be changed or deleted by users.
1. [Custom roles]({{< relref "./custom-roles.md" >}}), which provide granular access based on the user specified set of permissions. A custom role with a prefix of `grafana:roles:` can’t be created as it is reserved for predefined roles.

Refer to the [Access Control API]({{< relref "../../../http_api/access_control.md" >}}) to list available roles with permissions.

## Global and organization roles

A role can be either **`global`** or **`organization local`**. Global roles are not mapped to any specific organization and can be reused across multiple organizations, whereas organization local roles are only available for that specific organization.

## Predefined roles

Predefined roles provide convenience and guarantee of consistent behaviour by combining relevant [permissions]({{< relref "./permissions.md" >}}) together. Predefined roles are created and updated by the Grafana, during the startup.
There are two basic rules for predefined roles:

1. All predefined roles are `global` by default
1. All predefined roles have a `grafana:roles:` prefix. 
1. You can’t change or delete a predefined role.

Role name | Permissions | Description
--- | --- | ---
grafana:roles:permissions:admin:read | roles:read<br>roles:list<br>roles.builtin:list | Allows to list and get available roles and built-in role assignments.
grafana:roles:permissions:admin:edit | All permissions from `grafana:roles:permissions:admin:read` and <br>roles:write<br>roles:delete<br>roles.builtin:add<br>roles.builtin:remove | Allows every read action and in addition allows to create, change and delete custom roles and create or remove built-in role assignments.
grafana:roles:reporting:admin:read | reports:read<br>reports:send<br>reports.settings:read | Allows to read reports and report settings.
grafana:roles:reporting:admin:edit | All permissions from `grafana:roles:reporting:admin:read` and <br>reports.admin:write<br>reports:delete<br>reports.settings:write | Allows every read action for reports and in addition allows to administer reports. 
grafana:roles:users:admin:read | users.authtoken:list<br>users.quotas:list<br>users:read<br>users.teams:read | Allows to list and get users and related information.
grafana:roles:users:admin:edit | All permissions from `grafana:roles:users:admin:read` and <br>users.password:update<br>users:write<br>users:create<br>users:delete<br>users:enable<br>users:disable<br>users.permissions:update<br>users:logout<br>users.authtoken:update<br>users.quotas:update | Allows every read action for users and in addition allows to administer users. 
grafana:roles:users:org:read | org.users:read | Allows to get user organizations.
grafana:roles:users:org:edit | All permissions from `grafana:roles:users:org:read` and <br>org.users:add<br>org.users:remove<br>org.users.role:update | Allows every read action for user organizations and in addition allows to administer user organizations.
grafana:roles:ldap:admin:read | ldap.user:read<br>ldap.status:read | Allows to read LDAP information and status.
grafana:roles:ldap:admin:edit | All permissions from `grafana:roles:ldap:admin:read` and <br>ldap.user:sync | Allows every read action for LDAP and in addition allows to administer LDAP.

## Custom roles

You can create custom roles and map [permissions]({{< relref "./permissions.md" >}}) to control access to your users the way you want. 
See [Custom roles]({{< relref "./custom-roles.md" >}}) to understand how it works.

## Built-in role assignments

To control what your users can access or not, you can assign or unassign [Custom roles]({{< relref "./custom-roles.md" >}}) or [Predefined roles]({{< relref "./roles.md#predefined-roles" >}}) to the existing [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) or to [Grafana Admin role]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}). 
These assignments are called built-in role assignments.

During startup, Grafana will create default assignments for you. You can update assignments using [Access Control API]({{< relref "../../../http_api/access_control.md" >}}) or using Grafana [Provisioning]({{< relref "../provisioning">}}). 
When you make any changes to the built-on role assignments, Grafana will take them into account and won’t overwrite during next start.

The following built-in role assignments are available by default:

Built-in role | Associated role | Description
--- | --- | ---
Grafana Admin | grafana:roles:permissions:admin:edit<br>grafana:roles:permissions:admin:read<br>grafana:roles:reporting:admin:edit<br>grafana:roles:reporting:admin:read<br>grafana:roles:users:admin:edit<br>grafana:roles:users:admin:read<br>grafana:roles:users:org:edit<br>grafana:roles:users:org:read<br>grafana:roles:ldap:admin:edit<br>grafana:roles:ldap:admin:read | Allows access to resources which [Grafana Admin]({{< relref "../../../permissions/_index.md#grafana-server-admin-role" >}}) has permissions for by default.
Admin | grafana:roles:users:org:edit<br>grafana:roles:users:org:read<br>grafana:roles:reporting:admin:edit<br>grafana:roles:reporting:admin:read | Allows access to resource which [Admin]({{< relref "../../../permissions/organization_roles.md" >}}) has permissions for by default.
