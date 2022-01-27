+++
title = "Grant dashboard permissions"
aliases = ["docs/sources/administration/manage-users-and-permissions/manage-dashboard-permissions/grant-dashboard-permissions.md"]
weight = 20
+++

# Grant dashboard permissions

When you grant dashboard folder permissions, that setting applies to all dashboards in the folder. For a more granular approach to assigning permissions, you can also assign user permissions to individual dashboards.

For example, if a user with the viewer organization role requires editor (or admin) access to a dashboard, you can assign those elevated permissions on an individual basis.

> **Note**: If you have assigned a user dashboard folder permissions, you cannot also assign the user permission to dashboards contained in the folder.

Grant dashboard permissions when you want to restrict or enhance dashboard access for users who do not have permissions defined in the associated dashboard folder.

## Before you begin

- Ensure you have organization administrator privileges
- Identify the dashboard permissions you want to modify and the users or teams to which you want to grant access

**To grant dashboard permissions**:

1. Sign in to Grafana as an organization administrator.
1. In the sidebar, hover your mouse over the **Dashboards** (squares) icon and click **Browse**.
1. Open a dashboard.
1. In the top right corner of the dashboard, click **Dashboard settings** (the cog icon).
1. Click **Permissions** and then click **Add Permission**.
1. In the **Add Permission For** dropdown menu, select **User** or **Team**.
1. Select the user or team.
1. Select the permission and click **Save**.
