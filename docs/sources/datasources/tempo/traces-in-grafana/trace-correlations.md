---
description: Use Grafana correlations with Tempo traces
keywords:
  - grafana
  - tempo
  - guide
  - tracing
  - correlations
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Trace correlations
title: Trace correlations
weight: 1000
---

# Trace correlations

You can use Grafana [correlations](/docs/grafana/<GRAFANA_VERSION>/administration/correlations/) to embed interactive correlation links in your trace view to jump from spans to related logs, metrics, profiles, or external systems. This guide explains how to configure and manage Trace correlations in Grafana.

## What are trace correlations?

Trace correlations let you define rules that inject context-sensitive links into your trace spans. When viewing traces in Explore or the Traces panel, users can click these links to navigate directly to relevant queries or URLs. Correlations are similar but more flexible to the [trace to logs, metrics, and profiles links you can configure for the Tempo data source](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source).

{{< figure src="/media/docs/tempo/screenshot-trace-view-correlations.png" max-width="900px" class="docs-image--no-shadow" alt="Using correlations for a trace" >}}

## Before you begin

To use trace correlations, you need:

- Grafana 12 or later
- A [Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) configured in Grafana
- Admin access to configuration settings or provisioning files in Grafana

## Set up a trace correlation

1. Log in to Grafana with an admin account.

1. Go to **Configuration** > **Plugins & data** > **Correlations**.

1. Select **Add correlation** or **Add new**.

1. On step 1, provide a **label** for the correlation, and an optional **description**.

1. On step 2, configure the correlation **target**.

   - Select the **Type** drop-down list and choose **Query** to link to another data source or choose **External** for a custom URL.

   - For a query **Target**, select the target drop-down list and select the data source that should be queried when the link is clicked. Define the target query.

   - For an external **Target**, enter the **External URL**.

   - For both query and external targets, you can use the following variables based on trace data. Object variables must be parsed into a value variable with a regular expression transformation.

   | Variable       | Type   | Description            |
   | -------------- | ------ | ---------------------- |
   | `traceId`      | String | Trace identifier       |
   | `spanID`       | String | Span identifier        |
   | `parentSpanID` | String | Parent span identifier |
   | `serviceName`  | String | Service name           |
   | `serviceTags`  | Object | Resource attributes    |
   | `tags`         | Object | Span attributes        |
   | `logs`         | Object | Trace events           |
   | `references`   | Object | Trace links            |

   {{< figure src="/media/docs/tempo/screenshot-grafana-trace-correlations-loki-step-2.png" max-width="900px" class="docs-image--no-shadow" alt="Setting up a correlation for a Loki target using trace variables" >}}

1. On step 3, configure the correlation data source:

   - Select your Tempo data source in the **Source** drop-down list.

   - Enter the trace data variable you use for the correlation in the **Results field**.

   - Optionally, add one or more **Transformations** to parse the trace data into additional variables. You can use these variables to configure the correlation **Target**.

   {{< figure src="/media/docs/tempo/screenshot-grafana-trace-correlations-loki-step-3.png" max-width="900px" class="docs-image--no-shadow" alt="Setting up a correlation for a Loki data source" >}}

1. Select **Save** to save the correlation.

## Verifying correlations in Explore

1. Open **Explore** and select your Tempo tracing source.

1. Run a query to load spans.

1. Hover over the span links menu or open the span details to reveal the correlation link buttons.

   {{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-correlations.png" max-width="900px" class="docs-image--no-shadow" alt="Using correlations for a trace" >}}

1. Click a correlation link to open a split view or navigate to your target system or query.

## Examples

Below are several practical correlation configurations to get you started.

### Example 1: Trace to logs by service name and trace identifier

In this example, you configure trace to logs by service name and a trace identifier.

1. On step 1, add a new correlation with the label **Logs for this service and trace** and an optional description.

   {{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-correlations-example-1-step-1.png" max-width="900px" class="docs-image--no-shadow" alt="Using correlations for a trace" >}}

1. On step 2, configure the correlation target:

   - Select the target type **Query** and select your Loki data source as **Target**.

   - Define the Loki query, using `serviceName` and `traceID` as variables derived from the span data:

     ```
     {service_name="$serviceName"} | trace_id=`$traceID` |= ``
     ```

     {{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-correlations-example-1-step-2.png" max-width="900px" class="docs-image--no-shadow" alt="Using correlations for a trace" >}}

1. On step 3, configure the correlation source:

   - Select your Tempo data source as **Source**.

   - Use `traceID` as **Results field**.

   - Add a new transformation to extract the `serviceName` from the span `serviceTags` using the regular expression:

     ```
     {(?=[^\}]*\bkey":"service.name")[^\}]*\bvalue":"(.*?)".*}
     ```

   {{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-correlations-example-1-step-3.png" max-width="900px" class="docs-image--no-shadow" alt="Using correlations for a trace" >}}

1. Save the correlation.

### Example 2: Trace to custom URL

In this example, you configure trace corrections with a custom URL.

1. On step 1, add a new correlation with the label **Open custom URL** and an optional description.

1. On step 2, configure the correlation target:

   - Select the target type **External**.

   - Define your target URL, using variables derived from the span data. In this example, we are using `serviceName` and `traceID`.

     ```
     https://my-server.example.com/service=$serviceName&trace=$traceID
     ```

1. On step 3, configure the correlation source:

   - Select your Tempo data source as **Source**.

   - Use `traceID` as **Results field**.

   - Add a new transformation to extract the `serviceName` from the span `serviceTags` using the regular expression:

     ```
     {(?=[^\}]*\bkey":"service.name")[^\}]*\bvalue":"(.*?)".*}
     ```

1. Save the correlation.

## Best practices

- **Name clearly:** Use descriptive names indicating source and target. For example: **Trace to errors in logs**.

- **Limit scope**: For high-cardinality fields (like `traceID`), ensure your target system can handle frequent queries.

- **Template wisely:** Use multiple `$variable` tokens if you need to inject more than one field.
