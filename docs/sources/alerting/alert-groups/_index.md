---
aliases:
  - /docs/grafana/latest/alerting/alert-groups/
  - unified-alerting/alert-groups/
description: Alert groups
keywords:
  - grafana
  - alerting
  - alerts
  - groups
title: Alert groups
weight: 445
---

# Alert groups

Alert groups show grouped alerts from an Alertmanager instance. By default, the alerts are grouped by the label keys for the root policy in [notification policies]({{< relref "../notifications/" >}}). Grouping common alerts into a single alert group prevents duplicate alerts from being fired.

For more information, see:

- [View alert groupings]({{< relref "view-alert-grouping/" >}})
- [Filter alerts by group]({{< relref "filter-alerts/" >}})
