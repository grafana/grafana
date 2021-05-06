+++
title = "Roles"
description = "Understand roles in access control"
keywords = ["grafana", "access-control", "concepts", "roles", "predefined-roles", "built-in-roles", "permissions", "enterprise"]
weight = 110
+++

# Roles

A role represents a set of permissions that allows you to perform specific actions on Grafana resources. See [Permissions]({{< relref "./permissions.md" >}}) to learn more about permissions and scopes.

There are two types of roles:
1. [Predefined roles]({{< relref "./roles.md#predefined-roles" >}}), which provide granular access for specific resources within Grafana and are managed by the Grafana itself. All predefined roles start with a prefix “grafana:roles:” and can’t be changed or deleted by users.
1. [Custom roles]({{< relref "./custom-roles.md" >}}), which provide granular access based on the user specified set of permissions. A custom role with a prefix of “grafana:roles:” can’t be created as it is reserved for predefined roles.

## Global and organization roles

A role can be either **global** or **organization local**. Global roles are not mapped to any specific organization and reusable across multiple organizations, whereas organization local roles are only accessible within the assigned organization. 
Note that organization local roles can't be assigned globally or to a different organization.  

Refer to the [Access Control API]({{< relref "../../../http_api/access_control.md" >}}) to list available roles with permissions.

## Predefined roles

Predefined roles provide convenience and guarantee of consistent behaviour by combining relevant permissions together. Predefined roles are created and updated by the Grafana, during the startup.
All predefined roles are global by default and start with a `grafana:roles:` prefix. You can’t change or delete a predefined role. Refer to [Permissions]({{< relref "./permissions.md" >}}) to learn more about actions your users can perform with these roles.

Role name | Permissions | Description
--- | --- | ---
grafana:roles:permissions:admin:read | roles:read<br>roles:list<br>roles.builtin:list |
grafana:roles:permissions:admin:edit | All permissions from `grafana:roles:permissions:admin:read` and <br>roles:write<br>roles:delete<br>roles.builtin:add<br>roles.builtin:remove |
grafana:roles:reporting:admin:read | reports:read<br>reports:send<br>reports.settings:read | 
grafana:roles:reporting:admin:edit | All permissions from `grafana:roles:reporting:admin:read` and <br>reports.admin:write<br>reports:delete<br>reports.settings:write | 
grafana:roles:users:admin:read | users.authtoken:list<br>users.quotas:list<br>users:read<br>users.teams:read |
grafana:roles:users:admin:edit | All permissions from `grafana:roles:users:admin:read` and <br>users.password:update<br>users:write<br>users:create<br>users:delete<br>users:enable<br>users:disable<br>users.permissions:update<br>users:logout<br>users.authtoken:update<br>users.quotas:update |
grafana:roles:users:org:read | org.users:read |
grafana:roles:users:org:edit | All permissions from `grafana:roles:users:org:read` and <br>org.users:add<br>org.users:remove<br>org.users.role:update |
grafana:roles:ldap:admin:read | ldap.user:read<br>ldap.status:read |
grafana:roles:ldap:admin:edit | All permissions from `grafana:roles:ldap:admin:read` and <br>ldap.user:sync |

## Custom roles

You can create custom roles with permissions to control access to your users the way you want. 
See [Custom roles]({{< relref "./custom-roles.md" >}}) to understand how it works.

## Built-in role assignments

To control what your users can access or not, you can assign or unassign a role to the existing Organization roles, or to a Grafana Admin. These assignments are called built-in role assignments.

During startup, Grafana will create default assignments for you. You can update assignments using [Access Control API]({{< relref "../../../http_api/access_control.md" >}}) or using Grafana [Provisioning]({{< relref "../provisioning">}}). Grafana will take into account any changes to the assignments and won’t overwrite them.

The following built-in role assignments will be created:

Built-in role | Associated role | Description
--- | --- | ---
Grafana Admin | grafana:roles:permissions:admin:edit<br>grafana:roles:permissions:admin:read<br>grafana:roles:reporting:admin:edit<br>grafana:roles:reporting:admin:read<br>grafana:roles:users:admin:edit<br>grafana:roles:users:admin:read<br>grafana:roles:users:org:edit<br>grafana:roles:users:org:read<br>grafana:roles:ldap:admin:edit<br>grafana:roles:ldap:admin:read | Allows access to resources which [Grafana Admin]({{< relref "../../../permissions/_index.md#grafana-server-admin-role" >}}) has permissions for by default.
Admin | grafana:roles:users:org:edit<br>grafana:roles:users:org:read<br>grafana:roles:reporting:admin:edit<br>grafana:roles:reporting:admin:read | Allows access to resource which [Admin]({{< relref "../../../permissions/organization_roles.md" >}}) has permissions for by default.

