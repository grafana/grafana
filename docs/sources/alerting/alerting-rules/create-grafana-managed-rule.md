---
aliases:
  - ../unified-alerting/alerting-rules/create-grafana-managed-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-grafana-managed-rule/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/
description: Configure Grafana-managed alert rules to create alerts that can act on data from any of our supported data sources
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - create
  - grafana-managed
  - data source-managed
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure Grafana-managed alert rules
weight: 100
refs:
  time-units-and-relative-ranges:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#time-units-and-relative-ranges
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/use-dashboards/#time-units-and-relative-ranges
  fundamentals:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/
  alert-instance-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
  keep-last-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#keep-last-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#keep-last-state
  add-a-query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#add-a-query
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/#add-a-query
  pending-period:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/#pending-period
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/#pending-period
  alerting-on-numeric-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#alert-on-numeric-data
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#alert-on-numeric-data
  expression-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/expression-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/expression-queries/
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  alert-list:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/alert-list/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/alert-list/
  time-series:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
---

# Configure Grafana-managed alert rules

Grafana-managed rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of our supported data sources. In addition to supporting multiple data sources, you can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported. This is the only type of rule that allows alerting from multiple data sources in a single rule definition.

Multiple alert instances can be created as a result of one alert rule (also known as a multi-dimensional alerting).

{{% admonition type="note" %}}
For Grafana Cloud Free Forever, you can create up to 100 free Grafana-managed alert rules with each alert rule having a maximum of 1000 alert instances.
{{% /admonition %}}

Grafana managed alert rules can only be edited or deleted by users with Edit permissions for the folder storing the rules.

If you delete an alerting resource created in the UI, you can no longer retrieve it.
To make a backup of your configuration and to be able to restore deleted alerting resources, create your alerting resources using file provisioning, Terraform, or the Alerting API.

In the following sections, we’ll guide you through the process of creating your Grafana-managed alert rules.

To create a Grafana-managed alert rule, use the in-product alert creation flow and follow these steps.

