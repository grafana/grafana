---
title: Manage users
weight: 50
---

# Manage users

Grafana offers several options for grouping users. Each level has different tools for managing user accounts and different tasks that they can perform.

One of the most important user management tasks is assigning roles, which govern what [permissions]({{< relref "../permissions/_index.md" >}}) a user has. The correct permissions ensure that users have access to only the resources they need.

> Refer to [Fine-grained access Control]({{< relref "../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to understand how you can manage users with fine-grained permissions.

## Server

The highest and broadest level of user group in Grafana is the server. Every user with an account in a Grafana instance is a member of the server group.

Grafana Server Admins are user accounts that have the Grafana Admin option set to **Yes**. They can manage individual user accounts and organizations on their server.

Server Admins can:

- [Manage users]({{< relref "server-admin/server-admin-manage-users.md" >}})
- [Manage organizations]({{< relref "server-admin/server-admin-manage-orgs.md" >}})

## Organization

Organizations are groups of users on a server. Users can belong to one or more organizations, but each user must belong to at least one organization.

Data sources, plugins, and dashboards are associated with organizations. This means that you can have a server with two organizations, one with a Prometheus data source and another with an InfluxDB data source. Each organization has separate data and dashboards.

Members of organizations have permissions based on their _role_ in the organization. For more information, refer to [Organization roles]({{< relref "../permissions/organization_roles.md" >}}).

Organization Admins are user accounts that are assigned the Admin role for an organization. They can manage their users and teams in their organization.

Organization Admins can:

- [Manage users]({{< relref "org-admin/_index.md" >}})
- [Manage teams]({{< relref "manage-teams/index.md" >}})

## Teams

Teams are groups of users within the same organization. Teams allow you to grant permissions for a group of users. They are most often used to manage [permissions for folders and dashboards]({{< relref "../permissions/dashboard-folder-permissions.md" >}}). Enterprise users can use them to apply [data source permissions]({{< relref "../enterprise/datasource_permissions.md" >}}).

Teams are mostly managed by Organization Admins. However, if the Grafana server setting [editors_can_admin]({{< relref "../administration/configuration.md#editors_can_admin" >}}) is applied, then users who are assigned the Team Admin role can also manage teams in their organization and users assigned to their teams.

Team Admins can [Manage teams]({{< relref "manage-teams/index.md" >}}).

## Users

Users are named accounts in Grafana with granted permissions to access resources throughout Grafana. All users can manage their own accounts to a limited extent.

Users can:

- [View and edit user profile]({{< relref "user-admin/user-profile.md" >}})
- [Change password]({{< relref "user-admin/change-your-password.md" >}})
- [Switch organizations]({{< relref "user-admin/switch-org.md" >}})

## Learn more

Set up users and teams in our tutorial on how to [Create users and teams](https://grafana.com/tutorials/create-users-and-teams).
