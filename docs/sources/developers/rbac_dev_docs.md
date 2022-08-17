RBAC docs

# Glossary

**action** - describes what user is allowed to do; examples: `dashboards:read`, `teams:create`, `datasources:write`.

**scope** - describes which resources user is allowed to apply the action to; examples `dashboards:uid:test_dashboard`, `teams:id:1`, `datasources:*`

**permission** - action + scope;

**role** - a set of permissions; examples: `fixed:dashboards:reader`, `basic:viewer`, `custom:test_role`;

**fixed role** - role that is automatically created by Grafana server and contains the default set of permissions necessary for a common task; examples: `fixed:dashboards:reader`, `fixed:teams:reader` [TODO link to all roles]

**basic role** - role that corresponds to one of legacy Grafana roles (Viewer, Editor, Admin and Grafana Admin); examples: `basic:viewer`, `basic:grafana_admin`

**builtin role (deprecated)** - RBAC alternative to legacy Grafana roles, has now been deprecated and replaced by basic roles;

**custom role** - role that has been created by a user; examples: `custom:team_and_dashboard_admin`;

**managed permission** - permissions that are created by resource permission service;

**resource permission service (aka managed permission service)** - service that allows assigning a set of permissions on a particular resource; examples: dashboard, team and data source resource permission services;

**scope resolution** -

**RBAC filtering** - filtering a set of resources based on user's permissions, and only giving the user information about resources that he has access to;

**RBAC metadata** - a list of permissions that a user has on a resource that can be returned by the API when listing the resource, it is used by frontend;

**RBAC middleware** - authorisation middleware that checks whether the user has the required permissions before calling a function handler;

**Access control provisioning** -

# Style guide

## Scope naming

## Action naming

## Role naming

# Architecture overview

## Building blocks

### Permissions

Most permissions are defined by an action and a scope. **Action** defines what the user is allowed to do (ie, read dashboards, create data sources or delete teams). Most actions correspond to creating, reading, writing or deleting a specific resource, but some of them are funkier, and allow enabling or disabling things, querying etc.
**Scope** specifies a resource or set of resources that the permission applies to. Most of the scopes look like `resource:id` or `resource:uid`. For example, `dashboards:uid:my_dash` or `teams:id:1`. We also support wildcard scopes - `dashboards:uid:*` and `dashboards:*` both apply to all dashboards.
Some permissions don't have a scope. For instance, `users:create` does not require a scope.

[TODO screenshot of the DB table?]

### Roles

Role is a set of permissions.

Confusingly, Grafana's legacy access control also has roles - Viewer, Editor, Admin and Server Admin. They are still used in some parts of code and documentation. They are implemented in a different way than RBAC roles, and should not be confused for RBAC roles.

We have several different types of roles:

- **fixed roles** - hardcoded roles that contain permissions required for common tasks, and that we thought users would find handy. Users are not able to change or delete fixed roles. You can see a full list of them in our public documentation [TODO].
- **custom roles** - roles created by users. Users have a full control over these roles. Custom roles can be created through API or provisioning.
- **basic roles** - RBAC roles corresponding to Grafana's legacy access control roles. They provide a default set of permissions granted to viewers, editors, admins and server admins, and are required for an easy transition from legacy access control to RBAC. Note that basic roles **can** be edited by users (but cannot be deleted). Currently each user needs to have exactly one basic role assigned to them. [TODO check if it's true]

where to check for permissions

# Roadmap