To get started quickly, refer to our [tutorial on getting started with Grafana alerting](http://grafana.com/tutorials/alerting-get-started/).

## Set alert rule name

1. Click **Alerts & IRM** -> **Alert rules** -> **+ New alert rule**.
1. Enter a name to identify your alert rule.

   This name is displayed in the alert rule list. It is also the `alertname` label for every alert instance that is created from this rule.

## Define query and condition

Define a query to get the data you want to measure and a condition that needs to be met before an alert rule fires.

1. Select a data source.
1. From the **Options** dropdown, specify a [time range](ref:time-units-and-relative-ranges).

   **Note:**

   Grafana Alerting only supports fixed relative time ranges, for example, `now-24hr: now`.

   It does not support absolute time ranges: `2021-12-02 00:00:00 to 2021-12-05 23:59:592` or semi-relative time ranges: `now/d to: now`.

1. Add a query.

   To add multiple [queries](ref:add-a-query), click **Add query**.

   All alert rules are managed by Grafana by default. If you want to switch to a data source-managed alert rule, click **Switch to data source-managed alert rule**.

1. Add one or more [expressions](ref:expression-queries).

   a. For each expression, select either **Classic condition** to create a single alert rule, or choose from the **Math**, **Reduce**, and **Resample** options to generate separate alert for each series.

   {{% admonition type="note" %}}
   When using Prometheus, you can use an instant vector and built-in functions, so you don't need to add additional expressions.
   {{% /admonition %}}

   b. Click **Preview** to verify that the expression is successful.

1. To add a recovery threshold, turn the **Custom recovery threshold** toggle on and fill in a value for when your alert rule should stop firing.

   You can only add one recovery threshold in a query and it must be the alert condition.

1. Click **Set as alert condition** on the query or expression you want to set as your alert condition.

## Set alert evaluation behavior

Use alert rule evaluation to determine how frequently an alert rule should be evaluated and how quickly it should change its state.

To do this, you need to make sure that your alert rule is in the right evaluation group and set a pending period time that works best for your use case.

1. Select a folder or click **+ New folder**.
1. Select an evaluation group or click **+ New evaluation group**.

   If you are creating a new evaluation group, specify the interval for the group.

   All rules within the same group are evaluated concurrently over the same time interval.

1. Enter a pending period.

   The pending period is the period in which an alert rule can be in breach of the condition until it fires.

   Once a condition is met, the alert goes into the **Pending** state. If the condition remains active for the duration specified, the alert transitions to the **Firing** state, else it reverts to the **Normal** state.

1. Turn on pause alert notifications, if required.

   {{< admonition type="note" >}}
   You can pause alert rule evaluation to prevent noisy alerting while tuning your alerts.
   Pausing stops alert rule evaluation and doesn't create any alert instances.
   This is different to mute timings, which stop notifications from being delivered, but still allows for alert rule evaluation and the creation of alert instances.
   {{< /admonition >}}

1. In **Configure no data and error handling**, configure alerting behavior in the absence of data.

   Use the guidelines in [No data and error handling](#configure-no-data-and-error-handling).

## Configure labels and notifications

In the **Labels** section, you can optionally choose whether to add labels to organize your alert rules, make searching easier, as well as set which notification policy should handle your firing alert instance.

In the **Configure notifications** section, you can choose to select a contact point directly from the alert rule form or choose to use notification policy routing as well as set up mute timings and groupings.

Complete the following steps to set up labels and notifications.

1. Add labels, if required.

   Add custom labels by selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value.

2. Configure who receives a notification when an alert rule fires by either choosing **Select contact point** or **Use notification policy**.

   **Select contact point**

   1. Choose this option to select an existing contact point.

      All notifications for this alert rule are sent to this contact point automatically and notification policies are not used.

   2. You can also optionally select a mute timing as well as groupings and timings to define when not to send notifications.

      {{< admonition type="note" >}}
      An auto-generated notification policy is generated. Only admins can view these auto-generated policies from the **Notification policies** list view. Any changes have to be made in the alert rules form. {{< /admonition >}}

   **Use notification policy**

   3. Choose this option to use the notification policy tree to direct your notifications.

      {{< admonition type="note" >}}
      All alert rules and instances, irrespective of their labels, match the default notification policy. If there are no nested policies, or no nested policies match the labels in the alert rule or alert instance, then the default notification policy is the matching policy.
      {{< /admonition >}}

   4. Preview your alert instance routing set up.

      Based on the labels added, alert instances are routed to the following notification policies displayed.

   5. Expand each notification policy below to view more details.

   6. Click **See details** to view alert routing details and an email preview.

## Add annotations

Add [annotations](ref:annotation-label). to provide more context on the alert in your alert notification message.

Annotations add metadata to provide more information on the alert in your alert notification message. For example, add a **Summary** annotation to tell you which value caused the alert to fire or which server it happened on.

1. Optional: Add a summary.

   Short summary of what happened and why.

1. Optional: Add a description.

   Description of what the alert rule does.

1. Optional: Add a Runbook URL.

   Webpage where you keep your runbook for the alert

1. Optional: Add a custom annotation
1. Optional: Add a **dashboard and panel link**.

   Links alert rules to panels in a dashboard.

   {{% admonition type="note" %}}
   At the moment, alert rules are only supported in [time series](ref:time-series) and [alert list](ref:alert-list) visualizations.
   {{% /admonition %}}

1. Click **Save rule**.

## Configure no data and error handling

In **Configure no data and error handling**, you can define the alerting behavior when the evaluation returns no data or an error.

For details about alert states, refer to [lifecycle of alert instances](ref:alert-instance-state).

You can configure the alert instance state when its evaluation returns no data:

| No Data configuration | Description                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No Data               | The default option. Sets alert instance state to `No data`. <br/> The alert rule also creates a new alert instance `DatasourceNoData` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels. |
| Alerting              | Sets alert instance state to `Alerting`. It transitions from `Pending` to `Alerting` after the [pending period](ref:pending-period) has finished.                                                                                         |
| Normal                | Sets alert instance state to `Normal`.                                                                                                                                                                                                    |
| Keep Last State       | Maintains the alert instance in its last state. Useful for mitigating temporary issues, refer to [Keep last state](ref:keep-last-state).                                                                                                  |

You can also configure the alert instance state when its evaluation returns an error or timeout.

| Error configuration | Description                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error               | The default option. Sets alert instance state to `Error`. <br/> The alert rule also creates a new alert instance `DatasourceError` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels. |
| Alerting            | Sets alert instance state to `Alerting`. It transitions from `Pending` to `Alerting` after the [pending period](ref:pending-period) has finished.                                                                                      |
| Normal              | Sets alert instance state to `Normal`.                                                                                                                                                                                                 |
| Keep Last State     | Maintains the alert instance in its last state. Useful for mitigating temporary issues, refer to [Keep last state](ref:keep-last-state).                                                                                               |

When you configure the No data or Error behavior to `Alerting` or `Normal`, Grafana will attempt to keep a stable set of fields under notification `Values`. If your query returns no data or an error, Grafana re-uses the latest known set of fields in `Values`, but will use `-1` in place of the measured value.
