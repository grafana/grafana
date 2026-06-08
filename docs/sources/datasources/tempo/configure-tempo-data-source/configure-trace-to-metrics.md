---
description: Configure trace to metrics to link from Tempo spans to metrics queries in Prometheus or other metrics data sources
keywords:
  - grafana
  - tempo
  - guide
  - tracing
  - metrics
  - trace to metrics
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Trace to metrics
title: Configure trace to metrics correlation
weight: 400
aliases:
  - /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#trace-to-metrics
---

# Configure trace to metrics correlation

Trace to metrics lets you navigate from a span in a trace to metrics in a Prometheus or other metrics data source.
When configured, a **Metrics for this span** link appears in the trace view.

Trace to metrics works with any Prometheus-compatible data source and doesn't require the Tempo metrics generator.
The metrics generator creates _new_ metrics from trace data; trace to metrics links to metrics that _already exist_ in your metrics data source.

{{< youtube id="TkapvLeMMpc" >}}

## Before you begin

To configure trace to metrics, you need:

- A [Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) configured in Grafana
- A Prometheus-compatible metrics data source configured in Grafana
- Metrics that correspond to your traced services (for example, `requests_total`, `request_duration_seconds`)
- Editor or Admin permissions in Grafana

{{< admonition type="note" >}}
You can't modify a provisioned data source from the Grafana UI. If you're using Grafana Cloud Traces (the pre-configured tracing data source in Grafana Cloud), its settings are read-only.
To configure trace to metrics, [clone the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/#clone-a-provisioned-data-source-for-grafana-cloud) to create an editable copy, or update the provisioning file for self-managed instances.
Refer to the [Provisioning](#provisioning) section for details.
{{< /admonition >}}

There are two ways to configure the trace to metrics feature:

- Use a basic configuration with a default query.
- Configure one or more custom queries where you can use a [template language](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/) to interpolate variables from the trace or span.

![Trace to metrics settings in the Tempo data source](/media/docs/grafana/data-sources/tempo/tempo-data-source-trace-to-metrics.png)

## Set up a basic configuration

To use a basic configuration, follow these steps:

1. Select a metrics data source from the **Data source** drop-down.
1. Optional: Change **Span start time shift** and **Span end time shift**. The placeholders show `-2m` (start) and `2m` (end), which are applied if you leave the fields empty.
1. Optional: Choose any tags to use in the query. Click **Add tag** to add a tag mapping.

   The tags you configure must be present in the spans attributes or resources for a trace to metrics span link to appear. You can optionally configure a new name for the tag. This is useful if the tag has dots in the name and the target data source doesn't allow using dots in labels. For example, you can remap `service.name` to `service_name`.

1. Don't select **Add query**.
1. Select **Save and Test**.

## Set up custom queries

To use custom queries, you need to configure the tags you'd like to include in the linked queries.
For each tag, the key is the span attribute name.
In cases where the attribute name would result in an invalid metrics query or doesn't exactly match the desired label name, you can enter the label name as the second value.
For example, you could map the attribute `k8s.pod` to the label `pod`.

You can interpolate the configured tags using the `$__tags` keyword.
For example, when you configure the query `requests_total{$__tags}` with the tags `k8s.pod=pod` and `cluster`, it results in `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.
The label values are dynamically inserted based on the span attributes' values.

You can link to any metric you'd like, but metrics for span durations, counts, and errors filtered by service or span are a great starting point.

To use custom queries with the configuration, follow these steps:

1. Select a metrics data source from the **Data source** drop-down.
1. Optional: Choose any tags to use in the query. Click **Add tag** to add a tag mapping.

   These tags can be used in the custom query with the `${__tags}` variable. This variable interpolates the mapped tags as a list in an appropriate syntax for the data source and only includes the tags that were present in the span, omitting those that weren't present. You can optionally configure a new name for the tag. This is useful in cases where the tag has dots in the name and the target data source doesn't allow using dots in labels. For example, you can remap `service.name` to `service_name`. If you don't map any tags here, you can still use any tag in the query like this: `method="${__span.tags.method}"`. Refer to [Custom query variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#custom-query-variables) for the full list of available variables.

1. Click **Add query** to add a custom query.
1. Specify a custom query to be used to query metrics data.

   Each linked query consists of:
   - **Link Label:** _(Optional)_ Descriptive label for the linked query.
   - **Query:** The query ran when navigating from a trace to the metrics data source.
     Interpolate tags using the `$__tags` keyword.
     For example, when you configure the query `requests_total{$__tags}` with the tags `k8s.pod=pod` and `cluster`, the result looks like `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.

1. Select **Save and Test**.

## Configuration options

The following table describes options for configuring the **Trace to metrics** settings:

| Setting name              | Description                                                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source**           | Defines the target data source.                                                                                                                                                                                                                                 |
| **Span start time shift** | Shifts the start time for the metrics query, based on the span's start time. You can use time units, such as `5s`, `1m`, `3h`. To extend the time to the past, use a negative value. Default: `-2m`.                                                            |
| **Span end time shift**   | Shifts the end time for the metrics query, based on the span's end time. You can use time units. Default: `2m`.                                                                                                                                                 |
| **Tags**                  | Defines the tags used in linked queries. The key sets the span attribute name, and the optional value sets the corresponding metric label name. For example, you can map `k8s.pod` to `pod`. To interpolate these tags into queries, use the `$__tags` keyword. |
| **Link Label**            | _(Optional)_ Descriptive label for the linked query.                                                                                                                                                                                                            |
| **Query**                 | Input to write a custom query. Use variable interpolation to customize it with variables from span.                                                                                                                                                             |

## Provisioning

You can provision the trace to metrics configuration using the `tracesToMetrics` block in your data source YAML file.
For the full provisioning YAML example including all Tempo settings, refer to [Provision the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/).

## Link from metrics to traces

To navigate in the reverse direction, from a metric to its associated trace, configure exemplars in your Prometheus data source. Refer to [Exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/) for setup instructions.

## Troubleshooting

If trace to metrics links aren't appearing or return no data, refer to [Trace to logs/metrics/profiles issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/troubleshooting/#trace-to-logsmetricsprofiles-issues) in the troubleshooting guide.

If the configuration fields are greyed out, your data source is provisioned. Refer to the [Provisioning](#provisioning) section for how to update the configuration via YAML.

## Next steps

- [Configure trace to logs correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/): Navigate from spans to related logs in Loki.
- [Configure trace to profiles correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-profiles/): Link spans to profiling data in Grafana Pyroscope.
- [Provision the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/): Configure the Tempo data source using a YAML file.
