+++
title = "Restricting access"
weight = 500
+++

# Restricting Access

The highest permission always wins so if you for example want to hide a folder or dashboard from others you need to remove the **Organization Role** based permission from the Access Control List (ACL).

- You cannot override permissions for users with the Organization Admin role. Admins always have access to everything.
- A more specific permission with a lower permission level will not have any effect if a more general rule exists with higher permission level. You need to remove or lower the permission level of the more general rule.

## How Grafana Resolves Multiple Permissions - Examples

### Example 1 (`user1` has the Editor Role)

Permissions for a dashboard:

- Everyone with Editor role can edit
- user1 can view

Result: `user1` has Edit permission as the highest permission always wins.

### Example 2 (`user1` has the Viewer Role and is a member of `team1`)

Permissions for a dashboard:

- `Everyone with Viewer Role Can View`
- `user1 Can Edit`
- `team1 Can Admin`

Result: `user1` has Admin permission as the highest permission always wins.

### Example 3

Permissions for a dashboard:

- `user1 Can Admin (inherited from parent folder)`
- `user1 Can Edit`

Result: You cannot override to a lower permission. `user1` has Admin permission as the highest permission always wins.
