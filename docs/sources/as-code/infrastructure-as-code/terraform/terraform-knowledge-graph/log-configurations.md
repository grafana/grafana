---
description: Configure log correlation for Knowledge Graph using Terraform
menuTitle: Log configurations
title: Configure log correlation using Terraform
weight: 500
keywords:
  - Terraform
  - Knowledge Graph
  - Log Configuration
  - Log Correlation
  - Loki
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/log-configurations/
---

# Configure log correlation using Terraform

Log configurations in [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) allow you to define how log data is queried and correlated with entities. You can specify data sources, entity matching rules, label mappings, and filtering options for spans and traces.

For information about configuring log correlation in the Knowledge Graph UI, refer to [Configure logs correlation](/docs/grafana-cloud/knowledge-graph/configure/logs-correlation/).

## Basic log configuration

Create a file named `log-configs.tf` and add the following:

```terraform
# Basic log configuration for services
resource "grafana_asserts_log_config" "production" {
  provider = grafana.asserts

  name            = "production"
  priority        = 1000
  default_config  = false
  data_source_uid = "grafanacloud-logs"
  error_label     = "error"

  match {
    property = "asserts_entity_type"
    op       = "EQUALS"
    values   = ["Service"]
  }

  match {
    property = "environment"
    op       = "EQUALS"
    values   = ["production", "staging"]
  }

  entity_property_to_log_label_mapping = {
    "otel_namespace" = "service_namespace"
    "otel_service"   = "service_name"
    "environment"    = "env"
    "site"           = "region"
  }

  filter_by_span_id  = true
  filter_by_trace_id = true
}
```

## Log configuration with multiple match rules

Configure log correlation with multiple entity matching criteria:

```terraform
# Development environment log configuration
resource "grafana_asserts_log_config" "development" {
  provider = grafana.asserts

  name            = "development"
  priority        = 2000
  default_config  = true
  data_source_uid = "elasticsearch-dev"
  error_label     = "error"

  match {
    property = "asserts_entity_type"
    op       = "EQUALS"
    values   = ["Service"]
  }

  match {
    property = "environment"
    op       = "EQUALS"
    values   = ["development", "testing"]
  }

  match {
    property = "site"
    op       = "EQUALS"
    values   = ["us-east-1"]
  }

  match {
    property = "service"
    op       = "EQUALS"
    values   = ["api"]
  }

  entity_property_to_log_label_mapping = {
    "otel_namespace" = "service_namespace"
    "otel_service"   = "service_name"
    "environment"    = "env"
    "site"           = "region"
    "service"        = "app"
  }

  filter_by_span_id  = true
  filter_by_trace_id = true
}
```

## Minimal log configuration

Create a minimal configuration for all entities:

```terraform
# Minimal configuration for all entities
resource "grafana_asserts_log_config" "minimal" {
  provider = grafana.asserts

  name            = "minimal"
  priority        = 3000
  default_config  = false
  data_source_uid = "loki-minimal"

  match {
    property = "asserts_entity_type"
    op       = "IS_NOT_NULL"
    values   = []
  }
}
```

## Advanced log configuration with complex match rules

Configure logs with multiple operations and advanced match rules:

```terraform
# Advanced configuration with multiple operations
resource "grafana_asserts_log_config" "advanced" {
  provider = grafana.asserts

  name            = "advanced"
  priority        = 1500
  default_config  = false
  data_source_uid = "loki-advanced"
  error_label     = "level"

  match {
    property = "service_type"
    op       = "CONTAINS"
    values   = ["web", "api"]
  }

  match {
    property = "environment"
    op       = "NOT_EQUALS"
    values   = ["test"]
  }

  match {
    property = "team"
    op       = "IS_NOT_NULL"
    values   = []
  }

  entity_property_to_log_label_mapping = {
    "service_type"   = "type"
    "team"           = "owner"
    "environment"    = "env"
    "version"        = "app_version"
  }

  filter_by_span_id  = true
  filter_by_trace_id = false
}
```

## Resource reference

### `grafana_asserts_log_config`

