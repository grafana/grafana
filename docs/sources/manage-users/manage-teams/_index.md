+++
title = "Manage teams"
weight = 300
+++

# Manage teams

A _team_ is a group of users assigned to an organization on a Grafana server. Each user can belong to more than one organization and more than one team. Teams are generally managed by Organization Admins, but they can also be managed by Editors if the [editors_can_admin]({{< relref "../../administration/configuration.md#editors_can_admin" >}}) server setting is set to `true`. For more information, refer to [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}).

Teams members are assigned one of two permissions:
- Member - Required to be a member of the team.
- Admin - A member of the team that can also manage team membership, change team permissions, change team settings, and add or delete the team.

> **Note:** You must have Organization Admin or Team Admin permissions in order to perform the tasks described in this page.

## View team list

See the complete list of teams in your Grafana organization.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Teams**. Grafana displays the team list.

### Org Admin view

![Team list](/img/docs/manage-users/org-admin-team-list-7-3.png)

### Team Admin view

![Team list](/img/docs/manage-users/team-admin-team-list-7-3.png)

## Create team

Add a team to your Grafana organization.



## Add/remove team members

Add users to a team or remove users from a team.



## Set team member permissions

Change team member permission levels.



## Delete team

Permanently delete the team and all special permissions assigned to it.


