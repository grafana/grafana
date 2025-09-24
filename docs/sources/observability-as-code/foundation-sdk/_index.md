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
title: Foundation SDK
weight: 250
---

# Get started with the Grafana Foundation SDK

The [Grafana Foundation SDK](https://github.com/grafana/grafana-foundation-sdk) is a set of tools, types, and libraries that let you define Grafana dashboards and resources using strongly typed code. By writing your dashboards as code, you can:

- **Leverage strong typing:** Catch errors at compile time, ensuring more reliable configurations.
- **Enhance version control:** Track changes seamlessly using standard version control systems like Git.
- **Automate deployments:** Integrate dashboard provisioning into your CI/CD pipelines for consistent and repeatable setups.

The SDK supports multiple programming languages, including Go, TypeScript, Python, PHP, and Java, so you can choose the one that best fits your development environment.

{{< youtube id="_OKQoABmg0Q" >}}

## Before you begin

Ensure you have the following prerequisites:

- **Programming environment:** Set up for your chosen language. For example: Go, Node.js for TypeScript, or Python 3.x for Python.
- **Grafana instance:** A running Grafana instance compatible with the SDK version you’re using (refer to the [compatibility matrix](https://github.com/grafana/grafana-foundation-sdk#navigating-the-sdk)).
- **Package manager:** Appropriate for your language, for example, `npm` or `yarn` for TypeScript or `pip` for Python.

To get started, clone the [intro-to-foundation-sdk repository](https://github.com/grafana/intro-to-foundation-sdk) to access examples and a `docker-compose` stack.

## Install the Grafana Foundation SDK

Select the `go` or `typescript` tab to view instructions to install the SDK.
For other languages, refer to the Grafana Foundation SDK documentation for installation instructions.
{{< code >}}

```go
go get github.com/grafana/grafana-foundation-sdk/go@next+cog-v0.0.x
```

```typescript
npm install @grafana/grafana-foundation-sdk
```

{{< /code >}}

## Grafana Foundation SDK Overview

Here's a quick overview of how the Grafana Foundation SDK works:

- **Builder pattern:** The SDK uses a chainable builder pattern to let you define dashboards fluently. You start with a `DashboardBuilder`, then add panels, queries, and other components step by step.
- **Strong typing:** Everything in the SDK is strongly typed. This gives you autocompletion in your IDE, catches mistakes early, and helps ensure you're always using valid configuration values.
- **Structured options:** When a configuration get complex (like data reduction or display settings), the SDK uses typed option builders to keep things readable and predictable.

You'll see these concepts in action in the next example. These concepts are explained in more detail afterwards.

## Create a dashboard

The following example demonstrates how you can create a simple dashboard:

{{< code >}}

```go
package main

// Import the appropriate Grafana Foundation SDK packages
import (
  "encoding/json"
  "log"

  "github.com/grafana/grafana-foundation-sdk/go/cog"
  "github.com/grafana/grafana-foundation-sdk/go/common"
  "github.com/grafana/grafana-foundation-sdk/go/dashboard"
  "github.com/grafana/grafana-foundation-sdk/go/stat"
  "github.com/grafana/grafana-foundation-sdk/go/testdata"
  "github.com/grafana/grafana-foundation-sdk/go/timeseries"
)

func main() {
  // Define a data source reference for our testdata data source
  testdataRef := dashboard.DataSourceRef{
    Type: cog.ToPtr("grafana-testdata-datasource"),
    Uid:  cog.ToPtr("testdata"),
  }

  // Define our dashboard as strongly typed code
  builder := dashboard.NewDashboardBuilder("My Dashboard").
    WithPanel(
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
        ),
    ).
    WithPanel(
      timeseries.NewPanelBuilder().
        Title("Random Time Series").
        Datasource(testdataRef).
        WithTarget(
          testdata.NewDataqueryBuilder().
            ScenarioId("random_walk"),
        ),
    )

  // Build the dashboard - errors in configuration will be thrown here
  dashboard, err := builder.Build()
  if err != nil {
    log.Fatalf("failed to build dashboard: %v", err)
  }

  // Output the generated dashboard as JSON
  dashboardJson, err := json.MarshalIndent(dashboard, "", "  ")
  if err != nil {
    log.Fatalf("failed to marshal dashboard: %v", err)
  }

  log.Printf("Dashboard JSON:\n%s", dashboardJson)
}
```

```typescript
// Import the appropriate Grafana Foundation SDK packages
import * as common from '@grafana/grafana-foundation-sdk/common';
import * as dashboard from '@grafana/grafana-foundation-sdk/dashboard';
import * as stat from '@grafana/grafana-foundation-sdk/stat';
import * as testdata from '@grafana/grafana-foundation-sdk/testdata';
import * as timeseries from '@grafana/grafana-foundation-sdk/timeseries';

// Define a data source reference for our testdata data source
const testDataRef: dashboard.DataSourceRef = {
  type: 'grafana-testdata-datasource',
  uid: 'testdata',
};

// Define our dashboard as strongly typed code
const builder = new dashboard.DashboardBuilder('My Dashboard')
  .withPanel(
    new stat.PanelBuilder()
      .title('Version')
      .reduceOptions(new common.ReduceDataOptionsBuilder().calcs(['lastNotNull']).fields('/.*/'))
      .datasource(testdataRef)
      .withTarget(new testdata.DataqueryBuilder().scenarioId('csv_content').csvContent('version\nv1.2.3'))
  )
  .withPanel(
    new timeseries.PanelBuilder()
      .title('Random Time Series')
      .datasource(testdataRef)
      .withTarget(new testdata.DataqueryBuilder().scenarioId('random_walk'))
  );

// Build the dashboard - errors in configuration will be thrown here
const dashboard = builder.build();

// Output the generated dashboard as JSON
console.log(JSON.stringify(dashboard, null, 2));
```

{{< /code >}}

This code defines a dashboard titled “My Dashboard” with a two panels:

- a simple stat panel displaying a version number, and
- a time series panel displaying randomized data from the `testdata` data source `random_walk` scenario.

## Export and use the JSON

After you've defined your dashboard as code, build the final dashboard representation using the dashboard builder (typically using the `build()` function depending on language choice) and output the result as a JSON.

With the JSON payload, you can:

- **Manually import:** Paste into Grafana’s dashboard import feature.
- **Automate:** Use [Grafana’s API](../../developers/http_api/) or the [Grafana CLI](../grafana-cli/) to programmatically upload the dashboard JSON.

## Concepts

Now that you've seen how to define a basic dashboard using code, let's take a moment to explain how it all works behind the scenes. The Grafana Foundation SDK is built around a few core concepts that make your dashboards structured, reusable, and strongly typed.

### Builders

The SDK follows a builder pattern, which lets you compose dashboards step-by-step using chained method calls.
Almost every piece of the dashboard, including dashboards, panels, rows, queries, and variables, has its own `Builder` class.

Here are a few you've already seen:

- `DashboardBuilder` - Starts the dashboard definition and sets global configuration settings like title, UID, refresh interval, time range, etc.
- `PanelBuilder` - Creates individual visualizations like time series panels, stat panels, or log panels.
- `DataqueryBuilder` - Defines how a panel fetches data, for example, from Prometheus or the `testdata` plugin.

Builders are chainable, so you can fluently compose dashboards in a readable, structured way:

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

### Types

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

### Options

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

## Explore a real-world example

If you want to explore further and see a more real-world example of using the Grafana Foundation SDK, watch the following walkthrough:

{{< youtube id="ZjWdGVsrCiQ" >}}

In this video, we generate a dashboard from code and deploy it using the Grafana API, covering patterns and practices you'd use in production environments. It also includes a working example of a web service that emits metrics and logs, and shows how to deploy a dashboard alongside it using Docker Compose.

You can find the full source code for this example in the [intro-to-foundation-sdk repository](https://github.com/grafana/intro-to-foundation-sdk/tree/main/generate-and-deploy-example).

## Summary

The Grafana Foundation SDK is designed to make dashboard creation:

- **Composable** through the use of chainable builders
- **Safe** with strong typing and clear APIs
- **Configurable** using structured options for fine control

As you build more advanced dashboards, you’ll work with additional builders and types to support richer functionality.
The SDK supports not just panels and queries, but also variables, thresholds, field overrides, transformations, and more.
Refer to [the full API reference](https://grafana.github.io/grafana-foundation-sdk/) to explore what's possible.

## Next steps

Now that you understand the basics of using the Grafana Foundation SDK, here are some next steps:

- **Explore more features:** Check out the [full API reference](https://grafana.github.io/grafana-foundation-sdk/) to learn about advanced dashboard configurations.
- **Version control your dashboards:** Store your dashboard code in a Git repository to track changes over time.
- **Automate dashboard provisioning with CI/CD:** [Integrate the SDK into your CI/CD pipeline](./dashboard-automation) to deploy dashboards automatically.
