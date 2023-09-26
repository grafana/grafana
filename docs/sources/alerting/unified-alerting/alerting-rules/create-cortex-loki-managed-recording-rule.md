+++
title = "Create Cortex or Loki managed recording rule"
description = "Create Cortex or Loki managed recording rule"
keywords = ["grafana", "alerting", "guide", "rules", "recording rules", "create"]
weight = 400
+++

# Create a Cortex or Loki managed recording rule

You can create and manage recording rules for an external Cortex or Loki instance. Recording rules calculate frequently needed expressions or computationally expensive expressions in advance and save the result as a new set of time series. Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh. 

For both Cortex and Loki data sources to work with Grafana 8.0 alerting, enable the ruler API by configuring their respective services. The `local` rule storage type (default for Loki data source), only supports viewing of rules. If you want to edit rules, then configure one of the other rule storage types.

When configuring a Grafana Prometheus data source to point to Cortex, use the legacy /api/prom prefix, not /prometheus. Only single-binary mode is currently supported, provide a separate URL for the ruler API.

## Add a Cortex or Loki managed recording rule

1. Hover your cursor over the Alerting (bell) icon.
1. Click **New alert rule**.
1. Click on the **Alert type** drop down and select **Cortex / Loki managed recording rule**.
1. Enter the recording rule details using instructions in the [Recording rule fields](#recording-rule-fields) section.
1. Click **Save** in the upper right corner to save the rule.

## Edit a Cortex or Loki managed recording rule

1. Hover your cursor over the Alerting (bell) icon in the side menu.
1. Expand an existing recording rule in the **Cortex / Loki** section and click **Edit**.
1. Update the recording rule details using instructions in the [Recording rule fields](#recording-rule-fields) section.
1. Click **Save and exit** to save and exit rule editing.

## Recording rule fields

This section describes the fields you fill out to create a recording rule.

### Rule type

- **Rule name -** Enter a descriptive name. The name will get displayed in the alert rule list. It will also get added as an `alertname` label to every alert instance that is created from this rule. Recording rules names must be valid [metric names](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels). 
- **Rule type -** Select **Cortex / Loki managed recording rule**.
- **Data source -** Select a Prometheus or Loki data source. Only data sources that support Cortex ruler API are available.
- **Namespace -** Select an existing rule namespace or click **Add new** and enter a name to create a new one. Namespaces can contain one or more rule groups and have only organizational purpose.
- **Group -** Select an existing group within the selected namespace or click **Add new** to create a new group. Newly created rules are added to the end of this group. Rules within a group are run sequentially at a regular interval, with the same evaluation time.

![Rule type section screenshot](/static/img/docs/alerting/unified/rule-edit-mimir-recording-rule-8-2.png 'Rule type section screenshot')

### Query

Enter a PromQL or LogQL expression. The result of this expression will get recorded as the value for the new metric.

![Query section](/static/img/docs/alerting/unified/rule-edit-mimir-recording-rule-query-8-2.png 'Query section screenshot')


### Details

You can optionally define labels in the details section.

![Details section](/static/img/docs/alerting/unified/rule-recording-rule-labels-8-2.png 'Details section screenshot')
