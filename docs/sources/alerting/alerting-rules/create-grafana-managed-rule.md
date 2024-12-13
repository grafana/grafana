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
  alert-instance-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
  modify-the-no-data-or-error-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#modify-the-no-data-or-error-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#modify-the-no-data-or-error-state
  pending-period:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/#pending-period
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/#pending-period
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/
  mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
  alert-rule-query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/
  alert-rule-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#labels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#labels
  expression-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#expression-queries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#expression-queries
  alert-condition:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition
  contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
    - destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  alert-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/
  compatible-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/#supported-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/#supported-data-sources
  shared-provision-alerting-resources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/
  shared-alert-rule-template:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templates/
  shared-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
  shared-link-alert-rules-to-panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/link-alert-rules-to-panels/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/link-alert-rules-to-panels/
---

# Configure Grafana-managed alert rules

Grafana-managed rules can query data from multiple data sources in a single alert rule. They are the most flexible [alert rule type](ref:alert-rules). You can also add expressions to transform your data, set alert conditions, and images in alert notifications.

{{% admonition type="note" %}}
In Grafana Cloud, the number of Grafana-managed alert rules you can create depends on your Grafana Cloud plan.

- Free Forever plan: You can create up to 100 free alert rules, with each alert rule having a maximum of 1000 alert instances.
- All paid plans (Pro and Advanced): They have a soft limit of 2000 alert rules and support unlimited alert instances. To increase the limit, open a support ticket from the [Cloud portal](/docs/grafana-cloud/account-management/support/).

{{% /admonition %}}

