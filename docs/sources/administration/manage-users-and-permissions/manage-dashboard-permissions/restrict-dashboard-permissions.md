+++
title = "Restrict access to dashboards"
aliases = ["docs/sources/permissions/restricting-access.md", "docs/sources/administration/manage-users-and-permissions/manage-dashboard-permissions/restrict-dashboard-permissions.md"]
weight = 50
+++

# Restrict access to dashboards

Grafana applies the highest permission a given user has to access a resource like a dashboard, so if you want to prevent a user from accessing a folder or dashboard you need to consider the user's organization role, folder permissions, and dashboard permissions.

- You cannot override organization administrator permissions. Organization administrators have access to all organization resources.
- User permissions set for a dashboard folder propagate to dashboards contained in the folder.
- A lower permission level does not affect access if a more general rule exists with a higher permission.

Refer to the following examples to understand how organization and dashboard permissions impact a user's access to dashboards.

## Example 1

In this example, user1 has the editor organization role.

Dashboard permissions settings:

- Everyone with Editor role can edit
- user1 is set to `view`

Result: User1 has edit permissions because the user's organization role is Editor.

## Example 2

In this example, user1 has the viewer organization role and is a member of team1.

Dashboard permissions settings:

- Everyone with Viewer role can view
- user1 is set to `edit`
- team1 is set to `admin`

Result: User1 has administrator permissions for the dashboard because user1 is a member of team1.

## Example 3

In this example, user1 has the viewer organization role.

Dashboard permissions settings:

- user1 is set to `admin`, which is inherited from the permissions set in parent folder
- user1 is set to `edit`

Result: You receive an error message that cannot override a higher permission with a lower permission in the same dashboard. User1 has administrator permissions.

> Refer to [Fine-grained access Control]({{< relref "../../../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to understand how to use fine-grained permissions to restrict access to dashboards, folders, administrative functions, and other resources.
