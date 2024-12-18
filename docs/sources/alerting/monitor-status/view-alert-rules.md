---
aliases:
  - ../../alerting/unified-alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/rule-list
  - ../../alerting/alerting-rules/view-alert-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-alert-rules
  - ../../alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-list
  - ../../alerting/manage-notifications/view-alert-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-alert-rules/
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-rules/
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
refs:
  view-alert-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-alert-state/
---

# View alert rules

The Alert rules list view page lists all existing recording and alert rules, including those created in Grafana and those available in configured data sources.

To access the Alert rules page, click **Alerts & IRM** -> **Alerting** -> **Alert rules**.

{{< figure src="/media/docs/alerting/alert-rules-page.png" max-width="750px" alt="Alert rule view page in Grafana Alerting" >}}

By default, alert rules are grouped by alert rule type: Grafana-managed or data source-managed.

In this view, you can find and edit rules created in Grafana. However, rules created in Prometheus-compatible data sources are displayed but cannot be edited.

This view includes filters to simplify managing large volumes of alerts.

You can filter by data sources, dashboards, and alert rule properties such as state, type, health, and contact points. The **Search** input allows you to filter by additional parameters like folders, evaluation groups, labels, and more.

You can also change how the rule list is displayed using the **View as** option.

- **Grouped**: Displays Grafana rules grouped by folder and evaluation group, and data-source rules by namespace and evaluation group. This is the default view.

- **List**: Displays Grafana rules grouped only by folder.

- **State**: Displays rules grouped by state, providing an overview for each state.

Select a group to expand it and view the list of alert rules within that group.

{{< figure src="/media/docs/alerting/view-alert-rule-list-with-actions.png" max-width="750px" alt="View alert rule state and alert rule health in Grafana Alerting" >}}

For details on how rule states and alert instance states are displayed, refer to [View alert state](ref:view-alert-state).