To create or edit Grafana-managed alert rules, follow the instructions below. For a practical example, check out our [tutorial on getting started with Grafana alerting](http://grafana.com/tutorials/alerting-get-started/).

## Before you begin

Verify that the data sources you plan to query in the alert rule are [compatible with Grafana-managed alert rules](ref:compatible-data-sources) and are properly configured.

### Permissions

Only users with **Edit** permissions for the folder storing the rules can edit or delete Grafana-managed alert rules.

{{< docs/shared lookup="alerts/configure-provisioning-before-begin.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Default vs Advanced options

You can use default or advanced options for Grafana-managed alert rule creation. The default options streamline rule creation with a cleaner header and a single query and condition. For more complex rules, use advanced options to add multiple queries and expressions.

You can toggle between the two options. Once you have created an alert rule, the system defaults to your previous choice for the next alert rule.

Switching from advanced to default may result in queries and expressions that cannot be converted. In this case, a warning message asks if you want to continue to reset to default settings.

Default and advanced options are enabled by default for Grafana Cloud users and this feature is being rolled out progressively. OSS users can enable them via the [`alertingQueryAndExpressionsStepMode` feature toggle](/setup-grafana/configure-grafana/feature-toggles/).

{{< docs/shared lookup="alerts/configure-alert-rule-name.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Define query and condition

Define a query to get the data you want to measure and a condition that needs to be met before an alert rule fires.

You can toggle between **Default** and **Advanced** options. If the [Default vs. Advanced feature](#default-vs-advanced-options) is not enabled in your Grafana instance, follow the **Advanced options** instructions.

{{< collapse title="Default options" >}}

1. Add a [query](ref:alert-rule-query).
1. Add an [alert condition](ref:alert-condition).

   The **When** input includes the reducer function and the last input is the threshold.

1. Click **Preview** to verify.
   {{< /collapse >}}

{{< collapse title="Advanced options" >}}

1. Select a data source.
1. From the **Options** dropdown, specify a [time range](ref:time-units-and-relative-ranges).

   Note that Grafana Alerting only supports fixed relative time ranges, for example, `now-24hr: now`. It does not support absolute time ranges: `2021-12-02 00:00:00 to 2021-12-05 23:59:592` or semi-relative time ranges: `now/d to: now`.

1. Add a query.

   To add multiple [queries](ref:alert-rule-query), click **Add query**.

   All alert rules are managed by Grafana by default. If you want to switch to a data source-managed alert rule, click **Switch to data source-managed alert rule**.

1. Add one or more [expressions](ref:expression-queries).

   a. For each expression, select either **Classic condition** to create a single alert rule, or choose from the **Math**, **Reduce**, and **Resample** options to generate separate alert for each series.

   When using Prometheus, you can use an instant vector and built-in functions, so you don't need to add additional expressions.

   b. Click **Preview** to verify that the expression is successful.

1. To add a recovery threshold, turn the **Custom recovery threshold** toggle on and fill in a value for when your alert rule should stop firing.

   You can only add one recovery threshold in a query and it must be the alert condition.

1. Click **Set as alert condition** on the query or expression you want to set as your [alert condition](ref:alert-condition).
   {{< /collapse >}}

## Set folder and labels

Organize your alert rule with a folder and set of labels.

In the **Labels** section, you can optionally choose whether to add labels to organize your alert rules and their notifications. For more details, refer to [alert rule labels](ref:alert-rule-labels).

1. Select a folder or click **+ New folder**.

1. Add labels, if required.

   Add custom labels by selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value.

## Configure alert evaluation behavior

Use [alert rule evaluation](ref:alert-rule-evaluation) to determine how frequently an alert rule should be evaluated and how quickly it should change its state.

To do this, you need to make sure that your alert rule is in the right evaluation group and set a pending period time that works best for your use case.

1. Select an evaluation group or click **+ New evaluation group**.

   If you are creating a new evaluation group, specify the interval for the group.

   All rules within the same group are evaluated concurrently over the same time interval.

1. Enter a [pending period](ref:pending-period).

   The pending period is the period in which an alert rule can be in breach of the condition until it fires.

   Once a condition is met, the alert goes into the **Pending** state. If the condition remains active for the duration specified, the alert transitions to the **Firing** state, else it reverts to the **Normal** state.

1. Turn on pause alert notifications, if required.

   You can pause alert rule evaluation to prevent noisy alerting while tuning your alerts.
   Pausing stops alert rule evaluation and doesn't create any alert instances.
   This is different to [mute timings](ref:mute-timings), which stop notifications from being delivered, but still allows for alert rule evaluation and the creation of alert instances.

1. In **Configure no data and error handling**, you can define the alerting behavior and alerting state for two scenarios:

   - When the evaluation returns **No data** or all values are null.
   - When the evaluation returns **Error** or timeout.

   ### Configure no data and error handling

   {{< docs/shared lookup="alerts/table-configure-no-data-and-error.md" source="grafana" version="<GRAFANA_VERSION>" >}}

   For more details, refer to [alert instance states](ref:alert-instance-state) and [modify the no data or error state](ref:modify-the-no-data-or-error-state).

## Configure notifications

Choose to select a contact point directly from the alert rule form or to use notification policy routing as well as set up mute timings and groupings.

Complete the following steps to set up notifications.

1. Configure who receives a notification when an alert rule fires by either choosing **Select contact point** or **Use notification policy**.

   **Select contact point**

   1. Choose this option to select an existing [contact point](ref:contact-points).

      All notifications for this alert rule are sent to this contact point automatically and notification policies are not used.

   1. You can also optionally select a mute timing as well as groupings and timings to define when not to send notifications.

      {{< admonition type="note" >}}
      An auto-generated notification policy is generated. Only admins can view these auto-generated policies from the **Notification policies** list view. Any changes have to be made in the alert rules form. {{< /admonition >}}

   **Use notification policy**

   1. Choose this option to use the [notification policy tree](ref:notification-policies) to direct your notifications.

      {{< admonition type="note" >}}
      All alert rules and instances, irrespective of their labels, match the default notification policy. If there are no nested policies, or no nested policies match the labels in the alert rule or alert instance, then the default notification policy is the matching policy.
      {{< /admonition >}}

   1. Preview your alert instance routing set up.

      Based on the labels added, alert instances are routed to the following notification policies displayed.

   1. Expand each notification policy below to view more details.

   1. Click **See details** to view alert routing details and an email preview.

{{< docs/shared lookup="alerts/configure-notification-message.md" source="grafana" version="<GRAFANA_VERSION>" >}}
