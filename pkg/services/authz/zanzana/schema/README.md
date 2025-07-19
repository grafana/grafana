# Authorization schema

Here's some notes about [OpenFGA authorization model](https://openfga.dev/docs/modeling/getting-started) (schema) using to model access control in Grafana.

## GroupResource level permissions

A relation to a group_resource object grants access to all objects of the GroupResource.
They take the form of `{ “user”: “user:1”, relation: “read”, object:”group_resource:dashboard.grafana.app/dashboards” }`. This
example would grant `user:1` access to all `dashboard.grafana.app/dashboards` in the namespace.

## Folder level permissions

Folders have a type in our schema, this is different from most of our other resources where we use the generic type for
them. This is because we want to store the folder tree relations.

To grant a user access to a specific folder we store `{ “user”: “user:1”, relation: “read”, object:”folder:<name>” }`

To grant a user access to sub resources of a folder we store `{ “user”: “user:1”, relation: “resource_read”, object:”folder:<uid>”}` with additional context.
This context holds all GroupResources in a list e.g. `{ "subresources": ["dashboard.grafana.app/dashboards", "alerting.grafana.app/rules" ] }`.

## Resource level permissions

Most of our resource should use the generic resource type.

To grant a user direct access to a specific resource we store `{ “user”: “user:1”, relation: “read”, object:”resource:dashboard.grafana.app/dashboards/<name>” }` with additional context.
This context store the GroupResource. `{ "group_resource": "dashboard.grafana.app/dashboards" }`. This is required so we can filter them out for list requests.

## Subresources

Subresources enable more granular permissions for the resources. Example might be access to public dashboards or access to dashboard settings.

To grant a user access to the subresource of the specific resource we store following tuple: `{ “user”: “user:1”, relation: “read”, object:”resource:dashboard.grafana.app/dashboards/<subresource>/<resource_name>” }` with additional context `{ "group_resource": "dashboard.grafana.app/dashboards/<subresource>" }`

It's also possible to grant user access to all subresources for specific resource type. It can be done with following tuple: `{ “user”: “user:1”, relation: “read”, object:”resource:dashboard.grafana.app/dashboards/<subresource>” }`.

For the typed resources (like folders, users, teams, etc) subresources work in a little bit different way. Since typed resources only have ID in the name, subresources are added to the `subresource_filter`. For example, to grant user access to folder subresource, following tuple will be created:

```
{ “user”: “user:1”, relation: “resource_read”, object:”folder:<uid>” }
context: { "subresource_filter": ["folder.grafana.app/folders/<subresource>"] }
```

Note that relation is translated from `read` to `resource_read`. This is required to distinguish access between resource and its subresources. When check request is performed, we check if request contains subresource. If so, context filter and translated relation are used.

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
