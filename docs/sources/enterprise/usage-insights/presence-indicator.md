---
aliases:
  - presence-indicator.md/
description: Know who is looking at the same dashboard as you are
keywords:
  - grafana
  - presence-indicator
  - enterprise
title: Presence indicator
weight: 300
---

# Presence indicator

> **Note:** Available in Grafana Enterprise v7.0+.

When you are signed in and looking at any given dashboard, you can know who is looking at the same dashboard as you are via a presence indicator, which displays avatars of users who have interacted with the dashboard recently. The default time frame is within the past 10 minutes. To see the user's name, hover over the user's avatar. The avatars come from [Gravatar](https://gravatar.com) based on the user's email.

When there are more active users on a dashboard than can fit within the presence indicator, click the **+X** icon. Doing so opens [dashboard insights]({{< relref "dashboard-datasource-insights.md" >}}), which contains more details about recent user activity.

{{< figure src="/static/img/docs/enterprise/presence_indicators.png" max-width="400px" class="docs-image--no-shadow" >}}

To change _recent_ to something other than the past 10 minutes, edit the [configuration]({{< relref "../../administration/configuration.md">}}) file:

```ini
[analytics.views]
# Set age for recent active users
recent_users_age = 10m
```
