---
description: Manage team role assignments
keywords:
  - grafana
  - fine-grained-access-control
  - roles
  - permissions
  - fine-grained-access-control-usage
  - enterprise
title: Manage team role assignments
weight: 200
---

# Manage team role assignments

There are two ways to assign roles directly to teams: in the UI using the role picker, and using the API.

## Manage teams' roles within a specific Organization using the role picker

In order to assign roles to a team within a specific Organization using the role picker, you must have an account with one of the following:

- The Admin built-in role.
- The Server Admin role.
- The fixed role `fixed:roles:writer`, [assigned for the given Organization]({{< relref "../roles/#scope-of-assignments" >}}).
- A custom role with `teams.roles:add` and `teams.roles:remove` permissions.

You must also have the permissions granted by the roles that you want to assign or revoke.

Steps:

1. Navigate to the Teams page by hovering over **Configuration** (the gear icon) in the left navigation menu and selecting **Teams**.
1. Click on the **Roles** column in the row for the team whose roles you would like to edit.
1. Deselect one or more selected roles that you would like to remove from that team.
1. Select one or more roles that you would like to assign to that team.
1. Click the **Update** button to apply the selected roles to that team.

![Team role assignment](/static/img/docs/enterprise/team_role_assignment.png)
![Team roles assigned](/static/img/docs/enterprise/team_role_assigned.png)

The team's permissions will update immediately, and the UI will reflect its new permissions.

## Manage teams' roles via API

To manage team role assignments via API, refer to the [fine-grained access control HTTP API docs]({{< relref "../../../http_api/access_control.md#create-and-remove-team-role-assignments" >}}).
