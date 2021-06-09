+++
title = "Fine-grained access control references"
description = "Refer to fine-grained access control references"
keywords = ["grafana", "fine-grained-access-control", "roles", "fixed-roles", "built-in-role-assignments", "permissions", "enterprise"]
weight = 130
+++

# Fine-grained access control references
The reference information that follows complements conceptual information about [Roles]({{< relref "./roles.md" >}}).

## Fine-grained access fixed roles

Fixed roles | Permissions | Descriptions
--- | --- | ---
`fixed:permissions:admin:read` | `roles:read`<br>`roles:list`<br>`roles.builtin:list` | Allows to list and get available roles and built-in role assignments.
`fixed:permissions:admin:edit` | All permissions from `fixed:permissions:admin:read` and <br>`roles:write`<br>`roles:delete`<br>`roles.builtin:add`<br>`roles.builtin:remove` | Allows every read action and in addition allows to create, change and delete custom roles and create or remove built-in role assignments.
`fixed:reporting:admin:read` | `reports:read`<br>`reports:send`<br>`reports.settings:read` | Allows to read reports and report settings.
`fixed:reporting:admin:edit` | All permissions from `fixed:reporting:admin:read` and <br>`reports.admin:write`<br>`reports:delete`<br>`reports.settings:write` | Allows every read action for reports and in addition allows to administer reports. 
`fixed:users:admin:read` | `users.authtoken:list`<br>`users.quotas:list`<br>`users:read`<br>`users.teams:read` | Allows to list and get users and related information.
`fixed:users:admin:edit` | All permissions from `fixed:users:admin:read` and <br>`users.password:update`<br>`users:write`<br>`users:create`<br>`users:delete`<br>`users:enable`<br>`users:disable`<br>`users.permissions:update`<br>`users:logout`<br>`users.authtoken:update`<br>`users.quotas:update` | Allows every read action for users and in addition allows to administer users. 
`fixed:users:org:read` | `org.users:read` | Allows to get user organizations.
`fixed:users:org:edit` | All permissions from `fixed:users:org:read` and <br>`org.users:add`<br>`org.users:remove`<br>`org.users.role:update` | Allows every read action for user organizations and in addition allows to administer user organizations.
`fixed:ldap:admin:read` | `ldap.user:read`<br>`ldap.status:read` | Allows to read LDAP information and status.
`fixed:ldap:admin:edit` | All permissions from `fixed:ldap:admin:read` and <br>`ldap.user:sync` | Allows every read action for LDAP and in addition allows to administer LDAP.
`fixed:settings:admin:edit` | `settings:write` | Update all settings

## Default built-in role assignments

Built-in roles | Associated roles | Descriptions
--- | --- | ---
Grafana Admin | `fixed:permissions:admin:edit`<br>`fixed:permissions:admin:read`<br>`fixed:reporting:admin:edit`<br>`fixed:reporting:admin:read`<br>`fixed:users:admin:edit`<br>`fixed:users:admin:read`<br>`fixed:users:org:edit`<br>`fixed:users:org:read`<br>`fixed:ldap:admin:edit`<br>`fixed:ldap:admin:read`<br>`fixed:settings:admin:edit` | Allows access to resources which [Grafana Server Admin]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}) has permissions by default.
Admin | `fixed:users:org:edit`<br>`fixed:users:org:read`<br>`fixed:reporting:admin:edit`<br>`fixed:reporting:admin:read` | Allows access to resource which [Admin]({{< relref "../../permissions/organization_roles.md" >}}) has permissions by default.
