+++
title = "Jaeger instrumentation"
description = "Jaeger traces emitted and propagation by Grafana"
keywords = ["grafana", "jaeger", "tracing"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 9
+++

# Jaeger instrumentation

Grafana supports [Jaeger tracing](https://www.jaegertracing.io/).

Grafana can emit Jaeger traces for its HTTP API endpoints and propagate Jaeger trace information to data sources.
All HTTP endpoints are logged evenly (annotations, dashboard, tags, and so on).
When a trace ID is propagated, it is reported with operation 'HTTP /datasources/proxy/:id/*'.

Refer to [Configuration]({{< relref "configuration.md#tracing-jaeger" >}}) for information about enabling Jaeger tracing.
