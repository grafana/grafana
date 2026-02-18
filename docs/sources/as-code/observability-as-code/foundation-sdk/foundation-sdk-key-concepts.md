---
description: Learn about the Foundation SDK, a set of tools, types, and libraries for defining Grafana dashboards and resources.
keywords:
  - as code
  - as-code
  - Foundation SDK
labels:
  products:
    - enterprise
    - oss
title: Foundation SDK key concepts
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/foundation-sdk/foundation-sdk-key-concepts/
---

# Foundation SDK key concepts

The Grafana Foundation SDK is built around a few core concepts that make your dashboards structured, reusable, and strongly typed.

## Builders

The SDK follows a builder pattern, which lets you compose dashboards step-by-step using chained method calls.
Almost every piece of the dashboard, including dashboards, panels, rows, queries, and variables, has its own `Builder` class.

Here are a few you've already seen:

- `DashboardBuilder` - Starts the dashboard definition and sets global configuration settings like title, UID, refresh interval, time range, etc.
- `PanelBuilder` - Creates individual visualizations like time series panels, stat panels, or log panels.
- `DataqueryBuilder` - Defines how a panel fetches data, for example, from Prometheus or the `testdata` plugin.

Builders can be chained, so you can fluently compose dashboards in a readable, structured way:

{{< code >}}

```go
stat.NewPanelBuilder().
  Title("Version").
  Datasource(testdataRef).
  ReduceOptions(common.NewReduceDataOptionsBuilder().
    Calcs([]string{"lastNotNull"}).
    Fields("/.*/")).
  WithTarget(
    testdata.NewDataqueryBuilder().
      ScenarioId("csv_content").
      CsvContent("version\nv1.2.3"),
  )
```

```typescript
new stat.PanelBuilder()
  .title('Version')
  .reduceOptions(new common.ReduceDataOptionsBuilder().calcs(['lastNotNull']).fields('/.*/'))
  .datasource(testdataRef)
  .withTarget(new testdata.DataqueryBuilder().scenarioId('csv_content').csvContent('version\nv1.2.3'));
```

{{< /code >}}

## Types

The Grafana Foundation SDK uses strong types under the hood to help catch mistakes before you deploy a broken dashboard.

For example:

- When setting a unit, you'll get autocomplete suggestions for valid Grafana units like `"percent"` or `"bps"`.
- When defining a time range, you'll be guided to provide the correct structure, like `from` and `to` values.
- When referencing data sources, you'll use a structured `DataSourceRef` object with defined `type` and `uid` fields.

This helps you:

- Avoid typos or unsupported configuration values
- Get full autocomplete and inline documentation in your IDE
- Write dashboards that are less error-prone and easier to maintain

Strong typing also makes it easier to build reusable patterns and components with confidence, especially in large codebases or teams.

## Options

Most builder methods accept simple values like strings or numbers, but others expect more structured option objects. These are used for things like:

- `ReduceDataOptions` - How to reduce time series data into single values (e.g. last, avg).
- `VizLegendOptions` - Configure how the legend of a panel is displayed.
- `CanvasElementOptions` - Define how the the various components of a Canvas panel should be displayed.

Example using options:

{{< code >}}

```go
stat.NewPanelBuilder().
  ReduceOptions(common.NewReduceDataOptionsBuilder().
    Calcs([]string{"lastNotNull"}).
    Fields("/.*/"))
  )
```

```typescript
new stat.PanelBuilder().reduceOptions(new common.ReduceDataOptionsBuilder().calcs(['lastNotNull']).fields('/.*/'));
```

{{< /code >}}

By using option builders, you don't need to manually construct deeply nested configuration objects. Instead, the SDK gives you a typed and guided API that mirrors a dashboards internal structure, making it easier to configure complex options without guesswork or referring back to the JSON schema.
