---
aliases:
  - dashboard-datasource-insights.md/
description: Understand how your dashboards and data sources are used
keywords:
  - grafana
  - usage-insights
  - enterprise
title: Dashboard and data source insights
weight: 200
---

# Dashboard and data source insights

For every dashboard and data source, you can access usage information.

## Dashboard insights

> **Note:** Available in Grafana Enterprise v7.0+.

To see dashboard usage information, go to the top bar and click **Dashboard insights**.

{{< figure src="/static/img/docs/enterprise/dashboard_insights_button.png" max-width="400px" class="docs-image--no-shadow" >}}

Dashboard insights show the following information:

- **Stats:** The number of daily queries and errors for the past 30 days.
- **Users & activity:** The daily view count for the last 30 days; last activities on the dashboard and recent users (with a limit of 20).

{{< figure src="/static/img/docs/enterprise/dashboard_insights_stats.png" max-width="400px" class="docs-image--no-shadow" >}}{{< figure src="/static/img/docs/enterprise/dashboard_insights_users.png" max-width="400px" class="docs-image--no-shadow" >}}

## Data source insights

> **Note:** Available in Grafana Enterprise v7.3+.

Data source insights give you information about how a data source has been used in the past 30 days, such as:

- Queries per day
- Errors per day
- Query load time per day (averaged in ms)

To find data source insights:

1. Go to the Data source list view.
1. Click on a data source.
1. Click the **Insights** tab.

{{< figure src="/static/img/docs/enterprise/datasource_insights.png" max-width="650px" class="docs-image--no-shadow" >}}
