---
aliases:
  - ../../alerting/unified-alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/rule-list
  - ../../alerting/alerting-rules/view-alert-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-alert-rules
  - ../../alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-list
  - ../../alerting/manage-notifications/view-alert-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-alert-rules/
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-rules/
description: View alert rules, compare their versions, and restore previous alert rules.
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

{{< figure src="/media/docs/alerting/alert-rules-page-2.png" max-width="750px" alt="Alert rule view page in Grafana Alerting" >}}

By default, alert rules are grouped in separate sections—one for Grafana-managed alerts, and another for data source-managed alerts.
Inside the Grafana-managed alert rules section, the rules are organized in a hierarchial structure, from folder -> rule group -> rules.
Inside the data source-managed alert rules section, the rules are organized from namespace ->rule group -> rules.

Select a group to expand it and view the list of alert rules within that group.

The view includes filters to simplify managing large volumes of alerts.

You can filter by data sources, dashboards, and alert rule properties such as state, type, health, and contact points. The **Search** input allows you to filter by additional parameters like folders, evaluation groups, labels, and more.

## Change alert rules list view

You can also change how the rule list is displayed using the **View as** option.

- **Grouped**: Displays Grafana rules grouped in a hierarchial structure, from folder/namespace, to evaluation group, to the individual rules. This is the default view.

- **List**: Displays all rules from all data sources in a flat, unpaginated list.

{{< figure src="/media/docs/alerting/view-alert-rule-list-with-actions-2.png" max-width="750px" alt="View alert rule state and alert rule health in Grafana Alerting" >}}

For details on how rule states and alert instance states are displayed, refer to [View alert state](ref:view-alert-state).

## View, compare and restore alert rules versions.

You can view, compare, and restore previous alert rule versions.

{{< admonition type="note" >}}
In Grafana OSS and Enterprise, the number of alert rule versions is limited. Free users are allowed a maximum of 10 alert rule versions, while paid users have a maximum of 100 stored alert rule versions.
{{< /admonition >}}

To view or restore previous versions for an alert rule, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Alert rules**.
1. Select an alert rule and click **View**.
1. Click the **Versions** tab.  
   The page displays a list of the previous rule versions.

On the Alert rule's Versions page you can view, compare and restore the previous rule versions.
{{< figure src="/media/docs/alerting/screenshot-grafana-alerting-version-history-v3.png" max-width="750px" alt="View alert rule history to compare and restore previous alert rules." >}}

## Bulk pause or resume alert rules evaluations within a folder

Admin users can pause or resume all of the alert rules evaluations within a folder. To pause or resume all the alert rules evaluations in a folder, click the menu icon and select **Pause all rule evaluation** or **Resume all rule evaluation**.

## Bulk delete all alert rules within a folder

Admin users can delete all of the alert rules within a folder. To delete all the alert rules in a folder, click the menu icon and select **Delete**. Then type "Delete" into the field and click **Delete** to confirm the bulk deletion.

## Permanently delete or restore deleted alert rules

Only users with an Admin role can restore deleted Grafana-managed alert rules. After an alert rule is restored, it is restored with a new, different UID from the one it had before.

1. Go to **Alerts & IRM** -> **Alerting** -> **Recently deleted**.
1. Click the **Restore** button to restore the alert rule or click **Delete permanently** to delete the alert rule.

{{< admonition type="note" >}}
Deleted alert rules are stored for 30 days. Grafana Enterprise and OSS users can adjust the length of time for which the rules are stored can be adjusted in the Grafana configuration file's `[unified_alerting].deleted_rule_retention` field. For an example of how to modify the Grafana configuration file, refer to the [documentation example here](/docs/grafana/latest/alerting/set-up/configure-alert-state-history/#configuring-grafana).  
{{< /admonition >}}
