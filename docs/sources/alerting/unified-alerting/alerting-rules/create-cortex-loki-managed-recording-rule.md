+++
title = "Create Cortex or Loki managed recording rule"
description = "Create Cortex or Loki managed recording rule"
keywords = ["grafana", "alerting", "guide", "rules", "recording rules", "create"]
weight = 400
+++

# Create a Cortex or Loki managed recording rule

Grafana allows you manage recording rules for an external Cortex or Loki instance.

Recording rules allow you to precompute frequently needed or computationally expensive expressions and save their result as a new set of time series. Querying the precomputed result will then often be much faster than executing the original expression every time it is needed. This is especially useful for dashboards, which need to query the same expression repeatedly every time they refresh.

Recording and alerting rules exist in a rule group. Rules within a group are run sequentially at a regular interval, with the same evaluation time. The names of recording rules must be valid [metric names](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels). 

In order for both Cortex and Loki data sources to work with Grafana 8.0 alerting, enable the ruler API by configuring their respective services. The`local` rule storage type, default for Loki, only supports viewing of rules. If you want to edit rules, then configure one of the other rule storage types. When configuring a Grafana Prometheus data source to point to Cortex, use the legacy `/api/prom` prefix, not `/prometheus`. Only single-binary mode is currently supported, and it is not possible to provide a separate URL for the ruler API.

## Add or edit a Cortex or Loki managed recording rule

1. In the Grafana menu hover your cursor over the Alerting (bell) icon.
1. To create a new recording rule, click **New alert rule**. To edit an existing rule, expand one of the recording rules in the **Cortex / Loki** section and click **Edit**.
1. Click on the **Alert type** drop down and select **Cortex / Loki managed recording rule**.
1. Fill out the rest of the fields. Descriptions are listed below in [Recording rule fields](#recording-rule-fields).
1. When you have finished writing your rule, click **Save** in the upper right corner to save the rule, or **Save and exit** to save and exit rule editing.

## Recording rule fields

This section describes the fields you fill out to create a recording rule.

### Rule type

- **Rule name -** Enter a descriptive name. The name will be displayed in the alert rule list, as well as added as `alertname` label to every alert instance that is created from this rule.
- **Rule type -** Select **Cortex / Loki managed recording rule**.
- **Data source -** Select a Prometheus or Loki data source. Only data sources that support Cortex ruler API will be available.
- **Namespace -** Select an existing rule namespace or click **Add new** to create a new one.
- **Group -** Select an existing group within the selected namespace or click **Add new** to create a new one. Newly created rules will be added to the end of the rule group.

![Rule type section screenshot](/static/img/docs/alerting/unified/rule-edit-cortex-recording-rule-8-2.png 'Rule type section screenshot')

### Query

Enter a PromQL or LogQL expression whose result will be recorded as value for the new metric.

![Query section](/static/img/docs/alerting/unified/rule-edit-cortex-recording-rule-query-8-2.png 'Query section screenshot')


### Details

Labels can be optionally added in the details section.

![Details section](/static/img/docs/alerting/unified/rule-recording-rule-labels-8-2.png 'Details section screenshot')
