+++
title = "Dashboard & Folder Permissions"
description = "Grafana Dashboard & Folder Permissions Guide "
keywords = ["grafana", "configuration", "documentation", "dashboard", "folder", "permissions", "teams"]
type = "docs"
[menu.docs]
name = "Dashboard & Folder"
identifier = "dashboard-folder-permissions"
parent = "permissions"
weight = 3
+++

# Dashboard & Folder Permissions

{{< docs-imagebox img="/img/docs/v50/folder_permissions.png" max-width="500px" class="docs-image--right" >}}

For dashboards and dashboard folders there is a **Permissions** page that make it possible to
remove the default role based permissions for Editors and Viewers. On this page you can add and assign permissions to specific **Users** and **Teams**.

You can assign & remove permissions for **Organization Roles**, **Users** and **Teams**.

Permission levels:

- **Admin**: Can edit & create dashboards and edit permissions.
- **Edit**: Can edit & create dashboards. **Cannot** edit folder/dashboard permissions.
- **View**: Can only view existing dashboards/folders.

## Restricting Access

The highest permission always wins so if you for example want to hide a folder or dashboard from others you need to remove the **Organization Role** based permission from the Access Control List (ACL).

- You cannot override permissions for users with the **Org Admin Role**. Admins always have access to everything.
- A more specific permission with a lower permission level will not have any effect if a more general rule exists with higher permission level. You need to remove or lower the permission level of the more general rule.

### How Grafana Resolves Multiple Permissions - Examples

#### Example 1 (`user1` has the Editor Role)

Permissions for a dashboard:

- `Everyone with Editor Role Can Edit`
- `user1 Can View`

Result: `user1` has Edit permission as the highest permission always wins.

#### Example 2 (`user1` has the Viewer Role and is a member of `team1`)

Permissions for a dashboard:

- `Everyone with Viewer Role Can View`
- `user1 Can Edit`
- `team1 Can Admin`

Result: `user1` has Admin permission as the highest permission always wins.

#### Example 3

Permissions for a dashboard:

- `user1 Can Admin (inherited from parent folder)`
- `user1 Can Edit`

Result: You cannot override to a lower permission. `user1` has Admin permission as the highest permission always wins.

## Summary

- **View**: Can only view existing dashboards/folders.
- You cannot override permissions for users with **Org Admin Role**
- A more specific permission with lower permission level will not have any effect if a more general rule exists with higher permission level.

For example if "Everyone with Editor Role Can Edit" exists in the ACL list then **John Doe** will still have Edit permission even after you have specifically added a permission for this user with the permission set to **View**. You need to remove or lower the permission level of the more general rule.
- You cannot override permissions for users with **Org Admin Role**
- A more specific permission with lower permission level will not have any effect if a more general rule exists with higher permission level. For example if "Everyone with Editor Role Can Edit" exists in the ACL list then **John Doe** will still have Edit permission even after you have specifically added a permission for this user with the permission set to **View**. You need to remove or lower the permission level of the more general rule.
