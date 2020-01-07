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

Grafana supports [jaeger tracing](https://www.jaegertracing.io/).

Grafana can emit jaeger traces for its http api endpoints as well as propagate jaeger trace information to datasources. 
All HTTP endpoints are logged evenly. (annotations, dashboard, tags, etc)
When a trace ID is propagated, it is reported with operation 'HTTP /datasources/proxy/:id/*'.

Jaeger tracing is enabled in the [tracing.jaeger] section in your [grafana.ini](https://grafana.com/docs/grafana/latest/installation/configuration/#tracing-jaeger) config file.
