+++
title = "Permissions"
description = "Understand permissions in access control"
keywords = ["grafana", "access-control", "concepts", "roles", "permissions" "enterprise"]
+++

## Permissions 
In access control, permissions define what you can perform on a specific Grafana resource. To grant permissions to your users, you can either map predefined roles to built-in roles, or create custom roles and map them to built-in roles. Refer to [Custom roles]({{< relref "./custom-roles.md" >}}) for more information.
A permission is defined by an `action` and a `scope`. 

### Action
`action` describes what user is allowed to access to. For example, you can grant a user access to read user profiles, by associating a permission with action `users:read` to the relevant role.

### Scope
`scope` describes where ant action can be performed. For example, you can grant a user access to read a specific user profile, by associating a permission with scope `users:<userId>` to the relevant role.

### All permissions 

Permission | Applicable scope | Description
--- | --- | ---
users.authtoken:list | users:* | todo
users.quotas:list | users:* | todo
users:read | users:* | todo
users.teams:read | users:* | todo
users.password:update | users:* | todo
users:create | n/a | todo
users:delete | users:* | todo
users:enable | users:* | todo
users:disable | users:* | todo
users.permissions:update | users:* | todo
users:logout | users:* | todo
users.authtoken:update | users:* | todo
users.quotas:update | users:* | todo
users:write | users:* | todo
org.users:read | global:users:*<br>users:* | todo
org.users:add | global:users:*<br>users:* | todo
org.users:remove | global:users:*<br>users:* | todo
org.users.role:update | global:users:*<br>users:* | todo
ldap.user:read |  | todo
ldap.user:sync |  | todo
ldap.status:read |  | todo

