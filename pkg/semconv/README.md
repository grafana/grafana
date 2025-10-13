# Grafana OpenTelemetry Semantic Conventions

<!-- toc -->

- [Adding new attributes](#adding-new-attributes)
- [Attribute Groups](#attribute-groups)
  - [grafana.datasource](#grafanadatasource)
    - [grafana.datasource.request](#grafanadatasourcerequest)
- [k8s](#k8s)
  - [grafana.plugin](#grafanaplugin)

<!-- tocstop -->

## Adding new attributes

1. Add a new attribute to a new or existing attribute group in [model/registry](./model/registry).
1. Add a reference to the new attribute in a new or existing attribute group in [model/trace](./model/trace).
1. If you are adding a new attribute group, add a new `semconv` HTML comment tag to the README.md file with the name of the new attribute group.
1. Run `make all` to update the generated files.

For more information:
- [Semantic Convention generator + Docker](https://github.com/open-telemetry/build-tools/blob/main/semantic-conventions/README.md)
- [OpenTelemetry Semantic Conventions](https://github.com/open-telemetry/semantic-conventions/tree/main/model) (these can be used as a reference)

## Attribute Groups

### grafana.datasource

<!-- semconv trace.grafana.datasource -->
| Attribute  | Type | Description  | Examples  | [Requirement Level](https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/) | Stability |
|---|---|---|---|---|---|
| `grafana.datasource.type` | string | The datasource type. | `prometheus`; `loki`; `grafana-github-datasource` | `Recommended` | ![Stable](https://img.shields.io/badge/-stable-lightgreen) |
| `grafana.datasource.uid` | string | The datasource unique identifier. | `abcdefg-123456` | `Recommended` | ![Stable](https://img.shields.io/badge/-stable-lightgreen) |
<!-- endsemconv -->

#### grafana.datasource.request

<!-- semconv trace.grafana.datasource.request -->
| Attribute  | Type | Description  | Examples  | [Requirement Level](https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/) | Stability |
|---|---|---|---|---|---|
| `grafana.datasource.request.query_count` | int | The number of queries in the request. | `3` | `Recommended` | ![Stable](https://img.shields.io/badge/-stable-lightgreen) |
<!-- endsemconv -->

## k8s

<!-- semconv trace.k8s -->
| Attribute  | Type | Description  | Examples  | [Requirement Level](https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/) | Stability |
|---|---|---|---|---|---|
| `k8s.dataplaneservice.name` | string | The name of the DataPlaneService. | `v0alpha1.prometheus.grafana.app` | `Recommended` | ![Stable](https://img.shields.io/badge/-stable-lightgreen) |
<!-- endsemconv -->

### grafana.plugin

<!-- semconv trace.grafana.plugin -->
| Attribute  | Type | Description  | Examples  | [Requirement Level](https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/) | Stability |
|---|---|---|---|---|---|
| `grafana.plugin.id` | string | The plugin ID. | `prometheus`; `loki`; `grafana-github-datasource` | `Recommended` | ![Stable](https://img.shields.io/badge/-stable-lightgreen) |
| `grafana.plugin.type` | string | The plugin type. | `datasource` | `Recommended` | ![Stable](https://img.shields.io/badge/-stable-lightgreen) |
<!-- endsemconv -->

