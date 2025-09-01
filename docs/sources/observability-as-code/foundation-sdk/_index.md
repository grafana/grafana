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

The SDK supports multiple programming languages, including Go, Java, PHP, Python, and TypeScript, allowing you to choose the one that best fits your development environment.

## Before you begin

Ensure you have the following prerequisites:

- **Programming environment:** Set up for your chosen language (for example, Node.js for TypeScript, Python 3.x for Python).
- **Grafana instance:** A running Grafana instance compatible with the SDK version you’re using (refer to the [compatibility matrix](https://github.com/grafana/grafana-foundation-sdk#navigating-the-sdk)).
- **Package manager:** Appropriate for your language (for example, `npm` or `yarn` for JavaScript or TypeScript, `pip` for Python).

## Install the Grafana Foundation SDK

### TypeScript

For TypeScript, install the SDK package via `npm`:

```bash
npm install @grafana/grafana-foundation-sdk
```

Or use `yarn`:

```bash
yarn add @grafana/grafana-foundation-sdk
```

### Go

For Go, install the SDK package via `go get`:

```go
go get github.com/grafana/grafana-foundation-sdk/go@next+cog-v0.0.x
```

### Python

For Python, install the SDK using `pip`:

```bash
pip install grafana-foundation-sdk
```

For other languages, refer to the Grafana Foundation SDK documentation for detailed installation instructions.

## Create a dashboard

The following example demonstrates how you can create a simple dashboard using TypeScript:

```bash
import { DashboardBuilder, RowBuilder } from '@grafana/grafana-foundation-sdk/dashboard';
import { DataqueryBuilder } from '@grafana/grafana-foundation-sdk/prometheus';
import { PanelBuilder } from '@grafana/grafana-foundation-sdk/timeseries';
const builder = new DashboardBuilder('Sample Dashboard')
  .uid('sample-dashboard')
  .tags(['example', 'typescript'])
  .refresh('1m')
  .time({from: 'now-30m', to: 'now'})
  .timezone('browser')
  .withRow(new RowBuilder('Overview'))
  .withPanel(
    new PanelBuilder()
      .title('Network Received')
      .unit('bps')
      .min(0)
      .withTarget(
        new DataqueryBuilder()
          .expr('rate(node_network_receive_bytes_total{job="example-job", device!="lo"}[$__rate_interval]) * 8')
          .legendFormat("{{ device }}")
      )
  )
;
console.log(JSON.stringify(builder.build(), null, 2));
```

This code defines a dashboard titled “Sample Dashboard” with a single panel displaying data received on the network.

## Export and use the JSON

The `build()` method generates a JSON representation of your dashboard, which you can:

- **Manually import:** Paste into Grafana’s dashboard import feature.
- **Automate:** Use Grafana’s API to programmatically upload the dashboard JSON.

## Next steps

Now that you understand the basics of using the Grafana Foundation SDK, here are some next steps:

- **Explore more features:** Check out the [full API reference](https://grafana.github.io/grafana-foundation-sdk/) to learn about advanced dashboard configurations.
- **Version control your dashboards:** Store your dashboard code in a Git repository to track changes over time.
- **Automate dashboard provisioning with CI/CD:** Integrate the SDK into your CI/CD pipeline to deploy dashboards automatically.
