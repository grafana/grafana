---
aliases:
  - ../enterprise/usage-insights/
  - ../enterprise/usage-insights/dashboard-datasource-insights/
  - ../enterprise/usage-insights/improved-search/
  - ../enterprise/usage-insights/presence-indicator/
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

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud/). Grafana Cloud insights logs include additional fields with their own dashboards. Read more in the [Grafana Cloud documentation](/docs/grafana-cloud/usage-insights/).
{{% /admonition %}}

The usage insights feature collects a number of aggregated data and stores them in the database:

- Dashboard views (aggregated and per user)
- Data source errors
- Data source queries

The aggregated data provides you access to several features:

- [Dashboard and data source insights]({{< relref "#dashboard-and-data-source-insights" >}})
- [Presence indicator]({{< relref "#presence-indicator" >}})
- [Sort dashboards by using insights data]({{< relref "#sort-dashboards-by-using-insights-data" >}})
- [Visualize usage insight data in a dashboard]({{< relref "#visualize-usage-insights-data" >}})

This feature also generates detailed logs that can be exported to Loki. Refer to [Export logs of usage insights]({{< relref "../../setup-grafana/configure-security/export-logs/" >}}).

## Dashboard and data source insights

For every dashboard and data source, you can access usage information.

### Dashboard insights

To see dashboard usage information, click the dashboard insights icon in the header.

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-insights.png" max-width="400px" class="docs-image--no-shadow" >}}

Dashboard insights show the following information:

- **Stats:** The number of daily queries and errors for the past 30 days.
- **Users & activity:** The daily view count for the last 30 days; last activities on the dashboard and recent users (with a limit of 20).

{{< figure src="/static/img/docs/enterprise/dashboard_insights_stats.png" max-width="400px" class="docs-image--no-shadow" >}}{{< figure src="/static/img/docs/enterprise/dashboard_insights_users.png" max-width="400px" class="docs-image--no-shadow" >}}

{{% admonition type="note" %}}

If you've enabled the `publicDashboards` feature toggle, you'll also see a Public dashboards tab in your analytics.

{{% /admonition %}}

### Data source insights

Data source insights provides information about how a data source has been used in the past 30 days, such as:

- Queries per day
- Errors per day
- Query load time per day (averaged in ms)

To find data source insights:

1. Click **Connections** in the main navigation.
1. Under Your connections, click **Data sources**.
1. Click a data source.
1. Click the **Insights** tab.

{{< figure src="/media/docs/grafana/dashboards/screenshot-data-source-insights-9.5.png" max-width="650px" class="docs-image--no-shadow" >}}

## Presence indicator

When you are signed in and looking at a dashboard, you can know who is looking at the same dashboard as you are via a presence indicator, which displays avatars of users who have recently interacted with the dashboard. The default time frame is 10 minutes. To see the user's name, hover over the user's avatar. The avatars come from [Gravatar](https://gravatar.com) based on the user's email.

When there are more active users on a dashboard than can fit within the presence indicator, click the **+X** icon. Doing so opens [dashboard insights]({{< relref "#dashboard-and-data-source-insights" >}}), which contains more details about recent user activity.

{{< figure src="/static/img/docs/enterprise/presence_indicators.png" max-width="400px" class="docs-image--no-shadow" >}}

To change _recent_ to something other than the past 10 minutes, edit the [configuration]({{< relref "../../setup-grafana/configure-grafana/" >}}) file:

```ini
[analytics.views]
# Set age for recent active users
recent_users_age = 10m
```

## Sort dashboards by using insights data

In the search view, you can use insights data to help you find most-used, broken, and unused dashboards.

You can sort the dashboards by:

- Errors total
- Errors 30 days (most and least)
- Views total
- Views 30 days (most and least)

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-sort-9.5.png" max-width="650px" class="docs-image--no-shadow" >}}

## Visualize usage insights data

If you set up your installation to [export logs of usage insights]({{< relref "../../setup-grafana/configure-security/export-logs/" >}}), we've created two dashboards to help you take advantage of this data.

1. [Usage Insights overview](/grafana/dashboards/13785) provides a top-level perspective of user activity.
1. [Data source details](/grafana/dashboards/13786) dashboard provides a view of data source activity and health.

You can click the previous links to download the respective dashboard JSON, then import into your Grafana installation.
