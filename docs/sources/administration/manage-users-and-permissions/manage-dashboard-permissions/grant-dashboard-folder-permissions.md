+++
title = "Grant dashboard folder permissions"
aliases = ["docs/sources/administration/manage-users-and-permissions/manage-dashboard-permissions/grant-dashboard-folder-permissions.md"]
weight = 10
+++

# Grant dashboard folder permissions

When you grant user permissions for folders, that setting applies to all dashboards contained in the folder. Consider using this approach to assigning dashboard permissions when you have users or teams who require access to groups of related dashboards.

## Before you begin

- Ensure you have organization administrator privileges
- Identify the dashboard folder permissions you want to modify and the users or teams to which you want to grant access. For more information about dashboard permissions, refer to [Dashboard permissions]({{< relref "../about-users-and-permissions/#dashboard-permissions">}}).

**To grant dashboard folder permissions**:

1. Sign in to Grafana as an organization administrator.
2. In the sidebar, hover your mouse over the **Dashboards** (squares) icon and click **Browse**.
3. Hover your mouse cursor over a folder and click **Go to folder**.
4. Click the **Permissions** tab, and then click **Add Permission**.
5. In the **Add Permission For** dropdown menu, select **User**, **Team**, or one of the role options.
6. Select the user or team.

   If you select a role option, you do not select a user or team.

7. Select the permission and click **Save**.
