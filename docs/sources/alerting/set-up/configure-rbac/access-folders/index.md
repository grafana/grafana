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

1. In the left-side menu, click Dashboards.
1. Choose the folder you want to add permissions for.
1. Click **Manage permissions** from the Folder actions menu.
1. Update or add permissions as required.

## Data source permissions

To manage data source permissions, complete the following steps.

1. On the data source permissions page, grant the user access to the data source.

1. Alternatively, an admin can assign the role **Datasource Reader** which grants the user access to all data sources.

