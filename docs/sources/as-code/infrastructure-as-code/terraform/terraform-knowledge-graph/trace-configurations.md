---
description: Configure trace correlation for Knowledge Graph using Terraform
menuTitle: Trace configurations
title: Configure trace correlation using Terraform
weight: 600
keywords:
  - Terraform
  - Knowledge Graph
  - Trace Configuration
  - Trace Correlation
  - Tempo
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/trace-configurations/
---

# Configure trace correlation using Terraform

Trace configurations in [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) allow you to define how trace data is queried and correlated with entities. You can specify data sources, entity matching rules, and label mappings for distributed tracing.

For information about configuring trace correlation in the Knowledge Graph UI, refer to [Configure traces correlation](/docs/grafana-cloud/knowledge-graph/configure/traces-correlation/).

## Basic trace configuration

Create a file named `trace-configs.tf` and add the following:

```terraform
# Basic trace configuration for services
resource "grafana_asserts_trace_config" "production" {
  provider = grafana.asserts

  name            = "production"
  priority        = 1000
  default_config  = false
  data_source_uid = "grafanacloud-traces"

  match {
    property = "asserts_entity_type"
    op       = "="
    values   = ["Service"]
  }

  match {
    property = "deployment_environment"
    op       = "="
    values   = ["production", "staging"]
  }

  entity_property_to_trace_label_mapping = {
    "cluster"        = "resource.k8s.cluster.name"
    "namespace"      = "resource.k8s.namespace"
    "container"      = "resource.container.name"
    "otel_service"   = "resource.service.name"
    "otel_namespace" = "resource.service.namespace"
  }
}
```

## Trace configuration with multiple match rules

Configure trace correlation with multiple entity matching criteria:

```terraform
# Development environment trace configuration
resource "grafana_asserts_trace_config" "development" {
  provider = grafana.asserts

  name            = "development"
  priority        = 2000
  default_config  = false
  data_source_uid = "tempo-dev"

  match {
    property = "asserts_entity_type"
    op       = "="
    values   = ["Service"]
  }

  match {
    property = "deployment_environment"
    op       = "="
    values   = ["development", "testing"]
  }

  match {
    property = "asserts_site"
    op       = "="
    values   = ["us-east-1"]
  }

  match {
    property = "service"
    op       = "="
    values   = ["api"]
  }

  entity_property_to_trace_label_mapping = {
    "cluster"        = "resource.k8s.cluster.name"
    "namespace"      = "resource.k8s.namespace"
    "container"      = "resource.container.name"
    "otel_service"   = "resource.service.name"
    "otel_namespace" = "resource.service.namespace"
    "pod"            = "span.k8s.pod.name"
  }
}
```

## Minimal trace configuration

Create a minimal configuration for all entities:

```terraform
# Minimal configuration for all entities
resource "grafana_asserts_trace_config" "minimal" {
  provider = grafana.asserts

  name            = "minimal"
  priority        = 3000
  default_config  = false
  data_source_uid = "tempo-minimal"

  match {
    property = "asserts_entity_type"
    op       = "IS NOT NULL"
    values   = []
  }

  entity_property_to_trace_label_mapping = {
    "cluster"        = "resource.k8s.cluster.name"
    "otel_service"   = "resource.service.name"
    "otel_namespace" = "resource.service.namespace"
  }
}
```

## Advanced trace configuration with complex match rules

Configure traces with multiple operations and advanced match rules:

```terraform
# Advanced configuration with multiple operations
resource "grafana_asserts_trace_config" "advanced" {
  provider = grafana.asserts

  name            = "advanced"
  priority        = 1500
  default_config  = false
  data_source_uid = "tempo-advanced"

  match {
    property = "service_type"
    op       = "CONTAINS"
    values   = ["web", "api"]
  }

  match {
    property = "deployment_environment"
    op       = "<>"
    values   = ["test"]
  }

  match {
    property = "team"
    op       = "IS NOT NULL"
    values   = []
  }

  match {
    property = "priority_level"
    op       = ">="
    values   = ["5"]
  }

  entity_property_to_trace_label_mapping = {
    "service_type"   = "resource.service.type"
    "team"           = "resource.team.owner"
    "environment"    = "resource.deployment.environment"
    "version"        = "resource.service.version"
    "region"         = "resource.cloud.region"
  }
}
```

