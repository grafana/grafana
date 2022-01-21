+++
title = "About users and permissions"
aliases = ["path here"]
weight = 70
+++

# About users and permissions

Grafana offers several options for grouping users. Each level has different tools for managing user accounts and different tasks that they can perform.

One of the most important user management tasks is assigning roles, which govern what [permissions]({{< relref "../permissions/_index.md" >}}) a user has. The correct permissions ensure that users have access to only the resources they need.

> Refer to [Fine-grained access Control]({{< relref "../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to understand how you can manage users with fine-grained permissions.

## Permissions

> Refer to [Fine-grained access Control]({{< relref "../enterprise/access-control/_index.md" >}}) in Grafana Enterprise for managing access with fine-grained permissions.

What you can do in Grafana is defined by the _permissions_ associated with your user account.

There are three types of permissions:

- Permissions granted as a Grafana Server Admin
- Permissions associated with your role in an organization
- Permissions granted to a specific folder or dashboard

You can be granted permissions based on:

- Grafana Server Admin status.
- Organization role (Admin, Editor, or Viewer).
- Folder or dashboard permissions assigned to your team (Admin, Editor, or Viewer).
- Folder or dashboard permissions assigned to your user account (Admin, Editor, or Viewer).
- (Grafana Enterprise) Data source permissions. For more information, refer to [Data source permissions]({{< relref "../enterprise/datasource_permissions.md" >}}) in [Grafana Enterprise]({{< relref "../enterprise" >}}).
- (Grafana Cloud) Grafana Cloud has additional roles. For more information, refer to [Grafana Cloud roles and permissions](/docs/grafana-cloud/cloud-portal/cloud-roles/).

If you are running Grafana Enterprise, you can grant access by using fine-grained roles and permissions, refer to [Fine-grained access Control]({{< relref "../enterprise/access-control/_index.md" >}}) for more information.

## Grafana server administrators

A Grafana server administrator manages server-wide settings and access to resources such as organizations, users, and permissions. Grafana includes a default server administrator that you can use to manage all of Grafana, or you can divide that responsibility among other server administrators that you create.

A server administrator can perform the following tasks:

- Manage users and permissions
- Create, edit, and delete organizations
- View server-wide settings defined in the [Configuration]({{< relref "../../administration/configuration.md" >}}) file
- View Grafana server statistics, including total users and active sessions
- Upgrade the server to Grafana Enterprise.

> **Note:** This role does not exist in Grafana Cloud.

## Organization users and permissions

All Grafana users belong to at least one organization. An organization is an entity that ..... For more information about organizations, refer to [LINK](xxx.md).

User permissions control the extent to which a user has access to and can update the following Grafana organization resources:

- dashboard and dashboard folders
- playlists
- users
- data sources
- teams
- organization and team settings
- plugins

In addition, users can self-service to modify their user preferences.

### Organization roles

Organization role-based permissions are global, which means that each permission level applies to all Grafana resources. For example, an editor can see and update _all_ dashboards in an organization. For more information about limiting access to specific folders and dashboards, refer to [Dashboard permissions](./dashboard-permissions).

Grafana uses the following roles to control user access:

- **Organization administrator**: Has access to all organization resources, including dashboards, users, and teams.
- **Editor**: Can view and edit dashboards, folders, and playlists.
- **Viewer**: Can view dashboards and playlists.

> Note: If you are a Grafana Enterprise customer, you can use fine-grained access control to grant and revoke access. For more information about fine-grained access control, refer to [Fine-grained access Control]({{< relref "../../enterprise/access-control/_index.md" >}}).

The following table lists permissions for each role.

| Permission                       | Organization administrator | Editor | Viewer |
| :------------------------------- | :------------------------: | :----: | :----: |
| View dashboards                  |             x              |   x    |   x    |
| Add, edit, delete dashboards     |             x              |   x    |        |
| Add, edit, delete folders        |             x              |   x    |        |
| View playlists                   |             x              |   x    |   x    |
| Create, update, delete playlists |             x              |   x    |        |
| Access Explore                   |             x              |   x    |        |
| Add, edit, delete data sources   |             x              |        |        |
| Add and edit users               |             x              |        |        |
| Add and edit teams               |             x              |        |        |
| Change organizations settings    |             x              |        |        |
| Change team settings             |             x              |        |        |
| Configure application plugins    |             x              |        |        |

## Dashboard permissions

When you want to extend a viewer's ability to edit and save dashboard changes or limit an editor's permission to modify a dashboard, you can assign permissions to dashboards and dashboard folders. For example, you might want a viewer to also have permission to edit a dashboard. While that user can see _all_ dashboards, they can only update one of them.

> Important: The dashboard permissions you specify override the organization permissions you assigned to the user for the selected entity.

You can specify the following permissions to dashboards and folders.

- **Admin**: Can create, edit, or delete a dashboard or folder. Administrators can also change dashboard and folder permissions.
- **Edit**: Can create and edit dashboards. Editors _cannot_ change folder or dashboard permissions, or add, edit, or delete folders.
- **View**: Can only view dashboards and folders.

For more information about assigning dashboard folder permissions, refer to [Grant dashboard folder permissions]({{< relref "./manage-dashboard-permissions/grant-dashboard-folder-permissions.md" >}}).

For more information about assigning dashboard permissions, refer to [Grant dashboard permissions]({{< relref "./manage-dashboard-permissions/grant-dashboard-permissions.md" >}}).

## Editors with administrator permissions

If you have access to the Grafana server, you can modify the default editor role so that editors can use administrator permissions to manage dashboard folders, dashboards, and teams that they create.

> **Note**: This permission does not allow editors to manage folders, dashboards, and teams that they do not create.

This setting can be used to enable self-organizing teams to administer their own dashboards.

For more information about assigning administrator permissions to editors, refer to [Grant editors administrator permissions]({{< relref "./manage-server-users/grant-editor-admin-permissions.md" >}}).

## Viewers with dashboard preview and Explore permissions

If you have access to the Grafana server, you can modify the default viewer role so that viewers can:

- Edit and preview dashboards, but cannot save their changes or create new dashboards.
- Access and use [Explore]({{< relref "../../explore/_index.md" >}}).

Extending the viewer role is useful for public Grafana installations where you want anonymous users to be able to edit panels and queries, but not be able to save or create new dashboards.

For more information about assigning dashboard preview permissions to viewers, refer to [Enable viewers to preview dashboards and use Explore]({{< relref "./manage-dashboard-permissions/enable-dashboard-preview-explore.md" >}}).

## Teams and permissions

A team is a group of users within an organization that have common dashboard and data source permission needs. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

You can assign a team member one of the following permissions:

- Member: Includes the user as a member of the team. Members do not have team administrator privileges.
- Admin: Administrators have permission to manage various aspects of the team, including team membership, permissions, and settings.

Because teams exist inside an organization, the organization administrator can manage all teams, and users with the [editors_can_admin] permission can manage teams that they create. For more information about assigning [editors_can_admin] permissions, refer to [Grant editors administrator permissions]({{< relref "./manage-server-users/grant-editor-admin-permissions.md" >}}).

### Learn more

Set up users and teams in our tutorial on how to [Create users and teams](https://grafana.com/tutorials/create-users-and-teams).

## Grafana Enterprise user permissions features

While Grafana includes a robust set of permissions and settings that you can use to manage user access to server and organization resources, you might find that you require additional capabilities.

If you are an Grafana Enterprise customer, you can limit user and team to query a data source and use fine-grained access control to xxx

### Data source permissions

By default, a user can query any data source in an organization, even if the data source is not linked to the user's dashboards.

If you have a Grafana Entrprise license, you can control user and team permissions to query a data source.

use data source permissions to change the default permissions for data sources and restrict query permissions to specific **Users** and **Teams**. For more information about assigning data source permissions, refer to [Data source permissions]({{< relref "../../../enterprise/datasource_permissions.md" >}}).

> **Note:** Most metric databases do not provide per-user series authentication. This means that organization data sources and dashboards are available to all users in a particular organization.

### Fine-grained access control

xxxx.
