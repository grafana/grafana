+++
title = "Backend plugins"
keywords = ["grafana", "plugins", "backend", "plugin", "backend-plugins", "documentation"]
type = "docs"
aliases = ["/docs/grafana/latest/plugins/developing/backend-plugins-guide/"]
+++

# Backend plugins

Grafana added support for plugins in Grafana 3.0 and this enabled the Grafana community to create panel plugins and data source plugins. It was wildly successful and has made Grafana much more useful as you can integrate it with anything and do any type of custom visualization that you want.

However, one limitation with these plugins are that they execute on the client-side (in the browser) whick makes it hard to support  certain use cases/features, e.g. enable Grafana Alerting for data sources. Grafana v7.0 adds official support for backend plugins which removes this limitation. At the same time it gives plugin developers the possibility to extend Grafana in new interesting ways, with code running in the backend (server side).

We use the term *backend plugin* to denote that a plugin has a backend component. Still, normally a backend plugin requires frontend components as well. This is for example true for backend data source plugins which normally needs configuration and query editor components implemented for the frontend.

Currently, data source plugins can be extended with a backend component. In the future we plan to support additional types and possibly new kinds of plugins, e.g. [notifiers for Grafana Alerting]({{< relref "../../../alerting/notifications.md" >}}) and custom authentication to name a few.

## Use cases for implementing a backend plugin

The following examples should give you an idea of why you would consider implementing a backend plugin:

- Enable [Grafana Alerting]({{< relref "../../../alerting/rules.md" >}}) for data sources.
- Connect to non-HTTP services that normally cannot be connected to from a web browser, e.g. SQL database servers.
- Keep state between users, e.g. query caching for data sources.
- Use custom authentication methods and/or authorization checks not supported in Grafana.
- Custom data source request proxy, see [Resources]({{< relref "#resources" >}}).

## Grafana’s backend plugin system

The Grafana backend plugin system is based on the [go-plugin library by HashiCorp](https://github.com/hashicorp/go-plugin). Grafana server launches each backend plugin as a subprocess and communicates with it over [gRPC](https://grpc.io/). This approach has a number of benefits:
- Plugins can’t crash your grafana process: a panic in a plugin doesn’t panic the server.
- Plugins are easy to develop: just write a Go application and go build (or use any other language which supports gRPC).
- Plugins can be relatively secure: The plugin only has access to the interfaces and args given to it, not to the entire memory space of the process.

Grafana's backend plugin system exposes a couple of different capabilities or building blocks that a backend plugin can implement. Currently these are query data, resources, health checks and collect metrics.

### Query data

The query data capability allows a backend plugin to handle data source queries, usually submitted from a [dashboard]({{< relref "../../../features/dashboard/dashboards.md" >}}), [Explore]({{< relref "../../../features/explore/index.md" >}}) or [Grafana Alerting]({{< relref "../../../alerting/rules.md" >}}). The response format contains [data frames]({{< relref "data-frames.md" >}}), which are suitable for visualising metrics, logs, and traces. This capability is required to implement for a backend data source plugin.

### Resources

The resources capability allows a backend plugin to handle custom HTTP requests sent to the Grafana HTTP API and respond with custom HTTP responses. Here, the request and response formats can vary, e.g. JSON, plain text, HTML or static resources (files, images) etc. Compared to the query data capability where the response contains data frames, resources gives the plugin developer a lot of flexibility for extending and open up Grafana for new interesting use cases.

Examples of use cases for implementing resources:
- Implement a custom data source proxy in case certain authentication/authorization or other requirements is required/needed that's not supported in Grafana's [built-in data proxy](https://grafana.com/docs/grafana/latest/http_api/data_source/#data-source-proxy-calls).
- Return data/information in a format suitable to use within a data source query editor to provide auto-complete functionality.
- Return static resources such as images or files.
- Send a command to a device such as a micro controller or IOT device.
- Request information from a device such as a micro controller or IOT device.
- Extend Grafana's HTTP API with custom resources, methods and actions.
- Use [chunked transfer encoding](https://en.wikipedia.org/wiki/Chunked_transfer_encoding) to return large data responses in chunks and/or enable "basic" streaming capabilities.

### Health checks

The health checks capability allows a backend plugin to return the status of the plugin. For data source backend plugins the health check will automatically be called when you do *Save & Test* in the UI when editing a data source. Health check endpoint for a plugin is exposed in the Grafana HTTP API and allows external systemss to continuously pull the health of a plugin to make sure it's running and working as expected.

### Collect metrics

The collect metrics capability allows a backend plugin to collect and return runtime, process and custom metrics using the Prometheus text-based [exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/). If you’re using the [Grafana Plugin SDK for Go]({{< relref "grafana-plugin-sdk-for-go.md" >}}) when implementing your backend plugin the [Prometheus instrumentation library for Go applications](https://github.com/prometheus/client_golang) is builtin and gives you Go runtime metrics and process metrics out of the box. By using the [Prometheus instrumentation library](https://github.com/prometheus/client_golang) you can add custom metrics to instrument your backend plugin.

A metrics endpoint (`/api/plugins/<plugin id>/metrics`) for a plugin is available in the Grafana HTTP API and allows a Prometheus instance to be configured to scrape the metrics.
