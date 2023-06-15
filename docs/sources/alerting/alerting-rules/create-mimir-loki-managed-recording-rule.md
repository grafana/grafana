---
aliases:
  - ../unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/
  - ../unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
description: Create Grafana Mimir or Loki managed recording rule
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - recording rules
  - create
title: Create Grafana Mimir or Loki managed recording rules
weight: 400
---

# Create Grafana Mimir or Loki managed recording rules

You can create and manage recording rules for an external Grafana Mimir or Loki instance. Recording rules calculate frequently needed expressions or computationally expensive expressions in advance and save the result as a new set of time series. Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh.

**Note:**

Recording rules are run as instant rules, which means that they run every 10s. To overwrite this configuration, update the min_interval in your custom configuration file.

[min_interval]({{< relref "../../setup-grafana/configure-grafana" >}}) sets the minimum interval to enforce between rule evaluations. The default value is 10s which equals the scheduler interval. Rules will be adjusted if they are less than this value or if they are not multiple of the scheduler interval (10s). Higher values can help with resource management as fewer evaluations are scheduled over time.

This setting has precedence over each individual rule frequency. If a rule frequency is lower than this value, then this value is enforced.

## Before you begin

- Verify that you have write permission to the Prometheus or Loki data source. Otherwise, you will not be able to create or update Grafana Mimir managed alerting rules.

- For Grafana Mimir and Loki data sources, enable the ruler API by configuring their respective services.

  - **Loki** - The `local` rule storage type, default for the Loki data source, supports only viewing of rules. To edit rules, configure one of the other rule storage types.

  - **Grafana Mimir** - use the `/prometheus` prefix. The Prometheus data source supports both Grafana Mimir and Prometheus, and Grafana expects that both the [Query API](/docs/mimir/latest/operators-guide/reference-http-api/#querier--query-frontend) and [Ruler API](/docs/mimir/latest/operators-guide/reference-http-api/#ruler) are under the same URL. You cannot provide a separate URL for the Ruler API.

{{% admonition type="note" %}}
If you do not want to manage alerting rules for a particular Loki or Prometheus data source, go to its settings and clear the **Manage alerts via Alerting UI** checkbox.
{{% /admonition %}}

## Add a Grafana Mimir or Loki managed recording rule

To create a Grafana Mimir or Loki managed recording rule

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Alert rules**.
1. Click **+ Create alert rule**. The new alerting rule page opens where the **Grafana managed alert** option is selected by default.
1. In Step 1, add the rule name. The recording name must be a Prometheus metric name and contain no whitespace.
   - In **Rule name**, add a descriptive name.
1. In Step 2, select **Mimir or Loki recording rule** option.
   - Select your Loki or Prometheus data source.
   - Enter a PromQL or LogQL query.
1. In Step 3, add alert evaluation behavior.
   - Enter a valid **For** duration. The expression has to be true for this long for the alert to be fired.
1. In Step 4, add additional metadata associated with the rule.
   - From the **Namespace** dropdown, select an existing rule namespace or add a new one. Namespaces can contain one or more rule groups and only have an organizational purpose. For more information, see [Grafana Mimir or Loki rule groups and namespaces]({{< relref "./edit-mimir-loki-namespace-group" >}}).
   - From the **Group** dropdown, select an existing group within the selected namespace or add a new one. Newly created rules are appended to the end of the group. Rules within a group are run sequentially at a regular interval, with the same evaluation time.
   - Add a description and summary to customize alert messages. Use the guidelines in [Annotations and labels for alerting]({{< relref "../fundamentals/annotation-label" >}}).
   - Add Runbook URL, panel, dashboard, and alert IDs.
1. In Step 5, add custom labels.
   - Add custom labels selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value .
1. Click **Save** to save the rule or **Save and exit** to save the rule and go back to the Alerting page.
