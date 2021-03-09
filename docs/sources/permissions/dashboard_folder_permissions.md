+++
title = "Dashboard and Folder Permissions"
description = "Grafana Dashboard and Folder Permissions Guide "
keywords = ["grafana", "configuration", "documentation", "dashboard", "folder", "permissions", "teams"]
weight = 200
+++

# Dashboard and Folder Permissions

{{< docs-imagebox img="/img/docs/v50/folder_permissions.png" max-width="500px" class="docs-image--right" >}}

For dashboards and dashboard folders there is a **Permissions** page that makes it possible to
remove the default role based permissions for Editors and Viewers. On this page you can add and assign permissions to specific **Users** and **Teams**.

You can assign and remove permissions for **Organization Roles**, **Users** and **Teams**.

Permission levels:

- **Admin**: Can edit and create dashboards and edit permissions. Can also add, edit, and delete folders.
- **Edit**: Can edit and create dashboards. **Cannot** edit folder/dashboard permissions, or add, edit, or delete folders.
- **View**: Can only view existing dashboards/folders.

## Grant folder permissions

1. In the sidebar, hover your mouse over the **Dashboards** (squares) icon and then click **Manage**.
1. Hover your mouse cursor over a folder and then click **Go to folder**.
1. Go to the **Permissions** tab, and then click **Add Permission**.
1. In the **Add Permission For** dialog, select **User**, **Team**, or one of the role options.
1. In the second box, select the user or team to add permission for. Skip this step if you selected a role option in the previous step.
1. In the third box, select the permission you want to add.
1. Click **Save**.

## Grant dashboard permissions

1. In the top right corner of your dashboard, click the cog icon to go to **Dashboard settings**.
1. Go to the **Permissions** tab, and then click **Add Permission**.
1. In the **Add Permission For** dialog, select **User**, **Team**, or one of the role options.
1. In the second box, select the user or team to add permission for. Skip this step if you selected a role option in the previous step.
1. In the third box, select the permission you want to add.
1. Click **Save**.
