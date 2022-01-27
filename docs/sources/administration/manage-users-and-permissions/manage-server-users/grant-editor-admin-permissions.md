+++
title = "Grant editors administrator permissions"
aliases = ["docs/sources/administration/manage-users-and-permissions/manage-server-users/grant-editor-admin-permissions.md"]
weight = 60
+++

# Grant editors administrator permissions

By default, the editor organization role does not allow editors to manage dashboard folders, dashboards, and teams, which you can change by modifying a configuration parameter.

This setting can be used to enable self-organizing teams to administer their own dashboards.

## Before you begin

- Ensure that you have access to the Grafana server

**To enable editors with administrator permissions**:

1. Log in to the Grafana server and open the Grafana configuration file.

   For more information about the Grafana configuration file and its location, refer to [Configuration]({{< relref "../../../administration/configuration">}}).

1. Locate the `editors_can_admin` parameter.
1. Set the `editors_can_admin` value to `true`.
1. Save your changes and restart the Grafana server.
