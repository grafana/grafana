---
description: Configure profile correlation for Knowledge Graph using Terraform
menuTitle: Profile configurations
title: Configure profile correlation using Terraform
weight: 700
keywords:
  - Terraform
  - Knowledge Graph
  - Profile Configuration
  - Profile Correlation
  - Pyroscope
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/profile-configurations/
---

# Configure profile correlation using Terraform

Profile configurations in [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) allow you to define how continuous profiling data is queried and correlated with entities. You can specify data sources, entity matching rules, and label mappings for performance profiling.

For information about configuring profile correlation in the Knowledge Graph UI, refer to [Configure profiles correlation](/docs/grafana-cloud/knowledge-graph/configure/profiles-correlation/).

## Basic profile configuration

Create a file named `profile-configs.tf` and add the following:

```terraform
# Basic profile configuration for services
resource "grafana_asserts_profile_config" "production" {
  provider = grafana.asserts

  name            = "production"
  priority        = 1000
  default_config  = false
  data_source_uid = "grafanacloud-profiles"

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

  entity_property_to_profile_label_mapping = {
    "cluster"        = "k8s_cluster_name"
    "namespace"      = "k8s_namespace_name"
    "container"      = "k8s_container_name"
    "otel_service"   = "service_name"
    "otel_namespace" = "service_namespace"
  }
}
```

## Profile configuration with multiple match rules

Configure profile correlation with multiple entity matching criteria:

```terraform
# Development environment profile configuration
resource "grafana_asserts_profile_config" "development" {
  provider = grafana.asserts

  name            = "development"
  priority        = 2000
  default_config  = false
  data_source_uid = "pyroscope-dev"

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

  entity_property_to_profile_label_mapping = {
    "cluster"        = "k8s_cluster_name"
    "namespace"      = "k8s_namespace_name"
    "container"      = "k8s_container_name"
    "otel_service"   = "service_name"
    "otel_namespace" = "service_namespace"
    "pod"            = "k8s_pod_name"
  }
}
```

## Minimal profile configuration

Create a minimal configuration for all entities:

```terraform
# Minimal configuration for all entities
resource "grafana_asserts_profile_config" "minimal" {
  provider = grafana.asserts

  name            = "minimal"
  priority        = 3000
  default_config  = false
  data_source_uid = "pyroscope-minimal"

  match {
    property = "asserts_entity_type"
    op       = "IS NOT NULL"
    values   = []
  }

  entity_property_to_profile_label_mapping = {
    "cluster"        = "k8s_cluster_name"
    "otel_service"   = "service_name"
    "otel_namespace" = "service_namespace"
  }
}
```

## Advanced profile configuration with complex match rules

Configure profiles with multiple operations and advanced match rules:

```terraform
# Advanced configuration with multiple operations
resource "grafana_asserts_profile_config" "advanced" {
  provider = grafana.asserts

  name            = "advanced"
  priority        = 1500
  default_config  = false
  data_source_uid = "pyroscope-advanced"

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
    property = "cpu_threshold"
    op       = ">="
    values   = ["80"]
  }

  entity_property_to_profile_label_mapping = {
    "service_type"   = "service_type"
    "team"           = "team_owner"
    "environment"    = "deployment_env"
    "version"        = "app_version"
    "region"         = "cloud_region"
    "node"           = "k8s_node_name"
  }
}
```

## Resource reference

### `grafana_asserts_profile_config`

Manage Knowledge Graph profile configurations through the Grafana API.

#### Arguments

| Name                                       | Type           | Required | Description                                                                                      |
| ------------------------------------------ | -------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `name`                                     | `string`       | Yes      | The name of the profile configuration. This field is immutable and forces recreation if changed. |
| `priority`                                 | `number`       | Yes      | Priority of the profile configuration. A lower number means a higher priority.                   |
| `default_config`                           | `bool`         | Yes      | Whether this is the default configuration. Default configurations cannot be deleted.             |
| `data_source_uid`                          | `string`       | Yes      | DataSource UID to be queried (for example, a Pyroscope instance).                                |
| `match`                                    | `list(object)` | No       | List of match rules for entity properties. Refer to [match block](#match-block) for details.     |
| `entity_property_to_profile_label_mapping` | `map(string)`  | No       | Mapping of entity properties to profile labels for correlation.                                  |

#### Match block

Each `match` block supports the following:

| Name       | Type           | Required | Description                                                                                                                  |
| ---------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `property` | `string`       | Yes      | Entity property to match against.                                                                                            |
| `op`       | `string`       | Yes      | Operation to use for matching. One of: `=`, `<>`, `<`, `>`, `<=`, `>=`, `IS NULL`, `IS NOT NULL`, `STARTS WITH`, `CONTAINS`. |
| `values`   | `list(string)` | Yes      | Values to match against. Can be empty for `IS NULL` and `IS NOT NULL` operations.                                            |

#### Example

```terraform
resource "grafana_asserts_profile_config" "example" {
  provider = grafana.asserts

  name            = "example-profiles"
  priority        = 1000
  default_config  = false
  data_source_uid = "pyroscope-prod"

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

  entity_property_to_profile_label_mapping = {
    "service"     = "service_name"
    "namespace"   = "k8s_namespace_name"
    "environment" = "deployment_env"
    "cluster"     = "k8s_cluster_name"
    "container"   = "k8s_container_name"
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

- Ensure the data source UID matches your actual Pyroscope or profiling system
- Test data source connectivity before applying configurations
- Use descriptive names for profile configurations to indicate their purpose
- Consider using separate data sources for different environments

### Label map strategy

- Map entity properties consistently across all profile configurations
- Use meaningful profile label names that match your profiling standards
- Document the mapping relationships in configuration comments
- Verify that mapped labels exist in your profile data
- Align label names with your continuous profiling setup (Pyroscope, Grafana Agent, etc.)

### Match rules design

- Start with broad match rules and refine based on needs
- Use specific property names that exist in your entity model
- Test match rules with sample data before deploying
- Combine multiple match rules for precise entity targeting
- Leverage comparison operators (`<`, `>`, `<=`, `>=`) for numeric thresholds or performance-based filtering

### Continuous profiling integration

- Ensure your profiling agents are configured with appropriate labels
- Use consistent label names across your profiling infrastructure
- Map both service-level and infrastructure-level properties for comprehensive correlation
- Consider including pod, node, and container information for Kubernetes deployments
- Test profile correlation to verify it works as expected

## Validation

After applying the Terraform configuration, verify that:

- Profile configurations are created in your Knowledge Graph instance
- Configurations appear in the Knowledge Graph UI under **Observability > Configuration > Profiles**
- Profile correlation works when drilling down from entities
- Label mappings correctly translate entity properties to profile labels
- Match rules properly filter entities
- Profile queries return expected results in the Knowledge Graph UI
- Flame graphs and profiling data display correctly when accessed through Knowledge Graph

## Related documentation

- [Configure profiles correlation in Knowledge Graph](/docs/grafana-cloud/knowledge-graph/configure/profiles-correlation/)
- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Pyroscope documentation](/docs/pyroscope/latest/)
- [Grafana Agent profiling](/docs/agent/latest/flow/reference/components/pyroscope.scrape/)
