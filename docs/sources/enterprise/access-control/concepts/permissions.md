+++
title = "Permissions"
description = "Understand permissions in access control"
keywords = ["grafana", "access-control", "concepts", "roles", "permissions", "enterprise"]
+++

# Permissions 

In access control, permissions define what you can perform on a specific Grafana resource. 
To grant permissions to your users, you can create [built-in role assignments]({{< relref "./roles.md#built-in-role-assignments" >}}).
Refer to [Managing roles and permissions]({{< relref "../managing-roles-permissions.md" >}}) for more information.

A permission is defined by an `action` and a `scope`. 
When evaluating a decision for access, user will be allowed to perform a specific action on a resource if they have a permission with relevant `action` and `scope`.

## Action

`action` describes what user is allowed to access to. For example, you can grant a user access to read user profiles, by associating a permission with action `users:read` to the relevant role.

## Scope

`scope` describes where ant action can be performed. For example, you can grant a user access to read a specific user profile, by associating a permission with scope `users:<userId>` to the relevant role.
You can also combine multiple scopes if necessary, by using `/` as a delimiter. 

## Available permissions 

Action | Applicable scopes | Description
--- | --- | ---
roles:list | roles:* | Allows to list available roles without permissions. 
roles:read | roles:* | Allows to read a specific role with it's permissions.
roles:write | permissions:delegate | Allows to create or update a custom role.
roles:delete | permissions:delegate | Allows to delete a custom role.
roles.builtin:list | roles:* | Allows to list built-in role assignments.
roles.builtin:add | permissions:delegate | Allows to create a built-in role assignment.
roles.builtin:remove | permissions:delegate |Allows to delete a built-in role assignment.
reports.admin:write | reports:* | todo
reports:delete | reports:* | todo
reports:read | reports:* | todo
reports:send | reports:* | todo
reports.settings:write | n/a | todo
reports.settings:read | n/a | todo
provisioning:reload | service:access-control | todo 
users:read | global:users:* | todo
users:write | global:users:* | todo
users.teams:read | global:users:* | todo
users.authtoken:list | global:users:* | todo
users.authtoken:update | global:users:* | todo
users.password:update | global:users:* | todo
users:delete | global:users:* | todo
users:create | n/a | todo
users:enable | global:users:* | todo
users:disable | global:users:* | todo
users.permissions:update | global:users:* | todo
users:logout | global:users:* | todo
users.quotas:list | global:users:* | todo
users.quotas:update | global:users:* | todo
org.users.read | users:* | todo
org.users.add | users:* | todo
org.users.remove | users:* | todo
org.users.role:update | users:* | todo
ldap.user:read | n/a | todo
ldap.user:sync | n/a | todo
ldap.status:read | n/a | todo

### Scope definitions
Scope | Description
--- | --- 
roles:* | todo
permissions:delegate | todo
reports:* | todo
service:access-control | todo
global:users:* | todo
users:* | todo
