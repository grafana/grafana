---
aliases:
  - /docs/grafana/latest/administration/manage-users-and-permissions/manage-teams/
  - /docs/grafana/latest/manage-users/add-or-remove-user-from-team/
  - /docs/grafana/latest/manage-users/create-or-remove-team/
  - /docs/grafana/latest/manage-users/manage-teams/
  - /docs/grafana/latest/administration/team-management/
title: Team management
weight: 400
---

# Team management

A team is a group of users within an organization that have common dashboard and data source permission needs. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

A user can be a Member or an Administrator for a given team. Members of a team inherit permissions from the team, but they cannot edit the team itself. Team Administrators can add members to a team and update its settings, such as the team name, team member's team roles, UI preferences, and home dashboard.

For more information about teams, refer to [Teams and permissions]({{< relref "../roles-and-permissions/#teams-and-permissions" >}}).

## Create a team

A team is a group of users within an organization that have common dashboard and data source permission needs. Use teams to help make user-permission management more efficient.

A user can belong to multiple teams.

### Before you begin

- Ensure that you have either organization administrator permissions or team administrator permissions
- Make a plan for which users belong to which teams and the permissions team members receive

**To create a team**:

1. Sign in to Grafana as an organization administrator or team administrator.
1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Teams**.
1. Click **New Team**.
1. Complete the fields and click **Create**.
1. Click **Add member**.
1. In the **Add team member** field, locate and select a user.
1. Click **Add to team**.

## Add a team member

Add a team member to an existing team whenever you want to provide access to team dashboards and folders to another user.

### Before you begin

- Ensure that you have organization administrator permissions
- [Create a team](#create-a-team).

**To add a team member**:

1. Sign in to Grafana as an organization administrator.
1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Teams**.
1. Click the name of the team to which you want to add members, and click **Add member**.
1. Locate and select a user.
1. Choose if you want to add the user as a team Member or an Admin.
1. Click **Add to team**.

![Add team member](/static/img/docs/manage-users/add-team-member-7-3.png)

## Grant team member permissions

Complete this task when you want to add or modify team member permissions.

### Before you begin

- Ensure that you have either organization administrator permissions or team administrator permissions

**To grant team member permissions**:

1. Sign in to Grafana as an organization administrator or a team administrator.
1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Teams**.
1. Click the name of the team for which you want to add or modify team member permissions.
1. In the team member list, find and click the user that you want to change. You can use the search field to filter the list if necessary.
1. Click the **Permission** list, and then click the new user permission level.

![Change team member permissions](/static/img/docs/manage-users/change-team-permissions-7-3.png)

## Remove a team member

You can remove a team member when you no longer want to apply team permissions to the user

### Before you begin

- Ensure that you have either organization administrator permissions or team administrator permissions

**To remove a team member**:

1. Sign in to Grafana as an organization administrator or team administrator.
1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Teams**.
1. Click a team from which you want to remove a user.
1. Click the **X** next to the name of the user.
1. Click **Delete**.

## Delete a team

Delete a team when you no longer need it. This action permanently deletes the team and removes all team permissions from dashboards and folders.

### Before you begin

- Ensure that you have organization administrator permissions

**To delete a team**:

1. Sign in to Grafana as an organization administrator.
1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Teams**.
1. Click the **X** next to the name of the team.
1. Click **Delete**.

## View a list of teams

See the complete list of teams in your Grafana organization.

### Before you begin

- Ensure that you have either organization administrator permissions or team administrator permissions

**To view a list of teams**:

1. Sign in to Grafana as an organization administrator or a team administrator.
1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Teams**.

The role you use to sign in to Grafana determines how you see team lists.

**Organization administrator view**

The following example shows a list as it appears to an organization administrator.

![Team list](/static/img/docs/manage-users/org-admin-team-list-7-3.png)

**Team administrator view**

The following example shows a list as it appears to a team administrator.

![Team list](/static/img/docs/manage-users/team-admin-team-list-7-3.png)
