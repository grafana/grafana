+++
title = "Presence indicator"
description = "Know who is looking at the same dashboard as you"
keywords = ["grafana", "presence-indicator", "enterprise"]
aliases = ["/docs/grafana/latest/enterprise/usage-insights/presence-indicator.md"]
weight = 300
+++

# Presence indicator

> **Note:** Available in Grafana Enterprise v7.0+.

The presence indicator is visible to all signed-in users on all dashboards. It shows the avatars of users who interacted with the dashboard recently (last 10 minutes by default). You can see the user's name by hovering your cursor over the user's avatar. The avatars come from [Gravatar](https://gravatar.com) based on the user's email.

When more users are active on a dashboard than can fit in the presence indicator section, click on the `+X` icon that opens [dashboard insights]({{< relref "#dashboard-insights" >}}) to see more details about recent user activity.

{{< docs-imagebox img="/img/docs/enterprise/presence_indicators.png" max-width="400px" class="docs-image--no-shadow" >}}

You can choose your own definition of "recent" by setting it in the [configuration]({{< relref "../../administration/configuration.md">}}) file.

```ini
[analytics.views]
# Set age for recent active users
recent_users_age = 10m
```
