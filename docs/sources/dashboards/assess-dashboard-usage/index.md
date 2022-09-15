---
aliases:
  - /docs/grafana/latest/enterprise/usage-insights/
  - /docs/grafana/latest/enterprise/usage-insights/dashboard-datasource-insights/
  - /docs/grafana/latest/enterprise/usage-insights/presence-indicator/
  - /docs/grafana/latest/enterprise/usage-insights/improved-search/
  - /docs/grafana/latest/dashboards/assess-dashboard-usage/
description: Understand how your Grafana instance is used
keywords:
  - grafana
  - usage-insights
  - enterprise
  - presence-indicator
  - search
  - sort
title: Assess dashboard usage
weight: 200
---

# Assess dashboard usage

Usage insights enables you to have a better understanding of how your Grafana instance is used.

> **Note:** Available in [Grafana Enterprise]({{< relref "../" >}}) and [Grafana Cloud Pro and Advanced]({{< ref "/docs/grafana-cloud" >}}).

The usage insights feature collects a number of aggregated data and stores them in the database:

- Dashboard views (aggregated and per user)
- Data source errors
- Data source queries

The aggregated data provides you access to several features:

- [Dashboard and data source insights]({{< relref "#dashboard-and-data-source-insights" >}})
- [Presence indicator]({{< relref "#presence-indicator" >}})
- [Sort dashboards by using insights data]({{< relref "#sort-dashboards-by-using-insights-data" >}})

This feature also generates detailed logs that can be exported to Loki. Refer to [Export logs of usage insights]({{< relref "../../setup-grafana/configure-security/export-logs/" >}}).

## Dashboard and data source insights

For every dashboard and data source, you can access usage information.

### Dashboard insights

> **Note:** Available in [Grafana Enterprise]({{< relref "../" >}}) version 7.0 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/docs/grafana-cloud" >}}).

To see dashboard usage information, click **Dashboard insights** in the top bar.

{{< figure src="/static/img/docs/enterprise/dashboard_insights_button.png" max-width="400px" class="docs-image--no-shadow" >}}

Dashboard insights show the following information:

- **Stats:** The number of daily queries and errors for the past 30 days.
- **Users & activity:** The daily view count for the last 30 days; last activities on the dashboard and recent users (with a limit of 20).

{{< figure src="/static/img/docs/enterprise/dashboard_insights_stats.png" max-width="400px" class="docs-image--no-shadow" >}}{{< figure src="/static/img/docs/enterprise/dashboard_insights_users.png" max-width="400px" class="docs-image--no-shadow" >}}

### Data source insights

> **Note:** Available in [Grafana Enterprise]({{< relref "../" >}}) version 7.3 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/docs/grafana-cloud" >}}).

Data source insights provides information about how a data source has been used in the past 30 days, such as:

- Queries per day
- Errors per day
- Query load time per day (averaged in ms)

To find data source insights:

1. Go to the Data source list view.
1. Click on a data source.
1. Click the **Insights** tab.

{{< figure src="/static/img/docs/enterprise/datasource_insights.png" max-width="650px" class="docs-image--no-shadow" >}}

## Presence indicator

> **Note:** Available in [Grafana Enterprise]({{< relref "../" >}}) version 7.0 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/docs/grafana-cloud" >}}).

When you are signed in and looking at a dashboard, you can know who is looking at the same dashboard as you are via a presence indicator, which displays avatars of users who have recently interacted with the dashboard. The default timeframe is 10 minutes. To see the user's name, hover over the user's avatar. The avatars come from [Gravatar](https://gravatar.com) based on the user's email.

When there are more active users on a dashboard than can fit within the presence indicator, click the **+X** icon. Doing so opens [dashboard insights]({{< relref "#dashboard-and-data-source-insights" >}}), which contains more details about recent user activity.

{{< figure src="/static/img/docs/enterprise/presence_indicators.png" max-width="400px" class="docs-image--no-shadow" >}}

To change _recent_ to something other than the past 10 minutes, edit the [configuration]({{< relref "../../setup-grafana/configure-grafana/" >}}) file:

```ini
[analytics.views]
# Set age for recent active users
recent_users_age = 10m
```

## Sort dashboards by using insights data

> **Note:** Available in [Grafana Enterprise]({{< relref "../" >}}) version 7.0 and later, and [Grafana Cloud Pro and Advanced]({{< ref "/docs/grafana-cloud" >}}).

In the search view, you can use insights data to help you find most-used, broken, and unused dashbaords.

You can sort the dashboards by:

- Errors total
- Errors 30 days
- Views total
- Views 30 days

{{< figure src="/static/img/docs/enterprise/improved-search-7-5.png" max-width="650px" class="docs-image--no-shadow" >}}
