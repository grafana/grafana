---
aliases:
  - ../manage-users/
  - ../permissions/
  - ../permissions/organization_roles/
  - ../permissions/overview/
  - manage-users-and-permissions/about-users-and-permissions/
description: Information about Grafana user, team, and organization roles and permissions
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Roles and permissions
weight: 300
---

# Roles and permissions

A _user_ is any individual who can log in to Grafana. Each user is associated with a _role_ that includes _permissions_. Permissions determine the tasks a user can perform in the system. For example, the **Admin** role includes permissions for an administrator to create and delete users.

You can assign a user one of three types of permissions:

- Grafana server administrator permissions: Manage Grafana server-wide settings and resources
- Organization permissions: Manage access to dashboards, alerts, plugins, teams, playlists, and other resources for an entire organization. The available roles are Viewer, Editor, and Admin.
- Dashboard and folder permission: Manage access to dashboards and folders

{{% admonition type="note" %}}
If you are running Grafana Enterprise, you can also control access to data sources and use role-based access control to grant user access to read and write permissions to specific Grafana resources. For more information about access control options available with Grafana Enterprise, refer to [Grafana Enterprise user permissions features](#grafana-enterprise-user-permissions-features).
{{% /admonition %}}

## Grafana server administrators

A Grafana server administrator manages server-wide settings and access to resources such as organizations, users, and licenses. Grafana includes a default server administrator that you can use to manage all of Grafana, or you can divide that responsibility among other server administrators that you create.

{{% admonition type="note" %}}
The server administrator role does not mean that the user is also a Grafana [organization administrator](#organization-roles).
{{% /admonition %}}

A server administrator can perform the following tasks:

- Manage users and permissions
- Create, edit, and delete organizations
- View server-wide settings defined in the [Configuration](../../setup-grafana/configure-grafana/) file
- View Grafana server statistics, including total users and active sessions
- Upgrade the server to Grafana Enterprise.

{{% admonition type="note" %}}
The server administrator role does not exist in Grafana Cloud.
{{% /admonition %}}

To assign or remove server administrator privileges, see [Server user management](../user-management/server-user-management/assign-remove-server-admin-privileges/).

## Organization users and permissions

All Grafana users belong to at least one organization. An organization is an entity that exists within your instance of Grafana.

Permissions assigned to a user within an organization control the extent to which the user has access to and can update the following organization resources:

- dashboards and folders
- alerts
- playlists
- users within that organization
- data sources
- teams
- organization and team settings
- plugins
- annotations
- library panels
- API keys

For more information about managing organization users, see [User management](../user-management/manage-org-users/).

### Organization roles

Organization role-based permissions are global, which means that each permission level applies to all Grafana resources within an given organization. For example, an editor can see and update _all_ dashboards in an organization, unless those dashboards have been specifically restricted using [dashboard permissions](../user-management/manage-dashboard-permissions/).

Grafana uses the following roles to control user access:

- **Organization administrator**: Has access to all organization resources, including dashboards, users, and teams.
- **Editor**: Can view and edit dashboards, folders, and playlists.
- **Viewer**: Can view dashboards, playlists, and query data sources.
- **No Basic Role**: Has no permissions. Permissions will be added with RBAC as needed.

The following table lists permissions for each role.

| Permission                     | Organization administrator | Editor | Viewer | No Basic Role |
| :----------------------------- | :------------------------: | :----: | :----: | :-----------: |
| View dashboards                |            yes             |  yes   |  yes   |               |
| Add, edit, delete dashboards   |            yes             |  yes   |        |               |
| Add, edit, delete folders      |            yes             |  yes   |        |               |
| View playlists                 |            yes             |  yes   |  yes   |               |
| Add, edit, delete playlists    |            yes             |  yes   |        |               |
| Create library panels          |            yes             |  yes   |        |               |
| View annotations               |            yes             |  yes   |  yes   |               |
| Add, edit, delete annotations  |            yes             |  yes   |        |               |
| Access Explore                 |            yes             |  yes   |        |               |
| Query data sources directly    |            yes             |  yes   |  yes   |               |
| Add, edit, delete data sources |            yes             |        |        |               |
| Add and edit users             |            yes             |        |        |               |
| Add and edit teams             |            yes             |        |        |               |
| Change organizations settings  |            yes             |        |        |               |
| Change team settings           |            yes             |        |        |               |
| Configure application plugins  |            yes             |        |        |               |

## Dashboard permissions

When you want to extend a viewer's ability to edit and save dashboard changes or limit an editor's permission to modify a dashboard, you can assign permissions to dashboards and folders. For example, you might want a certain viewer to be able to edit a dashboard. While that user can _see_ all dashboards, you can grant them access to _update_ only one of them.

> Important: The dashboard permissions you specify override the organization permissions you assign to the user for the selected entity.

You can specify the following permissions to dashboards and folders.

- **Admin**: Can create, edit, or delete a dashboard. Can edit or delete a folder, and create dashboards and subfolders in a folder. Administrators can also change dashboard and folder permissions.
- **Edit**: Can create, edit, or delete a dashboard. Can edit or delete a folder, and create dashboards and subfolders in a folder. Editors _cannot_ change folder or dashboard permissions.
- **View**: Can only view dashboards and folders.

> Important: When a user creates a dashboard or a folder they are automatically granted **Admin** permissions for it.

For more information about assigning dashboard folder permissions, refer to [Grant dashboard folder permissions](../user-management/manage-dashboard-permissions/#grant-dashboard-folder-permissions).

For more information about assigning dashboard permissions, refer to [Grant dashboard permissions](../user-management/manage-dashboard-permissions/#grant-dashboard-permissions).

## Editors with administrator permissions

If you have access to the Grafana server, you can modify the default editor role so that editors can use administrator permissions to manage dashboard folders, dashboards, and teams that they create.

{{% admonition type="note" %}}
This permission does not allow editors to manage folders, dashboards, and teams that they do not create.
{{% /admonition %}}

This setting can be used to enable self-organizing teams to administer their own dashboards.

For more information about assigning administrator permissions to editors, refer to [Grant editors administrator permissions](../user-management/server-user-management/grant-editor-admin-permissions/).

## Viewers with dashboard preview and Explore permissions

If you have access to the Grafana server, you can modify the default viewer role so that viewers can:

- Edit and preview dashboards, but cannot save their changes or create new dashboards.
- Access and use [Explore](../../explore/).

Extending the viewer role is useful for public Grafana installations where you want anonymous users to be able to edit panels and queries, but not be able to save or create new dashboards.

For more information about assigning dashboard preview permissions to viewers, refer to [Enable viewers to preview dashboards and use Explore](../user-management/manage-dashboard-permissions/#enable-viewers-to-edit-but-not-save-dashboards-and-use-explore).

## Teams and permissions

A team is a group of users within an organization that have common dashboard and data source permission needs. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

You can assign a team member one of the following permissions:

- **Member**: Includes the user as a member of the team. Members do not have team administrator privileges.
- **Admin**: Administrators have permission to manage various aspects of the team, including team membership, permissions, and settings.

Because teams exist inside an organization, the organization administrator can manage all teams. When the `editors_can_admin` setting is enabled, editors can create teams and manage teams that they create. For more information about the `editors_can_admin` setting, refer to [Grant editors administrator permissions](../user-management/server-user-management/grant-editor-admin-permissions/).

For details on managing teams, see [Team management](../team-management/).

## Grafana Enterprise user permissions features

While Grafana OSS includes a robust set of permissions and settings that you can use to manage user access to server and organization resources, you might find that you require additional capabilities.

[Grafana Enterprise](../../introduction/grafana-enterprise/) provides the following permissions-related features:

- Data source permissions
- Role-based access control (RBAC)

### Data source permissions

By default, a user can query any data source in an organization, even if the data source is not linked to the user's dashboards.

Data source permissions enable you to restrict data source query permissions to specific **Users**, **Service Accounts**, and **Teams**. For more information about assigning data source permissions, refer to [Data source permissions](../data-source-management/#data-source-permissions/).

### Role-based access control

RBAC provides you a way of granting, changing, and revoking user read and write access to Grafana resources, such as users, reports, and authentication.

For more information about RBAC, refer to [Role-based access control](access-control/).

### Learn more

Want to know more? Complete the [Create users and teams](https://grafana.com/tutorials/create-users-and-teams) tutorial to learn how to set up users and teams.