## Resource reference

### `grafana_asserts_trace_config`

Manage Knowledge Graph trace configurations through the Grafana API.

#### Arguments

| Name                                     | Type           | Required | Description                                                                                    |
| ---------------------------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `name`                                   | `string`       | Yes      | The name of the trace configuration. This field is immutable and forces recreation if changed. |
| `priority`                               | `number`       | Yes      | Priority of the trace configuration. A lower number means a higher priority.                   |
| `default_config`                         | `bool`         | Yes      | Whether this is the default configuration. Default configurations cannot be deleted.           |
| `data_source_uid`                        | `string`       | Yes      | DataSource UID to be queried (for example, a Tempo instance).                                  |
| `match`                                  | `list(object)` | No       | List of match rules for entity properties. Refer to [match block](#match-block) for details.   |
| `entity_property_to_trace_label_mapping` | `map(string)`  | No       | Mapping of entity properties to trace labels for correlation.                                  |

#### Match block

Each `match` block supports the following:

| Name       | Type           | Required | Description                                                                                                                  |
| ---------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `property` | `string`       | Yes      | Entity property to match against.                                                                                            |
| `op`       | `string`       | Yes      | Operation to use for matching. One of: `=`, `<>`, `<`, `>`, `<=`, `>=`, `IS NULL`, `IS NOT NULL`, `STARTS WITH`, `CONTAINS`. |
| `values`   | `list(string)` | Yes      | Values to match against. Can be empty for `IS NULL` and `IS NOT NULL` operations.                                            |

#### Example

```terraform
resource "grafana_asserts_trace_config" "example" {
  provider = grafana.asserts

  name            = "example-traces"
  priority        = 1000
  default_config  = false
  data_source_uid = "tempo-prod"

  match {
    property = "asserts_entity_type"
    op       = "="
    values   = ["Service", "Pod"]
  }

  match {
    property = "deployment_environment"
    op       = "STARTS WITH"
    values   = ["prod"]
  }

  entity_property_to_trace_label_mapping = {
    "service"     = "resource.service.name"
    "namespace"   = "resource.k8s.namespace"
    "environment" = "resource.deployment.environment"
    "cluster"     = "resource.k8s.cluster.name"
  }
}
```

## Best practices

### Priority management

- Assign lower priority numbers to more specific configurations
- A lower priority number means higher priority (configurations are evaluated in ascending priority order)
- Use consistent priority ranges for different configuration types
- Document the reasoning behind priority assignments

### Data source configuration

- Ensure the data source UID matches your actual Tempo or trace aggregation system
- Test data source connectivity before applying configurations
- Use descriptive names for trace configurations to indicate their purpose
- Consider using separate data sources for different environments

### Label map strategy

- Map entity properties consistently across all trace configurations
- Use OpenTelemetry semantic conventions for trace label names (e.g., `resource.service.name`, `resource.k8s.namespace`)
- Document the mapping relationships in configuration comments
- Verify that mapped labels exist in your trace data

### Match rules design

- Start with broad match rules and refine based on needs
- Use specific property names that exist in your entity model
- Test match rules with sample data before deploying
- Combine multiple match rules for precise entity targeting
- Leverage comparison operators (`<`, `>`, `<=`, `>=`) for numeric or version-based filtering

### Distributed trace integration

- Ensure your traces follow OpenTelemetry semantic conventions
- Use consistent label names for resource attributes across your tracing infrastructure
- Map both service-level and infrastructure-level properties for comprehensive correlation
- Test trace correlation to verify it works as expected

## Validation

After applying the Terraform configuration, verify that:

- Trace configurations are created in your Knowledge Graph instance
- Configurations appear in the Knowledge Graph UI under **Observability > Configuration > Traces**
- Trace correlation works when drilling down from entities
- Label mappings correctly translate entity properties to trace resource attributes
- Match rules properly filter entities
- Trace queries return expected results in the Knowledge Graph UI

## Related documentation

- [Configure traces correlation in Knowledge Graph](/docs/grafana-cloud/knowledge-graph/configure/traces-correlation/)
- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Tempo documentation](/docs/tempo/latest/)
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)
