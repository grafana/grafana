---
title: Backend plugins
aliases:
  - ../../plugins/developing/backend-plugins-guide/
  - ../../plugins/backend/
keywords:
  - grafana
  - plugins
  - backend
  - plugin
  - backend-plugins
  - documentation
description: Learn about the Grafana plugin system for backend development of Grafana integrations.
---

# Backend plugins

The Grafana plugin system for backend development allows you to integrate Grafana with virtually anything and offer custom visualizations. This document explains the system's background, use cases, and key features.

## Background

Grafana added support for _frontend plugins_ in version 3.0 so that the Grafana community could create custom panels and data sources. It was wildly successful and has made Grafana much more useful for our user community.

However, one limitation of these plugins is that they run on the client side, in the browser. Therefore, they can't support use cases that require server-side features.

Since Grafana v7.0, we have supported server-side plugins that remove this limitation. We use the term _backend plugin_ to denote that a plugin has a backend component. A backend plugin usually requires frontend components as well. For example, some backend data source plugins need query editor components on the frontend.

## Use cases for implementing a backend plugin

The following examples give some common use cases for backend plugins:

- Enable [Grafana Alerting]({{< relref "../../../../alerting" >}}) for data sources.
- Connect to SQL database servers and other non-HTTP services that normally can't be connected to from a browser.
- Keep state between users, for example, by query caching for data sources.
- Use custom authentication methods and/or authorization checks that aren't supported in Grafana.
- Use a custom data source request proxy (refer to [Resources]({{< relref "#resources" >}}) for more information).

## Grafana backend plugin system

The Grafana backend plugin system is based on HashiCorp's [Go Plugin System over RPC](https://github.com/hashicorp/go-plugin). Our implementation of the Grafana server launches each backend plugin as a subprocess and communicates with it over [gRPC](https://grpc.io/).

### Benefits for plugin development

Grafana's approach has benefits for developers:

- **Stability:** Plugins can't crash your Grafana process: a panic in a plugin doesn't panic the server.
- **Ease of development:** Plugins can be written in any language that supports gRPC (for example, write a Go application and run `go build`).
- **Security:** Plugins only have access to the interfaces and arguments given to them, not to the entire memory space of the process.

### Capabilities of the backend plugin system

Grafana's backend plugin system exposes several key capabilities, or building blocks, that your backend plugin can implement:

- Query data
- Resources
- Health checks
- Collect metrics
- Streaming

#### Query data

The query data capability allows a backend plugin to handle data source queries that are submitted from a [dashboard]({{< relref "../../../../dashboards" >}}), [Explore]({{< relref "../../../../explore" >}}) or [Grafana Alerting]({{< relref "../../../../alerting" >}}). The response contains [data frames]({{< relref "../data-frames.md" >}}), which are used to visualize metrics, logs, and traces.

{{% admonition type="note" %}} Backend data source plugins are required to implement the query data capability.{{%
/admonition %}}

#### Resources

The resources capability allows a backend plugin to handle custom HTTP requests sent to the Grafana HTTP API and respond with custom HTTP responses. Here, the request and response formats can vary. For example, you can use JSON, plain text, HTML, or static resources such as images and files, and so on.

Compared to the query data capability, where the response contains data frames, the resources capability gives the plugin developer more flexibility for extending and opening up Grafana for new and interesting use cases.

### Use cases

Examples of use cases for implementing resources:

- Implement a custom data source proxy to provide certain authentication, authorization, or other requirements that are not supported in Grafana's [built-in data proxy]({{< relref "../../../http_api/data_source#data-source-proxy-calls" >}}).
- Return data or information in a format suitable for use within a data source query editor to provide auto-complete functionality.
- Return static resources such as images or files.
- Send a command to a device, such as a microcontroller or IoT device.
- Request information from a device, such as a microcontroller or IoT device.
- Extend Grafana's HTTP API with custom resources, methods and actions.
- Use [chunked transfer encoding](https://en.wikipedia.org/wiki/Chunked_transfer_encoding) to return large data responses in chunks or to enable certain streaming capabilities.

#### Health checks

The health checks capability allows a backend plugin to return the status of the plugin. For data source backend plugins, the health check is automatically called when a user edits a data source and selects _Save & Test_ in the UI.

A plugin's health check endpoint is exposed in the Grafana HTTP API and allows external systems to continuously poll the plugin's health to make sure that it's running and working as expected.

#### Collect metrics

A backend plugin can collect and return runtime, process, and custom metrics using the text-based Prometheus [exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/). If you're using the [Grafana Plugin SDK for Go]({{< relref "./grafana-plugin-sdk-for-go.md" >}}) to implement your backend plugin, then the [Prometheus instrumentation library for Go applications](https://github.com/prometheus/client_golang) is built-in. This SDK gives you Go runtime metrics and process metrics out of the box. You can use the [Prometheus instrumentation library](https://github.com/prometheus/client_golang) to add custom metrics to instrument your backend plugin.

The Grafana HTTP API offers an endpoint (`/api/plugins/<plugin id>/metrics`) that allows you to configure a Prometheus instance to scrape the metrics.

#### Streaming

The streaming capability allows a backend plugin to handle data source queries that are streaming. For more information, refer to [Build a streaming data source plugin]({{< relref "../../create-a-grafana-plugin/develop-a-plugin/build-a-streaming-data-source-plugin" >}}).
