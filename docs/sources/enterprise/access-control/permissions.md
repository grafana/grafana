+++
title = "Permissions"
description = "Understand fine-grained access control permissions"
keywords = ["grafana", "fine-grained access-control", "roles", "permissions", "enterprise"]
weight = 115
+++

# Permissions

A permission is an action and a scope. When creating a fine-grained access control, consider what specific action a user should be allowed to perform, and on what resources (its scope).

To grant permissions to a user, you create a built-in role assignment to map a role to a built-in role. A built-in role assignment *modifies* to one of the existing built-in roles in Grafana (Viewer, Editor, Admin). For more information, refer to [Built-in role assignments]({{< relref "./roles.md#built-in-role-assignments" >}}).

To learn more about which permissions are used for which resources, refer to [Resources with fine-grained permissions]({{< relref "./_index.md#resources-with-fine-grained-permissions" >}}).

action
: The specific action on a resource defines what a user is allowed to perform if they have permission with the relevant action assigned to it.

scope
: The scope describes where an action can be performed, such as reading a specific user profile. In such case, a permission is associated with the scope `users:<userId>` to the relevant role.

## Action definitions

The following list contains fine-grained access control actions.

Actions | Applicable scopes | Descriptions
--- | --- | ---
roles:list | roles:* | List available roles without permissions.
roles:read | roles:* | Read a specific role with it's permissions.
roles:write | permissions:delegate | Create or update a custom role.
roles:delete | permissions:delegate | Delete a custom role.
roles.builtin:list | roles:* | List built-in role assignments.
roles.builtin:add | permissions:delegate | Create a built-in role assignment.
roles.builtin:remove | permissions:delegate | Delete a built-in role assignment.
reports.admin:create | reports:* | Create reports.
reports.admin:write | reports:* | Update reports.
reports:delete | reports:* | Delete reports.
reports:read | reports:* | List all available reports or get a specific report.
reports:send | reports:* | Send a report email.
reports.settings:write | n/a | Update report settings.
reports.settings:read | n/a | Read report settings.
provisioning:reload | service:access-control | Reload provisioning files.
users:read | global:users:* | Read or search user profiles.
users:write | global:users:* | Update a user’s profile.
users.teams:read | global:users:* | Read a user’s teams.
users.authtoken:list | global:users:* | List authentication tokens that are assigned to a user.
users.authtoken:update | global:users:* | Update authentication tokens that are assigned to a user.
users.password:update | global:users:* | Update a user’s password.
users:delete | global:users:* | Delete a user.
users:create | n/a | Create a user.
users:enable | global:users:* | Enable a user.
users:disable | global:users:* | Disable a user.
users.permissions:update | global:users:* | Update a user’s organization-level permissions.
users:logout | global:users:* | Log out a user.
users.quotas:list | global:users:* | List a user’s quotas.
users.quotas:update | global:users:* | Update a user’s quotas.
org.users.read | users:* | Get user profiles within an organization.
org.users.add | users:* | Add a user to an organization.
org.users.remove | users:* | Remove a user from an organization.
org.users.role:update | users:* | Update the organization role (`Viewer`, `Editor`, `Admin`) for an organization.
ldap.user:read | n/a | Get a user via LDAP.
ldap.user:sync | n/a | Sync a user via LDAP.
ldap.status:read | n/a | Verify the LDAP servers’ availability.
status:accesscontrol | service:access-control | Get access-control enabled status.

## Scope definitions

The following list contains fine-grained access control scopes.

Scopes | Descriptions
--- | ---
roles:* | Restrict an action to a set of roles. For example, `roles:*` matches any role, `roles:randomuid` matches only the role with UID `randomuid` and `roles:custom:reports:{editor,viewer}` matches both `custom:reports:editor` and `custom:reports:viewer` roles.
permissions:delegate | The scope is only applicable for roles associated with the Access Control itself and indicates that you can delegate your permissions only, or a subset of it, by creating a new role or making an assignment.
reports:* | Restrict an action to a set of reports. For example, `reports:*` matches any report and `reports:1` matches the report with id `1`.
service:accesscontrol | Restrict an action to target only the fine-grained access control service. For example, you can use this in conjunction with the `provisioning:reload` or the `status:accesscontrol` actions.
global:users:* | Restrict an action to a set of global users.
users:* | Restrict an action to a set of users from an organization.
