---
aliases:
  - dashboard_folder_permissions/
description: 'Grafana Dashboard and Folder Permissions Guide '
keywords:
  - grafana
  - configuration
  - documentation
  - dashboard
  - folder
  - permissions
  - teams
title: Dashboard and folder permissions
weight: 200
---

# Grant dashboard and folder permissions

You can assign and remove permissions for organization roles, users, and teams for specific dashboards and dashboard folders. This topic explains how to grant permissions to specific folders and dashboards. To learn more about denying access to certain Grafana users, refer to [Restricting access]({{< relref "restricting-access.md">}}).

{{< figure src="/static/img/docs/permissions/folder-permissions-7-5.png" class="docs-image--no-shadow" max-width= "750px" caption="older permissions" >}}

## Permission levels

There are three permission levels for files and folders. Each of the permissions is processed independently. They permissions are separate from [organization roles]({{< relref "organization_roles.md">}}).

- **Admin -** Can create, edit, or delete dashboards. Can create, edit, and delete folders. Can also change dashboard and folder permissions.
- **Edit -** Can create and edit dashboards. _Cannot_ change folder or dashboard permissions, or add, edit, or delete folders.
- **View -** Can only view existing dashboards and folders.

## Grant folder permissions

Folder permissions apply to the folder and all dashboards contained within it.

1. In the sidebar, hover your mouse over the **Dashboards** (squares) icon and then click **Manage**.
1. Hover your mouse cursor over a folder and then click **Go to folder**.
1. Go to the **Permissions** tab, and then click **Add Permission**.
1. In **Add Permission For**, select **User**, **Team**, or one of the role options.
1. In the second box, select the user or team to add permission for. Skip this step if you selected a role option in the previous step.
1. In the third box, select the permission you want to add.
1. Click **Save**.

## Grant dashboard permissions

1. In the top right corner of your dashboard, click the cog icon to go to **Dashboard settings**.
1. Go to the **Permissions** tab, and then click **Add Permission**.
1. In **Add Permission For**, select **User**, **Team**, or one of the role options.
1. In the second box, select the user or team to add permission for. Skip this step if you selected a role option in the previous step.
1. In the third box, select the permission you want to add.
1. Click **Save**.

## Edit permissions

To change existing permissions, navigate to the permissions page as described above. Instead of clicking **Add permission**, change or delete permissions already assigned. Changes take effect immediately.
