---
aliases:
  - ../manage-users/add-or-remove-user-from-team/
  - ../manage-users/create-or-remove-team/
  - ../manage-users/manage-teams/
  - manage-users-and-permissions/manage-teams/
title: Team management
weight: 400
---

# Team management

A team is a group of users within an organization that have common dashboard and data source permission needs. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

A user can be a Member or an Administrator for a given team. Members of a team inherit permissions from the team, but they cannot edit the team itself. Team Administrators can add members to a team and update its settings, such as the team name, team member's team roles, UI preferences, and home dashboard.

For more information about teams, refer to [Teams and permissions]({{< relref "../roles-and-permissions/#teams-and-permissions" >}}).

For information about how to optimize your teams, refer to [How to best organize your teams and resources in Grafana](https://grafana.com/blog/2022/03/14/how-to-best-organize-your-teams-and-resources-in-grafana/).

This topic describes how to:

- Create a team
- Add a team member
- Grant team member permissions
- Remove a team member
- Delete a team
- View a list of teams

## Before you begin

- Ensure that you have either organization administrator permissions or team administrator permissions
- Make a plan for which users belong to which teams and the permissions team members receive

## Create a team

A team is a group of users within an organization that have common dashboard and data source permission needs. Use teams to help make user-permission management more efficient.

A user can belong to multiple teams.

To create a team:

1. Sign in to Grafana as an organization administrator or team administrator.
1. Click **Administration** in the left-side menu and select **Teams**.
1. Click **New Team**.
1. Complete the fields and click **Create**.
1. Click **Add member**.
1. In the **Add member** field, locate and select a user.
1. Click **Save**.

## Add a team member

Add a team member to an existing team whenever you want to provide access to team dashboards and folders to another user. This task requires that you have organization administrator permissions.

To add a team member:

1. Sign in to Grafana as an organization administrator.
1. Click **Administration** in the left-side menu and select **Teams**.
1. Click the name of the team to which you want to add members, and click **Add member**.
1. Locate and select a user.
1. Choose if you want to add the user as a team Member or an Admin.
1. Click **Save**.

## Grant team member permissions

Complete this task when you want to add or modify team member permissions.

To grant team member permissions:

1. Sign in to Grafana as an organization administrator or a team administrator.
1. Click **Administration** in the left-side menu and select **Teams**.
1. Click the name of the team for which you want to add or modify team member permissions.
1. In the team member list, find and click the user that you want to change. You can use the search field to filter the list if necessary.
1. In the Permission column, select the new user permission level.

## Remove a team member

You can remove a team member when you no longer want to apply team permissions to the user

To remove a team member:

1. Sign in to Grafana as an organization administrator or team administrator.
1. Click **Administration** in the left-side menu and select **Teams**.
1. Click a team from which you want to remove a user.
1. Click the **X** next to the name of the user.

## Delete a team

Delete a team when you no longer need it. This action permanently deletes the team and removes all team permissions from dashboards and folders. This task requires that you have organization administrator permissions.

To delete a team:

1. Sign in to Grafana as an organization administrator.
1. Click **Administration** in the left-side menu and select **Teams**.
1. Click the **X** next to the name of the team.
1. Click **Delete**.

## View a list of teams

See the complete list of teams in your Grafana organization.

To view a list of teams:

1. Sign in to Grafana as an organization administrator or a team administrator.
1. Click **Administration** in the left-side menu and select **Teams**.

The role you use to sign in to Grafana determines how you see team lists.

## Organization administrator view

The following example shows a list as it appears to an organization administrator.

![Team list view for org admin](/media/docs/grafana/screenshot-org-admin-team-list.png)

## Team administrator view

The following example shows a list as it appears to a team administrator.

![Team list view for team admin](/media/docs/grafana/screenshot-team-admin-team-list.png)
