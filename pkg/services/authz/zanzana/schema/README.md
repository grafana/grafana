# Authorization schema

Here's some notes about [OpenFGA authorization model](https://openfga.dev/docs/modeling/getting-started) (schema) using to model access control in Grafana.

## GroupResource level permissions

A relation to a group_resource object grants access to all objects of the GroupResource.
They take the form of `{ “user”: “user:1”, relation: “read”, object:”group_resource:dashboard.grafana.app/dashboard” }`. This
example would grant `user:1` access to all `dashboard.grafana.app/dashboard` in the namespace.

## Folder level permissions

Folders have a type in our schema, this is different from most of our other resources where we use the generic type for
them. This is because we want to store the folder tree relations.

To grant a user access to a specific folder we store `{ “user”: “user:1”, relation: “read”, object:”folder:<name>” }`

To grant a user access to sub resources of a folder we store ``{ “user”: “user:1”, relation: “resource_read”, object:”folder:<uid>”}` with additional context.
This context holds all GroupResources in a list e.g. `{ "group_resources": ["dashboard.grafana.app/dashboards", "alerting.grafana.app/rules" ] }`.

## Resource level permissions

Most of our resource should use the generic resource type. 

To grant a user direct access to a specific resource we store `{ “user”: “user:1”, relation: “read”, object:”resource:dashboard.grafana.app/dashboard/<name>” }` with additional context.
This context store the GroupResource. `{ "group_resource": "dashboard.grafana.app/dashboards" }`. This is required so we can filter them out for list requests.

## Managed permissions

In the RBAC model managed permissions stored as a special "managed" role permissions. OpenFGA model allows to assign permissions directly to users, so it produces following tuples:

```text
user:<user_uid> read folder:<folder_uid>
```

It's also possible to assign permissions for team members using `#member` relation:

```text
team:<team_uid>#member read folder:<folder_uid>
```

## Roles and role assignments

RBAC authorization model grants permissions to users through roles and role assignments. All permissions are linked to roles and then roles granted to users. To model this in OpenFGA we use `role` type.

To understand how RBAC permissions linked to roles, let's take a look at the folder read permission as example:

```text
type role
  relations
    define assignee: [user, team#member, role#assignee]

type folder
  relations
    define parent: [folder]

    define read: [user, team#member, role#assignee] or view or read from parent
```

According to the schema, user can get `read` access to folder if it has `read` relation granted directly to the folder or its parent folders.

