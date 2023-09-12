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
---

# Service Graph and Service Graph view

The Service Graph is a visual representation of the relationships between services.
Each node on the graph represents a service such as an API or database.

You use the Service Graph to detect performance issues; track increases in error, fault, or throttle rates in services; and investigate root causes by viewing corresponding traces.

{{< figure src="/static/img/docs/node-graph/node-graph-8-0.png" class="docs-image--no-shadow" max-width="500px" caption="Screenshot of a Node Graph" >}}

## Display the Service Graph

1. [Configure Grafana Agent](/docs/tempo/latest/grafana-agent/service-graphs/#quickstart) or [Tempo or GET](/docs/tempo/latest/metrics-generator/service_graphs/#tempo) to generate Service Graph data.
1. Link a Prometheus data source in the Tempo data source's [Service Graph]({{< relref "./configure-tempo-data-source#configure-service-graph" >}}) settings.
1. Navigate to [Explore][explore].
1. Select the Tempo data source.
1. Select the **Service Graph** query type.
1. Run the query.
1. _(Optional)_ Filter by service name.

For details, refer to [Node Graph panel][node-graph].

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

{{< figure src="/static/img/docs/tempo/apm-table.png" class="docs-image--no-shadow" max-width="500px" caption="Screenshot of the Service Graph view" >}}

For details, refer to the [Service Graph view documentation](/docs/tempo/latest/metrics-generator/service-graph-view/).

To open the Service Graph view:

1. Link a Prometheus data source in the Tempo data source settings.
1. Navigate to [Explore][explore].
1. Select the Tempo data source.
1. Select the **Service Graph** query type.
1. Run the query.
1. _(Optional)_ Filter your results.

{{% admonition type="note" %}}
Grafana uses the `traces_spanmetrics_calls_total` metric to display the name, rate, and error rate columns, and `traces_spanmetrics_latency_bucket` to display the duration column.
These metrics must exist in your Prometheus data source.
{{% /admonition %}}

To open a query in Prometheus with the span name of that row automatically set in the query, click a row in the **rate**, **error rate**, or **duration** columns.

To open a query in Tempo with the span name of that row automatically set in the query, click a row in the **links** column.

{{% docs/reference %}}
[build-dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards"
[build-dashboards]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards"

[configure-grafana-feature-toggles]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#feature_toggles"
[configure-grafana-feature-toggles]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#feature_toggles"

[data-source-management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[data-source-management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[exemplars]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/fundamentals/exemplars"
[exemplars]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/fundamentals/exemplars"

[explore-trace-integration]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/explore/trace-integration"
[explore-trace-integration]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/explore/trace-integration"

[explore]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/explore"
[explore]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/explore"

[node-graph]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/node-graph"
[node-graph]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/node-graph"

[provisioning-data-sources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning#data-sources"
[provisioning-data-sources]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning#data-sources"

[variable-syntax]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/variable-syntax"
[variable-syntax]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/variable-syntax"
{{% /docs/reference %}}
