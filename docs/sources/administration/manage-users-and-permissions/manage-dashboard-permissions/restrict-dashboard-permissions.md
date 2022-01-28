+++
title = "Restrict access to dashboards"
aliases = ["docs/sources/permissions/restricting-access.md", "docs/sources/administration/manage-users-and-permissions/manage-dashboard-permissions/restrict-dashboard-permissions.md"]
weight = 50
+++

# Restrict access to dashboards

The system applies the highest permission, so if you want to hide a folder or dashboard from others you need to remove the **Organization Role** based permission from the Access Control List (ACL).

<!--- I don't understand the sentence above. -->

- You cannot override organization administrator permissions. Organization administrators have access to all organization resources.
- User permissions set for a dashboard folder propagate to dashboards contained in the folder.
- A lower permission level does not affect access if a more general rule exists with a higher permission.

Refer to the following examples to understand how organization and dashboard permissions impact a user's access to dashboards.

## Example 1

In this example, user1 has the editor organization role.

Dashboard permissions settings:

- Everyone with Editor role can edit
- user1 is set to `view`

Result: User1 has edit permissions because the system applies the highest permissions.

## Example 2

In this example, user1 has the viewer organization role and is a member of team1.

Dashboard permissions settings:

- Everyone with Viewer role can view
- user1 is set to `edit`
- team1 is set to `admin`

Result: User1 has administrator permissions because the system applies the highest permissions.

## Example 3

In this example, user1 has the viewer organization role.

Dashboard permissions settings:

- user1 is set to `admin`, which is inherited from the permissions set in parent folder
- user1 is set to `edit`

Result: You receive a message that cannot override a higher permission with a lower permission in the same dashboard. User1 has administrator permissions because the system applies the highest permissions.

> Refer to [Fine-grained access Control]({{< relref "../../../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to understand how to use fine-grained permissions to restrict access.
