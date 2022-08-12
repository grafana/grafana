---
aliases:
  - /docs/grafana/latest/administration/manage-users-and-permissions/manage-server-users/grant-editor-admin-permissions/
title: Grant editors administrator permissions
weight: 60
---

# Grant editors administrator permissions

By default, the editor organization role does not allow editors to manage dashboard folders, dashboards, and teams, which you can change by modifying a configuration parameter. You can allow them to do so using the `editors_can_admin` configuration option.

This setting can be used to enable self-organizing teams to administer their own dashboards.

When `editors_can_admin` is enabled:

- Users with the Editor role in an organization are Administrators for new dashboards and folders they create, meaning they can edit dashboard permissions. To learn more about dashboard permissions, refer to [Manage dashboard permissions]({{< relref "../manage-dashboard-permissions/" >}}).
- Users with the Editor role in an organization can create teams, and they are Administrators of the teams they create. To learn more about team permissions, refer to [Team management]({{< relref "../../team-management/" >}}).

> **Note**: If you use Grafana Enterprise and customize users' permissions using RBAC, the RBAC permissions override the functionality enabled by the `editors_can_admin` flag.

## Before you begin

- Ensure that you have access to the Grafana server

**To enable editors with administrator permissions**:

1. Log in to the Grafana server and open the Grafana configuration file.

   For more information about the Grafana configuration file and its location, refer to [Configuration]({{< relref "../../../setup-grafana/configure-grafana/" >}}).

1. Locate the `editors_can_admin` parameter.
1. Set the `editors_can_admin` value to `true`.
1. Save your changes and restart the Grafana server.
