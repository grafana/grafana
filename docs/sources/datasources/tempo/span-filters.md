---
description: Use span filters to filter spans in the timeline viewer
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
menuTitle: Span filters
title: Span filters
weight: 600
---

# Span Filters

Using span filters, you can filter your spans in the trace timeline viewer. The more filters you add, the more specific are the filtered spans.

![Screenshot of span filtering](/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png)

You can add one or more of the following filters:

- Service name
- Span name
- Duration
- Tags (which include tags, process tags, and log fields)

To only show the spans you have matched, select the `Show matches only` toggle.

<!-- Adding these in case they are needed. -->

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
