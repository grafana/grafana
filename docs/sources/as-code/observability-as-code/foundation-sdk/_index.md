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
weight: 200
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/foundation-sdk/
aliases:
  - ../../observability-as-code/foundation-sdk/ # /docs/grafana/next/observability-as-code/foundation-sdk/
---

# Get started with the Grafana Foundation SDK

The Grafana Foundation SDK is a set of tools, types, and libraries that let you define Grafana dashboards and resources using strongly typed code. By writing your dashboards as code, you can:

- **Leverage strong typing:** Catch errors at compile time, ensuring more reliable configurations.
- **Enhance version control:** Track changes seamlessly using standard version control systems like Git.
- **Automate deployments:** Integrate dashboard provisioning into your CI/CD pipelines for consistent and repeatable setups.

The SDK supports multiple programming languages, including Go, TypeScript, Python, PHP, and Java, so you can choose the one that best fits your development environment. Refer to the [Grafana Foundation SDK](https://github.com/grafana/grafana-foundation-sdk) GitHub repository for further details.

{{< youtube id="_OKQoABmg0Q" >}}

## Grafana Foundation SDK overview

Here's a quick overview of how the Grafana Foundation SDK works:

- **Composable builder pattern:** You can chain different builder blocks to define dashboards fluently. You start with a `DashboardBuilder`, then add panels, queries, and other components step by step.
- **Safe strong typing:** Everything in the SDK is strongly typed. This gives you autocompletion in your IDE, catches mistakes early, and helps ensure you're always using valid configuration values.
- **Configuration with structured options:** When a configuration get complex (like data reduction or display settings), the SDK uses typed option builders to keep things readable, predictable, and easy to control.

As you build more advanced dashboards, you’ll work with additional builders and types to support richer functionality.
The SDK supports not just panels and queries, but also variables, thresholds, field overrides, transformations, and more.
Refer to [the full API reference](https://grafana.github.io/grafana-foundation-sdk/) to explore what's possible.

Refer to [Foundation SDK key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/foundation-sdk/foundation-sdk-key-concepts) for a more extensive explanation, and read on to see these concepts in action.

## Before you begin

Ensure you have the following prerequisites:

- **Programming environment:** Set up for your chosen language. For example: Go, Node.js for TypeScript, or Python 3.x for Python.
- **Grafana instance:** A running Grafana instance compatible with the SDK (Grafana v10.0 or higher).
- **Package manager:** Appropriate for your language, for example, `npm` or `yarn` for TypeScript or `pip` for Python.

## Install the Grafana Foundation SDK

To install the Foundation SDK:

1. Clone the [intro-to-foundation-sdk repository](https://github.com/grafana/intro-to-foundation-sdk) to access examples and a `docker-compose` stack.
1. Select the `go` or `typescript` tab to view instructions to install the SDK. For other languages, refer to the [Grafana Foundation SDK documentation](https://grafana.github.io/grafana-foundation-sdk/) for installation instructions.

{{< code >}}

```go
go get github.com/grafana/grafana-foundation-sdk/go@latest
```

```typescript
npm install @grafana/grafana-foundation-sdk
```

{{< /code >}}

## Create a dashboard

See the following examples in Go and Typescript to create a simple dashboard:

This code defines a dashboard titled “My Dashboard” with a two panels:

- a simple stat panel displaying a version number, and
- a time series panel displaying randomized data from the `testdata` data source `random_walk` scenario.

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

## Export and use the JSON

After you've defined your dashboard as code, build the final dashboard representation using the dashboard builder, typically using the `build()` function depending on language choice, and output the result as a JSON.

With the JSON payload, you can:

- **Manually import:** Paste into Grafana’s dashboard import feature.
- **Automate:** Use the [Grafana API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/), the [Grafana CLI](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/grafana-cli/), or [Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync) to programmatically upload the dashboard JSON.

## Explore a real-world example

If you want to explore further and see a more real-world example of using the Grafana Foundation SDK, watch the following walkthrough:

{{< youtube id="ZjWdGVsrCiQ" >}}

In this video, we generate a dashboard from code and deploy it using the Grafana API, covering patterns and practices you'd use in production environments. It also includes a working example of a web service that emits metrics and logs, and shows how to deploy a dashboard alongside it using Docker Compose.

You can find the full source code for this example in the [intro-to-foundation-sdk repository](https://github.com/grafana/intro-to-foundation-sdk/tree/main/generate-and-deploy-example).

## Next steps

Now that you understand the basics of using the Grafana Foundation SDK, here are some next steps:

- **Explore more features:** Check out the [full API reference](https://grafana.github.io/grafana-foundation-sdk/) to learn about advanced dashboard configurations.
- **Version control your dashboards:** Store your dashboard code in a Git repository to track changes over time.
- **Automate dashboard provisioning with CI/CD:** [Integrate the SDK into your CI/CD pipeline](./dashboard-automation) to deploy dashboards automatically.
- **Learn about [Grafana Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync)**, which lets you synchronize your resources so you can store your dashboards as JSON files stored in GitHub and manage them as code.
