---
aliases:
  - add-or-remove-user-from-team/
  - create-or-remove-team/
title: Manage teams
weight: 300
---

# Manage teams

A _team_ is a group of users assigned to an organization on a Grafana server. Each user can belong to more than one organization and more than one team. Teams are generally managed by Organization Admins, but they can also be managed by Editors if the [editors_can_admin]({{< relref "../../administration/configuration.md#editors_can_admin" >}}) server setting is set to `true`. For more information, refer to [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}).

Teams members are assigned one of two permissions:

- Member - Required to be a member of the team.
- Admin - A member of the team that can also manage team membership, change team permissions, change team settings, and add or delete the team.

> **Note:** You must have Organization Admin or Team Admin permissions, or Editor permissions with [editors_can_admin]({{< relref "../../administration/configuration.md#editors_can_admin" >}}) selected, in order to perform the tasks described in this page. Team Admins can only perform tasks that apply to their specific team.

## View team list

See the complete list of teams in your Grafana organization.

{{< docs/shared "manage-users/view-team-list.md" >}}

### Org Admin view

![Team list](/static/img/docs/manage-users/org-admin-team-list-7-3.png)

### Team Admin view

![Team list](/static/img/docs/manage-users/team-admin-team-list-7-3.png)

## Create a team

Add a team to your Grafana organization.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click **New Team**.
1. Enter team information:
   - **Name -** Enter the name of the new team.
   - **Email -** (Optional) Enter the team email.
1. Click **Create**.
   {{< /docs/list >}}

## Add a team member

Add an existing user account to a team.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click the name of the team that you want to add users to.
1. Click **Add member**.
1. In the **Add team member** list, click the user account that you want to add to the team. You can also type in the field to filter the list.
1. Click **Add to team**.
1. Repeat the process to add more team members.
   {{< /docs/list >}}

![Add team member](/static/img/docs/manage-users/add-team-member-7-3.png)

## Remove a team member

Remove a user account from the team.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click the name of the team that you want to remove users from.
1. Click the red **X** next to the name of the user that you want to remove from the team and then click **Delete**.
   {{< /docs/list >}}

## Set team member permissions

Change team member permission levels.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click the name of the team in which you want to change user permissions.
1. In the team member list, find and click the user account that you want to change. You can use the search field to filter the list if necessary.
1. Click the **Permission** list, and then click the new user permission level.
   {{< /docs/list >}}

![Change team member permissions](/static/img/docs/manage-users/change-team-permissions-7-3.png)

## Delete a team

Permanently delete the team and all special permissions assigned to it.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click the red **X** next to the team that you want to delete and then click **Delete**.
   {{< /docs/list >}}
