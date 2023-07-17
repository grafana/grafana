# Self Instrumentation

To run this source, in the Grafana repo root:

```
make devenv sources=self-instrumentation
```

This will setup Prometheus, Loki and Tempo.

You then need to run Grafana with those added config:

```ini
[log.frontend]
provider = grafana
custom_endpoint = http://localhost:12347/collect

[tracing.opentelemetry.jaeger]
address = http://localhost:14268/api/traces
```