This devenv docker-compose.yaml will allow you to;

- search traces
- view traces
- upload/download trace JSON files
- view service graphs
- search traces via Loki

To send traces from grafana use this configuration;

```
[tracing.opentelemetry.otlp]
# otlp destination (ex localhost:4317)
address = localhost:4317
```