Manage Knowledge Graph log configurations through the Grafana API.

#### Arguments

| Name                                   | Type           | Required | Description                                                                                  |
| -------------------------------------- | -------------- | -------- | -------------------------------------------------------------------------------------------- |
| `name`                                 | `string`       | Yes      | The name of the log configuration. This field is immutable and forces recreation if changed. |
| `priority`                             | `number`       | Yes      | Priority of the log configuration. Higher priority configurations are evaluated first.       |
| `default_config`                       | `bool`         | Yes      | Whether this is the default configuration. Default configurations cannot be deleted.         |
| `data_source_uid`                      | `string`       | Yes      | DataSource UID to be queried (for example, a Loki instance).                                 |
| `match`                                | `list(object)` | No       | List of match rules for entity properties. Refer to [match block](#match-block) for details. |
| `error_label`                          | `string`       | No       | Label name used to identify error logs.                                                      |
| `entity_property_to_log_label_mapping` | `map(string)`  | No       | Mapping of entity properties to log labels for correlation.                                  |
| `filter_by_span_id`                    | `bool`         | No       | Whether to filter logs by span ID for distributed tracing correlation.                       |
| `filter_by_trace_id`                   | `bool`         | No       | Whether to filter logs by trace ID for distributed tracing correlation.                      |

#### Match block

Each `match` block supports the following:

| Name       | Type           | Required | Description                                                                                                              |
| ---------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `property` | `string`       | Yes      | Entity property to match against.                                                                                        |
| `op`       | `string`       | Yes      | Operation to use for matching. One of: `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `DOES_NOT_CONTAIN`, `IS_NULL`, `IS_NOT_NULL`. |
| `values`   | `list(string)` | Yes      | Values to match against. Can be empty for `IS_NULL` and `IS_NOT_NULL` operations.                                        |

#### Example

```terraform
resource "grafana_asserts_log_config" "example" {
  provider = grafana.asserts

  name            = "example-logs"
  priority        = 1000
  default_config  = false
  data_source_uid = "loki-prod"
  error_label     = "level"

  match {
    property = "asserts_entity_type"
    op       = "EQUALS"
    values   = ["Service", "Pod"]
  }

  entity_property_to_log_label_mapping = {
    "service"     = "app"
    "namespace"   = "k8s_namespace"
    "environment" = "env"
  }

  filter_by_span_id  = true
  filter_by_trace_id = true
}
```

## Best practices

### Priority management

- Assign lower priority numbers to more specific configurations
- Higher priority configurations are evaluated first
- Use consistent priority ranges for different configuration types
- Document the reasoning behind priority assignments

### Data source configuration

- Ensure the data source UID matches your actual Loki or log aggregation system
- Test data source connectivity before applying configurations
- Use descriptive names for log configurations to indicate their purpose
- Consider using separate data sources for different environments

### Label map strategy

- Map entity properties consistently across all log configurations
- Use meaningful log label names that match your logging standards
- Document the mapping relationships in configuration comments
- Verify that mapped labels exist in your log data

### Match rules design

- Start with broad match rules and refine based on needs
- Use specific property names that exist in your entity model
- Test match rules with sample data before deploying
- Combine multiple match rules for precise entity targeting

### Distributed trace integration

- Enable `filter_by_span_id` and `filter_by_trace_id` when using OpenTelemetry
- Ensure your logs contain the appropriate trace and span ID labels
- Use consistent label names for trace IDs across your logging infrastructure
- Test trace correlation to verify it works as expected

## Validation

After applying the Terraform configuration, verify that:

- Log configurations are created in your Knowledge Graph instance
- Configurations appear in the Knowledge Graph UI under **Observability > Configuration > Logs**
- Log correlation works when drilling down from entities
- Label mappings correctly translate entity properties to log labels
- Match rules properly filter entities
- Trace and span ID filtering works for distributed tracing

## Related documentation

- [Configure logs correlation in Knowledge Graph](/docs/grafana-cloud/knowledge-graph/configure/logs-correlation/)
- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Loki documentation](/docs/loki/latest/)
