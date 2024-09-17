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
refs:
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  configure-grafana-feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
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
  node-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
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
---

# Span filters

When working with traces, especially those comprising a vast number of spans, pinpointing specific spans of interest can be a daunting task.
This is where span filtering comes in.
Located above the trace view, span filters allow you to refine the spans displayed based on specific criteria.
Whether you’re looking to identify spans from a certain service, those exceeding a particular duration, or spans tagged with specific attributes, span filtering streamlines the process.

Using span filters, you can filter your spans in the trace timeline viewer. The more filters you add, the more specific are the filtered spans.

![Screenshot of span filtering](/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png)

You can add one or more of the following filters:

- Service name
- Span name
- Duration
- Tags (which include tags, process tags, and log fields)

{{< youtube id="VP2XV3IIc80" >}}

## Use span filters

You can access span filters from within the trace view. You can add one or more filters.
The more filters you add, the more specific data that you are filtering.

1. Expand a trace to view individual spans.
1. Select a span to view the span details.
1. Select **Span Filters** to display the available filters.

![Locate span filters in trace view](/media/docs/grafana/data-sources/tempo-span-filters-find.gif)

Query results in the span view update as you select filters.

### Show matches only

For a more focused view, the **Show matches only** toggle ensures only the spans meeting your criteria are displayed. This is particularly useful when sifting through thousands of spans, allowing you to zero in on those that truly matter.
For instance, if you’re keen on understanding why a specific request is lagging, or if you’re on the hunt for spans without a certain tag, span filtering is your go-to tool.
It even lets you search for spans based on specific tag keys, like cluster.

### Remove a filter

To remove a filter, select the **X** next to the line item.
