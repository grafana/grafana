---
aliases:
  - ../admin/view-server-settings/
  - ../admin/view-server-stats/
  - view-server/
  - view-server/view-server-settings/
  - view-server/view-server-stats/
description: How to view server settings in the Grafana UI
keywords:
  - grafana
  - configuration
  - server
  - settings
labels:
  products:
    - cloud
    - enterprise
title: View server statistics and license
weight: 400
---

# View server statistics and license

This setting contains information about tools that Grafana Server Admins can use to learn more about their Grafana servers.

## View Grafana server settings

> Refer to [Role-based access control](../roles-and-permissions/access-control/) in Grafana Enterprise to understand how you can control access with RBAC permissions.

If you are a Grafana server administrator, use the Settings tab to view the settings that are applied to your Grafana server via the [Configuration](../../setup-grafana/configure-grafana/#configuration-file-location) file and any environmental variables.

> **Note:** Only Grafana server administrators can access the **Server Admin** menu. For more information about about administrative permissions, refer to [Roles and permissions](../roles-and-permissions/#grafana-server-administrators).

### View server settings

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Click **Administration** in the left-side menu, **General**, and then **Settings**.

### Available settings

For a full list of server settings, refer to [Configuration](../../setup-grafana/configure-grafana/#server).

## View Grafana server stats

> Refer to [Role-based access control](../roles-and-permissions/access-control/) in Grafana Enterprise to understand how you can control access with RBAC permissions.

If you are a Grafana server admin, then you can view useful statistics about your Grafana server in the Stats & Licensing tab.

> **Note:** Only Grafana server administrators can access the **Server Admin** menu. For more information about about administrative permissions, refer to [Roles and permissions](../roles-and-permissions/#grafana-server-administrators).

### View server stats

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Click **Administration** in the left-side menu, **General**, and then **Stats and license**.

### Available stats

The following statistics are displayed in the Stats tab:

- Total users
  **Note:** Total users = Total admins + Total editors + Total viewers
- Total admins
- Total editors
- Total viewers
- Active users (seen last 30 days)
  **Note:** Active users = Active admins + Active editors + Active viewers
- Active admins (seen last 30 days)
- Active editors (seen last 30 days)
- Active viewers (seen last 30 days)
- Active sessions
- Total dashboards
- Total orgs
- Total playlists
- Total snapshots
- Total dashboard tags
- Total starred dashboards
- Total alerts

### Counting users

If a user belongs to several organizations, then that user is counted once as a user in the highest organization role they are assigned, regardless of how many organizations the user belongs to.

For example, if Sofia is a Viewer in two organizations, an Editor in two organizations, and Admin in three organizations, then she would be reflected in the stats as:

- Total users 1
- Total admins 1
