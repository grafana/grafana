---
aliases:
  - ../unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/
  - ../unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
description: Configure recording rules
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - recording rules
  - configure
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure recording rules
weight: 300
---

# Configure recording rules

You can create and manage recording rules for an external Grafana Mimir or Loki instance. Recording rules calculate frequently needed expressions or computationally expensive expressions in advance and save the result as a new set of time series. Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh.

**Note:**

Recording rules are run as instant rules, which means that they run every 10s. To overwrite this configuration, update the min_interval in your custom configuration file.

[min_interval][configure-grafana] sets the minimum interval to enforce between rule evaluations. The default value is 10s which equals the scheduler interval. Rules will be adjusted if they are less than this value or if they are not multiple of the scheduler interval (10s). Higher values can help with resource management as fewer evaluations are scheduled over time.

This setting has precedence over each individual rule frequency. If a rule frequency is lower than this value, then this value is enforced.

## Before you begin

- Verify that you have write permission to the Prometheus or Loki data source. Otherwise, you will not be able to create or update Grafana Mimir managed alerting rules.

- For Grafana Mimir and Loki data sources, enable the ruler API by configuring their respective services.

  - **Loki** - The `local` rule storage type, default for the Loki data source, supports only viewing of rules. To edit rules, configure one of the other rule storage types.

  - **Grafana Mimir** - use the `/prometheus` prefix. The Prometheus data source supports both Grafana Mimir and Prometheus, and Grafana expects that both the [Query API](/docs/mimir/latest/operators-guide/reference-http-api/#querier--query-frontend) and [Ruler API](/docs/mimir/latest/operators-guide/reference-http-api/#ruler) are under the same URL. You cannot provide a separate URL for the Ruler API.

## Create recording rules

To create recording rules, follow these steps.

1. Click **Alerts & IRM** -> **Alerting** ->
   **Alert rules**.
1. Click the **More** dropdown and then **New recording rule**.

1. Set rule name.

   The recording rule name must be a Prometheus metric name and contain no whitespace.

1. Define query.
   - Select your Loki or Prometheus data source.
   - Enter a query.
1. Add namespace and group.
   - From the **Namespace** dropdown, select an existing rule namespace or add a new one. Namespaces can contain one or more rule groups and only have an organizational purpose.
   - From the **Group** dropdown, select an existing group within the selected namespace or add a new one. Newly created rules are appended to the end of the group. Rules within a group are run sequentially at a regular interval, with the same evaluation time.
1. Add labels.
   - Add custom labels selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value .
1. Click **Save rule** to save the rule or **Save rule and exit** to save the rule and go back to the Alerting page.

{{% docs/reference %}}
[annotation-label]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/fundamentals/annotation-label"
[annotation-label]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/annotation-label"

[configure-grafana]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana"
[configure-grafana]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana"
{{% /docs/reference %}}
