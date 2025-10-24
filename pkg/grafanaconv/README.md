# Grafana OpenTelemetry Semantic Conventions

This package gives you Go utilities for Grafana-specific OpenTelemetry semantic conventions. Use it to work with consistent attribute naming and helpers for metrics, logs and traces. For details on all available attributes and their meanings, refer to the [Grafana attribute documentation](docs/attributes/grafana.md).

## Adding new definitions

This package uses [Weaver](https://github.com/open-telemetry/weaver) to generate Go code from YAML-based semantic convention definitions. For complete syntax reference, refer to the [Weaver semantic convention syntax documentation](https://github.com/open-telemetry/weaver/blob/main/schemas/semconv-syntax.md).

### Quick start

Use dot-separated hierarchical names with the `grafana.{category}` prefix (e.g., `grafana.alerting.rule_id`)

1. **Create a category directory** (e.g., `model/alerting/`)
2. **Define attributes** in `registry.yaml`:
   ```yaml
   groups:
     - id: registry.grafana.alerting
       type: attribute_group
       display_name: Grafana Alerting Attributes
       brief: "Describes Grafana alerting attributes."
       attributes:
         - id: grafana.alerting.rule_id
           type: string
           brief: The unique identifier of the alerting rule.
           examples: ["rule-123"]
           stability: stable
   ```
3. **Define spans** in `spans.yaml` (optional):
   ```yaml
   groups:
     - id: grafana.alerting.evaluate
       type: span
       brief: "Alert rule evaluation operation"
       span_kind: internal
       stability: stable
       attributes:
         - ref: grafana.alerting.rule_id
   ```
4. **Define metrics** in `metrics.yaml` (optional):
   ```yaml
   groups:
     - id: metric.grafana.alerting.evaluation.duration
       type: metric
       brief: 'Time taken to evaluate alert rules'
       metric_name: grafana.alerting.evaluation.duration
       instrument: histogram
       unit: "ms"
       stability: stable
   ```
5. **Generate code and docs**: `make`

For detailed syntax and advanced features, refer to the [Weaver documentation](https://github.com/open-telemetry/weaver/blob/main/schemas/semconv-syntax.md).

