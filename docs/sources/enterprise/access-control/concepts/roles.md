+++
title = "Roles"
description = "Understand roles in access control"
keywords = ["grafana", "access-control", "concepts", "roles", "predefined-roles", "built-in-roles"" "permissions" "enterprise"]
+++

When you start Grafana, it creates predefined roles and associates them with built-in roles. 

## Predefined roles

Predefined roles combine together permissions required to access specific Grafana resources which enable consistent access and experience when interacting with Grafana.
All predefined roles start with a “grafana:roles:” prefix and can’t be changed or deleted by users. Refer to [Permissions]({{< relref "./permissions.md" >}}) to learn more about actions your users can perform with these roles.

Predefined role | Associated role | Description
--- | --- | ---
grafana:roles:users:admin:read | users.authtoken:list<br>users.quotas:list<br>users:read<users.teams:read> |
grafana:roles:users:admin:edit | All permissions from grafana:roles:users:admin:read with additional permissions for editing:<br>users.password:update<br>users:write<br>users:create<br>users:delete<br>users:enable<br>users:disable<br>users.permissions:update<br>users:logout<br>users.authtoken:update<br>users.quotas:update|
grafana:roles:orgs:admin:read | org.users:read |
grafana:roles:orgs:admin:edit | All permissions from grafana:roles:orgs:admin:read with additional permissions for editing:<br>org.users:add<br>org.users:remove<br>org.users.role:update |
grafana:roles:orgs:current:read | org.users:read |
grafana:roles:orgs:current:edit | All permissions from grafana:roles:orgs:current:read with additional permissions for editing:<br>org.users:add<br>org.users:remove<br>org.users.role:update |
grafana:roles:ldap:admin:read | ldap.user:read<br>ldap.status:read |
grafana:roles:ldap:admin:edit | All permissions from grafana:roles:ldap:admin:read with additional permissions for editing:<br>ldap.user:sync |

## Built-in roles

When Grafana starts, built-in roles are created and access is granted by mapping predefined roles to built-in roles. When you make any changes to the grants or predefined roles, Grafana will take that into account and won’t overwrite your changes.
You can grant, change or revoke default permissions for built-in roles by using an API endpoints or Grafana provisioning.

By default, the following built-in roles are available:

Built-in role | Associated role | Description
--- | --- | ---
Grafana Admin | grafana:roles:users:admin:read<br>grafana:roles:users:admin:edit<br>grafana:roles:orgs:admin:read<br>grafana:roles:orgs:admin:edit<br>grafana:roles:ldap:admin:read<br>grafana:roles:ldap:admin:edit | Allows access to resources which [Grafana Server Admin]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}) has permissions for by default.
Admin | grafana:roles:orgs:current:read<br>grafana:roles:orgs:current:edit | Allows access to resource which [Admin]({{< relref "../../permissions/organization_roles.md" >}}) has permissions for by default.

## Custom roles

You can create custom roles and map permissions to those roles to manage granular access for users the way you want. 
See [Custom roles]({{< relref "./custom-roles.md" >}}) to understand how it works.


