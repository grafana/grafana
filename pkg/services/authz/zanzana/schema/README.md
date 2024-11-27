# Authorization schema

Here's some notes about [OpenFGA authorization model](https://openfga.dev/docs/modeling/getting-started) (schema) using to model access control in Grafana.

## Org-level permissions

Most of the permissions are exist in org. Users, teams, dashboards, folders and other objects also related to specific org.

## Dashboards and folders

Folder hierarchy is stored directly in OpenFGA database. Each dashboard has parent folder and every folder could have sub-folders. Root-level folders do not have parents, but instead, they related to specific org:

```text
type org
  relations
    define instance: [instance]
    define member: [user]

type folder
    relations
      define parent: [folder]
      define org: [org]

type dashboard
  relations
    define org: [org]
    define parent: [folder]
```

Therefore, folders tree is stored as tuples like this:

```text
folder:<org_id>-<folder_uid> parent dashboard:<org_id>-<dashboard_uid>
folder:<org_id>-<folder_uid> parent folder:<org_id>-<folder_uid>
org:<org_id> org folder:<org_id>-<folder_uid>
```

## Managed permissions

In the RBAC model managed permissions stored as a special "managed" role permissions. OpenFGA model allows to assign permissions directly to users, so it produces following tuples:

```text
user:<user_uid> read folder:<org_id>-<folder_uid>
```

It's also possible to assign permissions for team members using `#member` relation:

```text
team:<team_uid>#member read folder:<org_id>-<folder_uid>
```

It's important to understand that folder permissions cannot be directly assigned to teams, because it's restricted by schema:

```text
type folder
    relations
      define parent: [folder]
      define org: [org]

      define read: [user, team#member, role#assignee] or read from parent or folder_read from org

type team
  relations
    define org: [org]
    define admin: [user]
    define member: [user] or admin
```

Therefore, `team#member` can have `read` relation to folder and user will be automatically granted the same permission if it has `member` relation to specific team.

## Roles and role assignments

RBAC authorization model grants permissions to users through roles and role assignments. All permissions are linked to roles and then roles granted to users. To model this in OpenFGA, we use org-level permission and `role` type.

To understand how RBAC permissions linked to roles, let's take a look at the dashboard read permission as example:

```text
type org
  relations
    define instance: [instance]
    define member: [user]

    define folder_read: [role#assignee]

type role
  relations
    define org: [org]
    define assignee: [user, team#member, role#assignee]

type folder
  relations
    define parent: [folder]
    define org: [org]

    define read: [user, team#member, role#assignee] or read from parent or folder_read from org
```

According to the schema, user can get `read` access to dashboard if it has `read` relation granted directly to the dashboard ot its parent folders, or by having `folder_read from org`. If we take a look at `folder_read` definition in the org type, we could see that this relation could be granted to `role#assignee`. So in order to allow user to read all dahboards in org, following tuples should be added:

```text
role:<org_id>-<role_uid>#assignee folder_read org:<org_uid>
user:<user_uid> assignee role:<role_uid>
```

In case of `Admin` basic role, it will be looking like:

```text
role:1-basic_admin#assignee folder_read org:1
user:admin assignee role:1-basic_admin
```
