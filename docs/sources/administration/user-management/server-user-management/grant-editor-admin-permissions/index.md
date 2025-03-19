---
aliases:
  - ../../manage-users-and-permissions/manage-server-users/grant-editor-admin-permissions/
labels:
  products:
    - enterprise
    - oss
title: Grant editors team creator permissions
weight: 60
---

# Grant editors team creator permissions

By default, the editor organization role does not allow editors to creator and manage teams. You can allow them to do so using the `editors_can_admin` configuration option.

When `editors_can_admin` is enabled, users with the Editor role in an organization can create teams, and they are Administrators of the teams they create. To learn more about team permissions, refer to [Team management](../../../team-management/).

## Before you begin

- Ensure that you have access to the Grafana server

**To enable editors with team creator permissions**:

1. Log in to the Grafana server and open the Grafana configuration file.

   For more information about the Grafana configuration file and its location, refer to [Configuration](../../../../setup-grafana/configure-grafana/).

1. Locate the `editors_can_admin` parameter.
1. Set the `editors_can_admin` value to `true`.
1. Save your changes and restart the Grafana server.
