+++
title = "Usage-insights"
description = "Usage-insights"
keywords = ["grafana", "usage-insights", "enterprise"]
aliases = ["/docs/grafana/latest/enterprise/usage-insights/"]
type = "docs"
[menu.docs]
name = "Usage-insights"
parent = "enterprise"
weight = 700
+++

# Usage insights

Usage insights allow you to have a better understanding of how your Grafana instance is used. The collected data are the number of:

- Dashboard views (aggregated and per user)
- Data source errors
- Data source queries

> Only available in Grafana Enterprise v7.0+.

## Presence indicator

The presence indicator is visible to all signed-in users on all dashboards. It shows the avatars of users who interacted with the dashboard recently (last 10 minutes by default). You can see the user's name by hovering your cursor over the user's avatar. The avatars come from [Gravatar](https://gravatar.com) based on the user's email.

When more users are active on a dashboard than can fit in the presence indicator section, click on the `+X` icon that opens [dashboard insights]({{< relref "#dashboard-insights" >}}) to see more details about recent user activity. 

{{< docs-imagebox img="/img/docs/enterprise/presence_indicators.png" max-width="400px" class="docs-image--no-shadow" >}}

You can choose your own definition of "recent" by setting it in the [configuration]({{< relref "../administration/configuration.md">}}) file.

```ini
[analytics.views]
# Set age for recent active users
recent_users_age = 10m
```

## Dashboard insights

You can see dashboard usage information by clicking on the `Dashboard insights` button in the top bar.

{{< docs-imagebox img="/img/docs/enterprise/dashboard_insights_button.png" max-width="400px" class="docs-image--no-shadow" >}}

It shows two kinds of information:

- **Stats:** Shows the daily query count and error count for the last 30 days.
- **Users & activity:** Shows the daily view count for the last 30 days; last activities on the dashboard and recent users (with a limit of 20).

{{< docs-imagebox img="/img/docs/enterprise/dashboard_insights_stats.png" max-width="400px" class="docs-image--no-shadow" >}}{{< docs-imagebox img="/img/docs/enterprise/dashboard_insights_users.png" max-width="400px" class="docs-image--no-shadow" >}}


## Improved dashboard search

In the search view, you can sort dashboards using these insights data. It helps you find unused or broken dashboards or discover most viewed ones.

{{< docs-imagebox img="/img/docs/enterprise/improved_search.png" max-width="650px" class="docs-image--no-shadow" >}}
