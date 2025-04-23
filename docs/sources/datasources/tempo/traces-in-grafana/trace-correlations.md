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

- Grafana 12 or later
- A Tempo tracing data source configured in Grafana
- Admin access to configuration settings or provisioning files in Grafana

## Set up a trace correlation

1. Log in to Grafana with an admin account.

1. Go to **Configuration** → **Plugins & data** → **Correlations**.

1. Select **Add new**.

1. On step 1, provide a **label** for the correlation, and an optional **description**.

1. On step 2, configure the correlation **target**.

   - Select the target type: **query** to link to another data source, or **external** for a custom URL.

   - For a query target, select the **target data source** and define the target query.

   - For an external target, enter the **external URL**.

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

1. On step 3, configure the correlation **data source**:

   - Select your Tempo data source as **source**.

   - Enter the trace data variable you use for the correlation in the **Result field**.

   - Optionally, add one or more **transformations** to parse the trace data into additional variables. You can use these variables to configure the correlation **target**.

   {{< figure src="/media/docs/tempo/screenshot-grafana-trace-correlations-loki-step-3.png" max-width="900px" class="docs-image--no-shadow" alt="Setting up a correlation for a Loki data source" >}}

1. Select **Save** to save the correlation.

The correlation link will now show when viewing a trace span, both in the span links menu and the span details.

{{< figure src="/media/docs/tempo/screenshot-trace-view-correlations.png" max-width="900px" class="docs-image--no-shadow" alt="Using correlations for a trace" >}}
