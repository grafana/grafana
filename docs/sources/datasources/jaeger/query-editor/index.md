---
description: Use the Jaeger query editor in Grafana to search traces, query by trace ID, and visualize service dependencies
keywords:
  - grafana
  - jaeger
  - query editor
  - tracing
  - search
  - trace ID
  - dependency graph
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: Jaeger query editor
weight: 200
review_date: 2026-03-03
---

# Jaeger query editor

This document explains how to use the Jaeger query editor to search for traces, query by trace ID, visualize service dependencies, and import trace files.

For general information about querying data sources in Grafana, refer to [Query and transform data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).

## Before you begin

- Ensure you have [configured the Jaeger data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/configure/).
- Verify the connection is working by clicking **Save & test** in the data source settings.

## Query types

The Jaeger query editor supports the following query types:

- **Search:** Find traces by service, operation, tags, and duration.
- **TraceID:** Query a specific trace by its ID.
- **Dependency graph:** Visualize service dependencies within a time range.
- **Import trace:** Upload a JSON trace file for visualization.

## Search for traces

To search for traces:

1. Select **Search** from the **Query type** selector.
1. Fill out the search form:

| Field              | Description                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Service Name**   | Select a service from the drop-down list, or type to filter. Supports template variables.                                              |
| **Operation Name** | Select an operation for the chosen service. Select **All** to query all operations. This field is disabled until you select a service. |
| **Tags**           | Enter tags in [`logfmt`](https://brandur.org/logfmt) format, such as `error=true db.statement="select * from User"`.                   |
| **Min Duration**   | Filter traces with a duration greater than this value. Use formats like `1.2s`, `100ms`, or `500us`.                                   |
| **Max Duration**   | Filter traces with a duration less than this value. Use the same format as **Min Duration**.                                           |
| **Limit**          | Maximum number of traces to return.                                                                                                    |

{{< figure src="/static/img/docs/explore/jaeger-search-form.png" class="docs-image--no-shadow" caption="Jaeger query editor showing a search query" >}}

## Query by trace ID

To query a specific trace:

1. Select **TraceID** from the **Query type** selector.
1. Enter the trace ID into the **Trace ID** field.
1. Press **Shift+Enter** to run the query.

{{< figure src="/static/img/docs/explore/jaeger-trace-id.png" class="docs-image--no-shadow" caption="Jaeger query editor with TraceID selected" >}}

## Visualize the dependency graph

The dependency graph query type displays service dependencies as a [Node Graph](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/). It shows how services communicate and the volume of calls between them.

To visualize the dependency graph:

1. Select **Dependency graph** from the **Query type** selector.
1. Set the dashboard time range to the period you want to analyze.
1. Run the query.

The dependency graph uses the dashboard time range to query the Jaeger `/api/dependencies` endpoint. Grafana displays the result as a Node Graph with:

- **Nodes:** Each node represents a service.
- **Edges:** Each edge represents calls between services, with the call count shown as the edge label.

{{< admonition type="note" >}}
Your Jaeger instance must have dependency data available. If the graph is empty, verify that Jaeger is collecting and processing dependency information for the selected time range.
{{< /admonition >}}

## Import a trace

You can upload a JSON file that contains a single trace and visualize it in Grafana. If the file contains multiple traces, Grafana visualizes the first trace.

To import a trace:

1. Click **Import trace** in the query editor.
1. Select a JSON file in the Jaeger trace format.

{{< figure src="/static/img/docs/explore/jaeger-upload-json.png" class="docs-image--no-shadow" caption="Jaeger data source with import trace selected" >}}

### Trace JSON example

The JSON file must follow the Jaeger trace format with a `data` array containing trace objects:

```json
{
  "data": [
    {
      "traceID": "2ee9739529395e31",
      "spans": [
        {
          "traceID": "2ee9739529395e31",
          "spanID": "2ee9739529395e31",
          "flags": 1,
          "operationName": "CAS",
          "references": [],
          "startTime": 1616095319593196,
          "duration": 1004,
          "tags": [
            {
              "key": "sampler.type",
              "type": "string",
              "value": "const"
            }
          ],
          "logs": [],
          "processID": "p1",
          "warnings": null
        }
      ],
      "processes": {
        "p1": {
          "serviceName": "loki-all",
          "tags": [
            {
              "key": "jaeger.version",
              "type": "string",
              "value": "Go-2.25.0"
            }
          ]
        }
      },
      "warnings": null
    }
  ],
  "total": 0,
  "limit": 0,
  "offset": 0,
  "errors": null
}
```

## Query data via gRPC endpoint (public preview)

Jaeger offers an alternative method for querying data that uses their gRPC service over HTTP. For detailed information about the API and setup requirements, refer to the [Jaeger API documentation](https://www.jaegertracing.io/docs/2.12/architecture/apis/#query-json-over-http).

The following queries are supported through the gRPC endpoint:

- Service search
- Operation search
- Trace ID search

To enable gRPC querying for Jaeger within Grafana, enable the `jaegerEnableGrpcEndpoint` feature flag. Grafana Cloud customers should contact support to request access and provide feedback on this feature.

## Use template variables

The Jaeger query editor supports [Grafana template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) for creating dynamic, reusable dashboards. You can use template variables in the following query fields:

- **Service Name**
- **Operation Name**
- **Trace ID**
- **Tags**
- **Min Duration**
- **Max Duration**

Use standard Grafana variable syntax such as `$variable` or `${variable}` in these fields. For example, set **Service Name** to `$service` to let dashboard users select the service from a drop-down list.
