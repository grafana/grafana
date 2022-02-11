+++
title = "Manage dashboard permissions"
aliases = ["/docs/grafana/latest/permissions/dashboard_folder_permissions/", "docs/sources/administration/manage-users-and-permissions/manage-dashboard-permissions/_index.md"]
weight = 500
+++

# Manage dashboard permissions

Dashboard and dasboard folder permissions enable you to grant a viewer the ability to edit and save dashboard changes, or limit an editor's permission to modify a dashboard.

The following table lists permissions for each dashboard role:

| Permission                       | Admin                     | Editor | Viewer |
| :------------------------------- | :------------------------: | :----: | :----: |
| View the dashboard               |             x              |   x    |   x    |
| Update the dashboard (including queries, panels, template variables, and annotations)                       |             x              |   x    |        |
| Delete the dashboard             |             x              |   x    |        |
| Update dashboard permissions     |             x              |        |        |

For more information about dashboard permissions, refer to [Dashboard permissions]({{< relref "../about-users-and-permissions/#dashboard-permissions">}}).

{{< section >}}
