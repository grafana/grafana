---
aliases:
  - /docs/grafana/latest/alerting/alert-groups/
  - /docs/grafana/latest/alerting/unified-alerting/alert-groups/
  - /docs/grafana/latest/alerting/alert-groups/filter-alerts/
  - /docs/grafana/latest/alerting/unified-alerting/alert-groups/
  - /docs/grafana/latest/alerting/alert-groups/
  - /docs/grafana/latest/alerting/alert-groups/view-alert-grouping/
  - /docs/grafana/latest/alerting/unified-alerting/alert-groups/
  - -docs/grafana/latest/alerting/manage-notifications/view-alert-groups/
description: Alert groups
keywords:
  - grafana
  - alerting
  - alerts
  - groups
title: View and filter by alert groups
weight: 455
---

# View and filter by alert groups

Alert groups show grouped alerts from an Alertmanager instance. By default, alert rules are grouped by the label keys for the root policy in notification policies. Grouping common alert rules into a single alert group prevents duplicate alert rules from being fired.

You can view alert groups and also filter for alert rules that match specific criteria.

## View alert groups

To view alert groups, complete the following steps.

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. Click **Alert groups** to open the page listing existing groups.
1. From the **Alertmanager** drop-down, select an external Alertmanager as your data source. By default, the `Grafana` Alertmanager is selected.
1. From **custom group by** drop-down, select a combination of labels to view a grouping other than the default. This is useful for debugging and verifying your grouping of notification policies.

If an alert does not contain labels specified either in the grouping of the root policy or the custom grouping, then the alert is added to a catch all group with a header of `No grouping`.

## Filter alerts

You can filter by label or state.

### Search by label

In **Search**, enter an existing label to view alerts matching the label.

For example, `environment=production,region=~US|EU,severity!=warning`.

### Filter by state

In **States**, select from Active, Suppressed, or Unprocessed states to view alerts matching your selected state. All other alerts are hidden.
