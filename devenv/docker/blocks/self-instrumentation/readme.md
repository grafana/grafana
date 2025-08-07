# Self Instrumentation

To run this source, in the Grafana repo root:

```
make devenv sources=self-instrumentation
```

This will setup Prometheus, Loki, Tempo, and Pyroscope.

You then need to run Grafana with those added config:

```ini
[log.file]
format = json

[log.frontend]
enabled = true
custom_endpoint=http://localhost:12347/collect

[tracing.opentelemetry.otlp]
address = localhost:4317
insecure = true
```

To collect profiles with pyroscope, you need to run Grafana with the following env vars:

```bash
export GF_DIAGNOSTICS_PROFILING_ENABLED=true
export GF_DIAGNOSTICS_PROFILING_ADDR=0.0.0.0
make run
```

To enable profiling in your plugin add the following to your `custom.ini`:

```ini
[plugin.grafana-bigquery-datasource]
profiling_enabled = true
profiling_port = 6161
profiling_block_rate = 1
profiling_mutex_rate = 1
```

and the following to your `config.alloy` in the `pyroscope.scrape.targets` section:

```yaml
  {"__address__" = "host.docker.internal:6161", "service_name"="grafana-bigquery-datasource"},
```
