---
aliases:
  - ../reference/dashboard_folders/
  - /docs/grafana/latest/dashboards/dashboard-folders/
keywords:
  - grafana
  - dashboard
  - dashboard folders
  - folder
  - folders
  - documentation
  - guide
title: Dashboard Folders
weight: 6
---

# Dashboard Folders

Folders are a way to organize and group dashboards - very useful if you have a lot of dashboards or multiple teams using the same Grafana instance.

> **Note:** Only Grafana Admins and Super Admins can create, edit, or delete folders. Refer to [Dashboard permissions]({{< relref "../administration/roles-and-permissions/#dashboard-permissions" >}}) for more information.

## How To Create A Folder

- Create a folder by using the **New folder** link in the side menu (under the **Dashboards** menu)
- Use the **New folder** button on the **Browse dashboards** page.
- When saving a dashboard, you can either choose a folder for the dashboard to be saved in or create a new folder

On the New folder page, fill in a unique name for the folder and then click Create.

## Manage Dashboards

{{< figure src="/static/img/docs/v50/manage_dashboard_menu.png" max-width="300px" class="docs-image--right" >}}

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

Permissions can be assigned to a folder and inherited by the containing dashboards. An Access Control List (ACL) is used where
**Organization Role**, **Team** and Individual **User** can be assigned permissions. Read the
[Dashboard permissions]({{< relref "../administration/roles-and-permissions/#dashboard-permissions" >}}) docs for more detail
about permissions.
