+++
title = "Permissions"
description = "Grafana user permissions"
keywords = ["grafana", "configuration", "documentation", "admin", "users", "permissions"]
type = "docs"
aliases = ["/reference/admin"]
[menu.docs]
name = "Permissions"
parent = "admin"
weight = 3
+++

# Permissions

Grafana users have permissions that are determined by their:

- **Organization Role** (Admin, Editor, Viewer)
- Via **Team** memberships where the **Team** has been assigned specific permissions.
- Via permissions assigned directly to user (on folders or dashboards)
- The Grafana Admin (i.e. Super Admin) user flag.

## Organization Roles

Users can be belong to one or more organizations. A user's organization membership is tied to a role that defines what the user is allowed to do
in that organization.

### Admin Role

Can do everything scoped to the organization. For example:

- Add & Edit data sources.
- Add & Edit organization users & teams.
- Configure App plugins & set org settings.

### Editor Role

- Can create and modify dashboards & alert rules. This can be disabled on specific folders and dashboards.
- **Cannot** create or edit data sources nor invite new users.

### Viewer Role

- View any dashboard. This can be disabled on specific folders and dashboards.
- **Cannot** create or edit dashboards nor data sources.

This role can be tweaked via Grafana server setting [viewers_can_edit]({{< relref "installation/configuration.md#viewers-can-edit" >}}). If you set this to true users
with **Viewer** can also make transient dashboard edits, meaning they can modify panels & queries but not save the changes (nor create new dashboards).
Useful for public Grafana installations where you want anonymous users to be able to edit panels & queries but not save or create new dashboards.

## Grafana Admin

This admin flag makes a user a `Super Admin`. This means they can access the `Server Admin` views where all users and organizations can be administrated.

### Dashboard & Folder Permissions

{{< docs-imagebox img="/img/docs/v50/folder_permissions.png" max-width="500px" class="docs-image--right" >}}

For dashboards and dashboard folders there is a **Permissions** page that make it possible to
remove the default role based permissions for Editors and Viewers. It's here you can add and assign permissions to specific **Users** and **Teams**.

You can assign & remove permissions for **Organization Roles**, **Users** and **Teams**.

Permission levels:

- **Admin**: Can edit & create dashboards and edit permissions.
- **Edit**: Can edit & create dashboards. **Cannot** edit folder/dashboard permissions.
- **View**: Can only view existing dashboards/folders.

#### Restricting Access

The highest permission always wins so if you for example want to hide a folder or dashboard from others you need to remove the **Organization Role** based permission from the Access Control List (ACL).

- You cannot override permissions for users with the **Org Admin Role**. Admins always have access to everything.
- A more specific permission with a lower permission level will not have any effect if a more general rule exists with higher permission level. You need to remove or lower the permission level of the more general rule.

#### How Grafana Resolves Multiple Permissions - Examples

##### Example 1 (`user1` has the Editor Role)

Permissions for a dashboard:

- `Everyone with Editor Role Can Edit`
- `user1 Can View`

Result: `user1` has Edit permission as the highest permission always wins.

##### Example 2 (`user1` has the Viewer Role and is a member of `team1`)

Permissions for a dashboard:

- `Everyone with Viewer Role Can View`
- `user1 Can Edit`
- `team1 Can Admin`

Result: `user1` has Admin permission as the highest permission always wins.

##### Example 3

Permissions for a dashboard:

- `user1 Can Admin (inherited from parent folder)`
- `user1 Can Edit`

Result: You cannot override to a lower permission. `user1` has Admin permission as the highest permission always wins.

- **View**: Can only view existing dashboards/folders.
- You cannot override permissions for users with **Org Admin Role**
- A more specific permission with lower permission level will not have any effect if a more general rule exists with higher permission level. For example if "Everyone with Editor Role Can Edit" exists in the ACL list then **John Doe** will still have Edit permission even after you have specifically added a permission for this user with the permission set to **View**. You need to remove or lower the permission level of the more general rule.

### Data source permissions

Permissions on dashboards and folders **do not** include permissions on data sources. A user with `Viewer` role
can still issue any possible query to a data source, not just those queries that exist on dashboards he/she has access to.
We hope to add permissions on data sources in a future release. Until then **do not** view dashboard permissions as a secure
way to restrict user data access. Dashboard permissions only limits what dashboards & folders a user can view & edit not which
data sources a user can access nor what queries a user can issue.

