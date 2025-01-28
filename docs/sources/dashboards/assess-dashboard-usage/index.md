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
labels:
  products:
    - cloud
    - enterprise
title: Assess dashboard usage
weight: 900
refs:
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
  configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
  export-logs-of-usage-insights:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/export-logs/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/export-logs/
  dashboard-sharing:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#public_dashboards
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#public_dashboards
  export-logs-of-usage-insights:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/export-logs/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/export-logs/
---

# Assess dashboard usage

Usage insights enables you to have a better understanding of how your Grafana instance is used.

{{< admonition type="note" >}}
Available in [Grafana Enterprise](ref:grafana-enterprise) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).
Grafana Cloud insights logs include additional fields with their own dashboards.
Read more in the [Grafana Cloud documentation](https://grafana.com/docs/grafana-cloud/account-management/usage-insights/).
{{< /admonition >}}

The usage insights feature collects a number of aggregated data and stores them in the database:

- Dashboard views (aggregated and per user)
- Data source errors
- Data source queries

The aggregated data provides you access to several features:

- [Dashboard and data source insights](#dashboard-and-data-source-insights)
- [Presence indicator](#presence-indicator)
- [Sort dashboards by using insights data](#sort-dashboards-by-using-insights-data)
- [Visualize usage insight data in a dashboard](#visualize-usage-insights-data)

This feature also generates detailed logs that can be exported to Loki. Refer to [Export logs of usage insights](ref:export-logs-of-usage-insights).

## Dashboard and data source insights

For every dashboard and data source, you can access usage information.

### Dashboard insights

To see dashboard usage information, click the dashboard insights icon in the header.

![Dashboard insights icon](/media/docs/grafana/dashboards/screenshot-dashboard-insights-icon-11.2.png)

Dashboard insights show the following information:

- **Stats:** The number of daily queries and errors for the past 30 days.
- **Users & activity:** The daily view count for the last 30 days; last activities on the dashboard and recent users (with a limit of 20).

{{< figure src="/static/img/docs/enterprise/dashboard_insights_stats.png" max-width="400px" class="docs-image--no-shadow" alt="Stats tab" >}}{{< figure src="/static/img/docs/enterprise/dashboard_insights_users.png" max-width="400px" class="docs-image--no-shadow" alt="Users and activity tab" >}}

If [dashboard sharing](ref:dashboard-sharing) is enabled, you'll also see a **Shared dashboards** tab in your analytics.

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

{{< figure src="/media/docs/grafana/dashboards/screenshot-data-source-insights-9.5.png" max-width="650px" class="docs-image--no-shadow" alt="Insights tab for a data source" >}}

## Presence indicator

When you are signed in and looking at a dashboard, you can know who is looking at the same dashboard as you are via a presence indicator, which displays avatars of users who have recently interacted with the dashboard. The default time frame is 10 minutes. To see the user's name, hover over the user's avatar. The avatars come from [Gravatar](https://gravatar.com) based on the user's email.

When there are more active users on a dashboard than can fit within the presence indicator, click the **+X** icon. Doing so opens [dashboard insights](#dashboard-and-data-source-insights), which contains more details about recent user activity.

{{< figure src="/static/img/docs/enterprise/presence_indicators.png" max-width="400px" class="docs-image--no-shadow" alt="Presence indicator icons" >}}

To change _recent_ to something other than the past 10 minutes, edit the [configuration](ref:configuration) file:

```ini
[analytics.views]

# Set age for recent active users to 10 minutes
recent_users_age = 10m
```

To disable the presence indicator, edit the [configuration](ref:configuration) file as follows:

```ini
[analytics.views]


# Disables the presence indicator
recent_users_age = 0
```

The dashboard won't show any avatars and thus no recent user activity.

## Sort dashboards by using insights data

In the search view, you can use insights data to help you find most-used, broken, and unused dashboards.

You can sort the dashboards by:

- Errors total
- Errors 30 days (most and least)
- Views total
- Views 30 days (most and least)

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-sort-9.5.png" max-width="650px" class="docs-image--no-shadow" alt="Open list of dashboard sort options" >}}

## Visualize usage insights data

If you set up your installation to [export logs of usage insights](ref:export-logs-of-usage-insights), there are two dashboards to help you take advantage of this data.

1. [Usage Insights overview](/grafana/dashboards/13785) provides a top-level perspective of user activity.
1. [Data source details](/grafana/dashboards/13786) dashboard provides a view of data source activity and health.

You can click the previous links to download the respective dashboard JSON, then import into your Grafana installation.
