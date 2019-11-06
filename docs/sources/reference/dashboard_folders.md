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

- Create a folder by using the Create Folder link in the side menu (under the create menu (+ icon))
- Use the create Folder button on the Manage Dashboards page.
- When saving a dashboard, you can either choose a folder for the dashboard to be saved in or create a new folder

On the Create Folder page, fill in a unique name for the folder and press Create.

## Manage Dashboards

{{< docs-imagebox img="/img/docs/v50/manage_dashboard_menu.png" max-width="300px" class="docs-image--right" >}}

There is a new Manage Dashboards page where you can carry out a variety of tasks:

- create a folder
- create a dashboard
- move dashboards into folders
- delete multiple dashboards
- navigate to a folder page (where you can set permissions for a folder and/or its dashboards)

## Dashboard Folder Page

You reach the dashboard folder page by clicking on the cog icon that appears when you hover
over a folder in the dashboard list in the search result or on the Manage dashboards page.

The Dashboard Folder Page is similar to the Manage Dashboards page and is where you can carry out the following tasks:

- Allows you to move or delete dashboards in a folder.
- Rename a folder (under the Settings tab).
- Set permissions for the folder (inherited by dashboards in the folder).

## Permissions

Permissions can assigned to a folder and inherited by the containing dashboards. An Access Control List (ACL) is used where
**Organization Role**, **Team** and Individual **User** can be assigned permissions. Read the
 [Dashboard and Folder Permissions]({{< relref "../permissions/dashboard_folder_permissions.md" >}}) docs for more detail
 on the permission system.

