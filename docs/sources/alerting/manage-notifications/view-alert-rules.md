---
aliases:
  - ../../alerting/unified-alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/rule-list
  - ../../alerting/alerting-rules/view-alert-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-alert-rules
  - ../../alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-list
canonical: https://grafana.com/docs/grafana/latest/alerting/manage-notifications/view-alert-rules/
description: View alert rules
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - view
labels:
  products:
    - cloud
    - enterprise
    - oss
title: View alert rules
weight: 410
---

# View alert rules

The Alert rules list view page lists all existing alert rules. By default, alert rules are grouped by alert rule type: Grafana-managed (Grafana) or data source-managed (Mimir/Cortex/Loki). The Grafana section also contains alert rules for Prometheus-compatible data sources. You can view alert rules for Prometheus compatible data sources, but you cannot edit them.

When managing large volumes of alerts, you can use extended alert rule search capabilities to filter on folders, evaluation groups, and rules. Additionally, you can filter alert rules by their properties like labels, state, type, and health.

From the Alert rule list page, you can duplicate alert rules, silence notifications and pause or resume evaluation. If you pause evaluation, the alert rule state shows as **Paused**.

### Grouped view

Grouped view shows Grafana alert rules grouped by folder and Loki or Prometheus alert rules grouped by `namespace` + `group`. This is the default rule list view, intended for managing alert rules. You can expand each group to view a list of rules in this group.

### State view

State view shows alert rules grouped by state. Use this view to get an overview of which rules are in which state. You can expand each group to view more details.

## View alert rule details

To view alert rule details, complete the following steps.

1. Click **Alerts & IRM** -> **Alert rules**.
1. Click to expand an alert rule.
1. In **Actions**, click **View** (the eye icon).

   The namespace and group are shown in the breadcrumb navigation. They are interactive and can be used to filter rules by namespace or group.

   The rest of the alert detail content is split up into tabs:

   **Query and conditions**

   View the details of the query that is used for the alert rule, including the expressions and intermediate values for each step of the expression pipeline. A graph view is included for range queries and data sources that return time series-like data frames.

   **Instances**

   Explore each alert instance, its status, labels and various other metadata for multi-dimensional alert rules.

   Use **Search by label** to enter search criteria using label selectors. For example, `environment=production,region=~US|EU,severity!=warning`.

   **History**

   Explore the recorded history for an alert rule. You can also filter by alert state.

   **Details**

   Debug or audit using the alert rule metadata and view the alert rule annotations.
