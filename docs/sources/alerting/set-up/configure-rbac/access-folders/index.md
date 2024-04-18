---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-rbac/access-folders/
description: Manage access using folders
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - RBAC
  - folder access
labels:
  products:
    - enterprise
    - cloud
title: Manage access using folders or data sources
weight: 200
---

## Manage access using folders or data sources

You can further customize access for alert rules by assigning permissions to individual folders or data sources, regardless of role assigned.

{{< admonition type="note" >}}
You can't use folders to customize access to notification resources.
{{< /admonition >}}

Details of how role access can combine with folder or data source permissions for Grafana Alerting are below.

## Folder permissions

To manage folder permissions, complete the following steps.

1. In the left-side menu, click **Dashboards**.
1. Choose the folder you want to add permissions for.

{{< admonition type="note" >}}It doesn’t matter which tab you’re on (Dashboards, Panels, or Alert rules); the folder permission you set applies to all.{{< /admonition >}}

2. Click **Manage permissions** from the Folder actions menu.
3. Update or add permissions as required.

## Data source permissions

By default, users with the basic roles Admin, Editor, and Viewer roles have query access to data sources for Grafana Alerting.

If you used fixed roles or custom roles, you need to update data source permissions.

Alternatively, an admin can assign the role **Datasource Reader**,  which grants the user access to all data sources.

To manage data source permissions, complete the following steps.

1. In the left-side menu, click **Connections** > **Data sources**.
1. Click the data source you want to change the permissions for.
1. Click the **Permissions** tab.
1. In the **Permission column**, update the permission or remove it by clicking **X**.

