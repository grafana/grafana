---
description: Link to trace IDs from logs and metrics
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
menuTitle: Link to a trace ID
title: Link to a trace ID
weight: 700
---

# Link to a trace ID

You can link to Tempo traces from logs or metrics.

## Link to a trace ID from logs

You can link to Tempo traces from logs in Loki, Elasticsearch, Splunk, and other logs data sources by configuring an internal link.

To configure this feature, see the [Derived fields]({{< relref "../loki#configure-derived-fields" >}}) section of the Loki data source docs or the [Data links]({{< relref "../elasticsearch#data-links" >}}) section of the Elasticsearch or Splunk data source docs.

## Link to a trace ID from metrics

You can link to Tempo traces from metrics in Prometheus data sources by configuring an exemplar.

To configure this feature, see the [introduction to exemplars][exemplars] documentation.

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
