---
description: Use the Service Graph and Service Graph view
keywords:
  - grafana
  - tempo
  - guide
  - tracing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Service Graph and Service Graph view
title: Service Graph and Service Graph view
weight: 500
refs:
  explore-trace-integration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
  variable-syntax:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
  exemplars:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  configure-grafana-feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  node-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
---

# Service Graph and Service Graph view

The Service Graph is a visual representation of the relationships between services.
Each node on the graph represents a service such as an API or database.

You use the Service Graph to detect performance issues; track increases in error, fault, or throttle rates in services; and investigate root causes by viewing corresponding traces.

{{< figure src="/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-node-graph.png" class="docs-image--no-shadow" max-width="500px" alt="Screenshot of a Node Graph" >}}

## Display the Service Graph

1. [Configure Grafana Alloy](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/grafana-alloy/) or [Tempo or GET](https://grafana.com/docs/tempo/<TEMPO_VERSION>/metrics-generator/service_graphs/#tempo) to generate Service Graph data.
1. Link a Prometheus data source in the Tempo data source's [Service Graph](../configure-tempo-data-source#configure-service-graph) settings.
1. Navigate to [Explore](ref:explore).
1. Select the Tempo data source.
1. Select the **Service Graph** query type.
1. Run the query.
1. _(Optional)_ Filter by service name.

For details, refer to [Node Graph panel](ref:node-graph).

Each circle in the graph represents a service.
To open a context menu with additional links for quick navigation to other relevant information, click a service.

Numbers inside the circles indicate the average time per request and requests per second.

Each circle's color represents the percentage of requests in each state:

| Color      | State               |
| ---------- | ------------------- |
| **Green**  | Success             |
| **Red**    | Fault               |
| **Yellow** | Errors              |
| **Purple** | Throttled responses |

## Open the Service Graph view

Service graph view displays a table of request rate, error rate, and duration metrics (RED) calculated from your incoming spans. It also includes a node graph view built from your spans.

{{< figure src="/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-service-graph.png" class="docs-image--no-shadow" max-width="500px" alt="Screenshot of the Service Graph view" >}}

For details, refer to the [Service Graph view documentation](/docs/tempo/<TEMPO_VERSION>/metrics-generator/service-graph-view/).

To open the Service Graph view:

1. Link a Prometheus data source in the Tempo data source settings.
1. Navigate to [Explore](ref:explore).
1. Select the Tempo data source.
1. Select the **Service Graph** query type.
1. Run the query.
1. _(Optional)_ Filter your results.

{{< admonition type="note" >}}
Grafana uses the `traces_spanmetrics_calls_total` metric to display the name, rate, and error rate columns, and `traces_spanmetrics_latency_bucket` to display the duration column.
These metrics must exist in your Prometheus data source.
{{< /admonition >}}

To open a query in Prometheus with the span name of that row automatically set in the query, click a row in the **rate**, **error rate**, or **duration** columns.

![Linked Prometheus data for Rate from within a service graph](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-service-graph-prom.png)

To open a query in Tempo with the span name of that row automatically set in the query, click a row in the **links** column.
