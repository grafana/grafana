+++
title = "Dashboard Folders"
keywords = ["grafana", "dashboard", "dashboard folders", "folder", "folders", "documentation", "guide"]
type = "docs"
[menu.docs]
name = "Folders"
parent = "dashboard_features"
weight = 3
+++

# Dashboard Folders

Folders are a way to organize and group dashboards - very useful if you have a lot of dashboards or multiple teams using the same Grafana instance.

## How To Create A Folder

- Create a folder by using the Create Folder link in the side menu.

    ![](/img/docs/v50/create_folder_menu.png)

- Use the create Folder button on the Manage Dashboards page.

- When saving a dashboard, you can either choose a folder for the dashboard to be saved in or create a new folder (coming in 5.0 beta)

On the Create Folder page, fill in a unique name for the folder and press Create.

![](/img/docs/v50/create_folder_page.png)

## Manage Dashboards

There is a new Manage Dashboards page where you can carry out a variety of tasks:

- create a folder
- create a dashboard
- move dashboards into folders
- delete multiple dashboards
- navigate to a folder page (where you can set permissions for a folder and/or its dashboards)

There is a new option in the Dashboards menu for the Manage Dashboards page:

  ![](/img/docs/v50/manage_dashboard_menu.png)

Here you can manage your dashboards:

![](/img/docs/v50/manage_dashboards_page.png)

Or you can go directly to a Dashboard Folder page via Dashboard Search by clicking on the cog icon:

![](/img/docs/v50/go_to_dashboard_folder_page.png)

## Dashboard Folder Page

The Dashboard Folder Page is similar to the Manage Dashboards page and is where you can carry out the following tasks:

- allows you to move or delete dashboards in a folder.
- rename a folder (under the Settings tab).
- set permissions on the whole folder.
- set permissions on a single dashboard.

## Dashboard Permissions (Not enabled in Grafana 5.0 alpha)

An Access Control List (ACL) model is used for permissions on Dashboard Folders. An individual user can be assigned permissions on a folder or a Team.

The permissions that can be assigned for a folder are: View, Edit, Admin.

The default is that:

- everyone has access to a folder and that their permissions depend on their user role (Viewer, Editor or Admin).
- An Admin or Editor can remove the default access for everyone and can then assign a user or team to a Dashboard Folder.
- Teams make it easier to assign permissions for multiple users to multiple dashboards.

Other Dashboard Folder rules:

- Users with the Admin and Editor role are allowed to create new Dashboard Folders.
- Users with the Viewer role are not allowed to create new Dashboard Folders.
- Editors who are owners and Admins can assign permissions to users or teams for Dashboard Folders.
- Default permissions can be removed except for the Admin permissions (View, Edit). 

### Limiting Permissions on a Folder

To limit permissions on a folder or dashboard:

1. go to the permissions tab on the Dashboard Folder page
2. remove the default permissions (Everyone with Editor Role / Everyone with Viewer Role)
3. Give a team or user specific permissions. For example: `frontend-team can edit` and `ops-team can view`.

Remember that users with the Admin role will always have permission to all folders and dashboards.

## Teams (Not enabled in Grafana 5.0 alpha)

Teams is a new concept for Grafana 5.0. A team is a group of users that can be assigned permissions on a dashboard folder or a dashboard.

How Teams Work:

- Admins can create teams.
- No hierarchies. Teams cannot contain teams.
- If a user belongs to multiple teams, their permissions are merged to give them the highest permission possible for a dashboard folder or dashboard.
