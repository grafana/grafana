---
aliases:
  - ../../data-sources/zipkin/query-editor/
description: Guide for using the Zipkin query editor in Grafana
keywords:
  - grafana
  - zipkin
  - tracing
  - query editor
  - traces
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: Zipkin query editor
weight: 200
review_date: 2026-04-08
---

# Zipkin query editor

This document explains how to use the Zipkin query editor to query and visualize traces. You can look up traces by ID, browse available traces using the cascading service and span selector, or upload a JSON trace file for visualization.

For general documentation on querying data sources in Grafana, refer to [Query and transform data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).

## Query by trace ID

To query a specific trace by its ID:

1. Select the **TraceID** query type.
1. Enter the trace ID into the **Trace ID** field.
1. Press **Shift+Enter** to run the query.

You can also use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/template-variables/) in the trace ID field. For example, `${traceId}` is replaced with the variable's current value when the query runs.

## Query by trace selector

You can browse and select traces using the **Traces** cascading selector instead of entering a trace ID manually.

The trace selector has three levels:

1. **Service:** Select the service you're interested in.
1. **Span:** Select a specific operation within the selected service.
1. **Trace:** Select a specific trace in which the selected operation occurred, represented by the root operation name and trace duration.

When you select a trace at the third level, the trace ID is automatically populated and the query runs.

## Upload a JSON trace file

You can upload a JSON file that contains a single trace and visualize it. If the file has multiple traces, Grafana visualizes the first trace.

To upload a trace file:

1. Click **Import trace**.
1. Drag and drop a JSON file or click to browse for a file.

### Trace JSON example

```json
[
  {
    "traceId": "efe9cb8857f68c8f",
    "parentId": "efe9cb8857f68c8f",
    "id": "8608dc6ce5cafe8e",
    "kind": "SERVER",
    "name": "get /api",
    "timestamp": 1627975249601797,
    "duration": 23457,
    "localEndpoint": { "serviceName": "backend", "ipv4": "127.0.0.1", "port": 9000 },
    "tags": {
      "http.method": "GET",
      "http.path": "/api",
      "jaxrs.resource.class": "Resource",
      "jaxrs.resource.method": "printDate"
    },
    "shared": true
  }
]
```

## View data mapping in the trace UI

Zipkin annotations appear in the trace view as logs with the annotation value displayed under the annotation key.

## Span filters

![Screenshot of span filtering](/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png)

Using span filters, you can filter spans in the trace timeline viewer. The more filters you add, the more specific the filtered spans are.

You can add one or more of the following filters:

- Service name
- Span name
- Duration
- Tags (which include tags, process tags, and log fields)

To only show the spans you have matched, toggle on **Show matches only**.

## Link to a trace ID from logs

You can link to Zipkin traces from logs in Loki, Elasticsearch, Splunk, and other logs data sources by configuring an internal link.

To configure this feature, refer to the [Derived fields](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure-loki-data-source/#derived-fields) section of the Loki data source docs or the [Data links](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/configure/#data-links) section of the Elasticsearch or Splunk data source docs.

## Link to a trace ID from metrics

You can link to Zipkin traces from metrics in Prometheus data sources by configuring an exemplar.

To configure this feature, refer to the [introduction to exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/) documentation.
