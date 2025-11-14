---
description: Define custom entity models for Knowledge Graph using Terraform
menuTitle: Custom model rules
title: Create custom model rules using Terraform
weight: 400
keywords:
  - Terraform
  - Knowledge Graph
  - Custom Model Rules
  - Entity Models
  - Prometheus
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/custom-model-rules/
---

# Create custom model rules using Terraform

Custom model rules in [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) allow you to define how entities are discovered and modeled based on Prometheus queries. These rules enable you to create custom entity types, define their relationships, and specify how they should be enriched with additional data.

For information about managing entities and relations in the Knowledge Graph UI, refer to [Manage entities and relations](/docs/grafana-cloud/knowledge-graph/configure/manage-entities-relations/).

## Basic custom model rules

Create a file named `custom-model-rules.tf` and add the following:

```terraform
# Basic custom model rule for services
resource "grafana_asserts_custom_model_rules" "basic_service" {
  provider = grafana.asserts

  name = "basic-service-model"

  rules {
    entity {
      type = "Service"
      name = "service"

      defined_by {
        query = "up{job!=''}"
        label_values = {
          service = "job"
        }
        literals = {
          _source = "up_query"
        }
      }
    }
  }
}
```

## Advanced service model with scope and lookup

Define service entities with environment scoping and relationship mappings:

```terraform
# Advanced service model with environment scoping
resource "grafana_asserts_custom_model_rules" "advanced_service" {
  provider = grafana.asserts

  name = "advanced-service-model"

  rules {
    entity {
      type = "Service"
      name = "workload | service | job"

      scope = {
        namespace = "namespace"
        env       = "asserts_env"
        site      = "asserts_site"
      }

      lookup = {
        workload  = "workload | deployment | statefulset | daemonset | replicaset"
        service   = "service"
        job       = "job"
        proxy_job = "job"
      }

      defined_by {
        query = "up{job!='', asserts_env!=''}"
        label_values = {
          service     = "service"
          job         = "job"
          workload    = "workload"
          namespace   = "namespace"
        }
        literals = {
          _source = "up_with_workload"
        }
      }

      defined_by {
        query    = "up{job='maintenance'}"
        disabled = true
      }
    }
  }
}
```

## Multi-entity model configuration

Define multiple entity types in a single configuration:

```terraform
# Multiple entity types in a single model
resource "grafana_asserts_custom_model_rules" "multi_entity" {
  provider = grafana.asserts

  name = "kubernetes-entities"

  rules {
    # Service entity
    entity {
      type = "Service"
      name = "service"

      scope = {
        namespace = "namespace"
        cluster   = "cluster"
      }

      defined_by {
        query = "up{service!=''}"
        label_values = {
          service   = "service"
          namespace = "namespace"
          cluster   = "cluster"
        }
      }
    }

    # Pod entity
    entity {
      type = "Pod"
      name = "Pod"

      scope = {
        namespace = "namespace"
        cluster   = "cluster"
      }

      lookup = {
        service   = "service"
        workload  = "workload"
      }

      defined_by {
        query = "kube_pod_info{pod!=''}"
        label_values = {
          Pod       = "pod"
          namespace = "namespace"
          cluster   = "cluster"
          service   = "service"
        }
        literals = {
          _entity_type = "Pod"
        }
      }
    }

    # Namespace entity
    entity {
      type = "Namespace"
      name = "namespace"

      scope = {
        cluster = "cluster"
      }

      defined_by {
        query = "kube_namespace_status_phase{namespace!=''}"
        label_values = {
          namespace = "namespace"
          cluster   = "cluster"
        }
      }
    }
  }
}
```

## Complex entity with enrichment

Create service entities with multiple data sources and enrichment:

```terraform
# Service entity with enrichment from multiple sources
resource "grafana_asserts_custom_model_rules" "enriched_service" {
  provider = grafana.asserts

  name = "enriched-service-model"

  rules {
    entity {
      type = "Service"
      name = "service"

      enriched_by = [
        "prometheus_metrics",
        "kubernetes_metadata",
        "application_logs"
      ]

      scope = {
        environment = "asserts_env"
        region      = "asserts_site"
        team        = "team"
      }

      lookup = {
        deployment = "workload"
        Pod        = "pod"
        container  = "container"
      }

      # Primary definition from service up metrics
      defined_by {
        query = "up{service!='', asserts_env!=''}"
        label_values = {
          service     = "service"
          environment = "asserts_env"
          region      = "asserts_site"
          team        = "team"
        }
        literals = {
          _primary_source = "service_up"
        }
      }

      # Secondary definition from application metrics
      defined_by {
        query = "http_requests_total{service!=''}"
        label_values = {
          service     = "service"
          environment = "environment"
          version     = "version"
        }
        literals = {
          _secondary_source = "http_metrics"
        }
      }

      # Disabled definition for testing
      defined_by {
        query    = "test_metric{service!=''}"
        disabled = true
      }
    }
  }
}
```

## Database and infrastructure entities

Define database and infrastructure entity models:

```terraform
# Database and infrastructure entity models
resource "grafana_asserts_custom_model_rules" "infrastructure" {
  provider = grafana.asserts

  name = "infrastructure-entities"

  rules {
    # Database entity
    entity {
      type = "Database"
      name = "database_instance"

      scope = {
        environment = "env"
        region      = "region"
      }

      lookup = {
        host     = "instance"
        port     = "port"
        db_name  = "database"
      }

      defined_by {
        query = "mysql_up{instance!=''}"
        label_values = {
          database_instance = "instance"
          database         = "database"
          env             = "environment"
          region          = "region"
        }
        literals = {
          _db_type = "mysql"
        }
        metric_value = "1"
      }

      defined_by {
        query = "postgres_up{instance!=''}"
        label_values = {
          database_instance = "instance"
          database         = "datname"
          env             = "environment"
        }
        literals = {
          _db_type = "postgresql"
        }
      }
    }

    # Load balancer entity
    entity {
      type = "LoadBalancer"
      name = "lb_instance"

      scope = {
        environment = "env"
      }

      defined_by {
        query = "haproxy_up{proxy!=''}"
        label_values = {
          lb_instance = "instance"
          proxy      = "proxy"
          env        = "environment"
        }
        literals = {
          _lb_type = "haproxy"
        }
      }
    }
  }
}
```

## Resource reference

### `grafana_asserts_custom_model_rules`

Manage Knowledge Graph custom model rules through the Grafana API. This resource allows you to define custom entity models based on Prometheus queries with advanced mapping and enrichment capabilities.

#### Arguments

| Name    | Type           | Required | Description                                                                                              |
| ------- | -------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `name`  | `string`       | Yes      | The name of the custom model rules. This field is immutable and forces recreation if changed.            |
| `rules` | `list(object)` | Yes      | The rules configuration containing entity definitions. Refer to [rules block](#rules-block) for details. |

#### Rules block

Each `rules` block supports the following:

| Name     | Type           | Required | Description                                                                     |
| -------- | -------------- | -------- | ------------------------------------------------------------------------------- |
| `entity` | `list(object)` | Yes      | List of entity definitions. Refer to [entity block](#entity-block) for details. |

#### Entity block

Each `entity` block supports the following:

| Name          | Type           | Required | Description                                                                                            |
| ------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `type`        | `string`       | Yes      | The type of the entity (for example, Service, Pod, Namespace).                                         |
| `name`        | `string`       | Yes      | The name pattern for the entity. Can include pipe-separated alternatives.                              |
| `defined_by`  | `list(object)` | Yes      | List of queries that define this entity. Refer to [`defined_by` block](#defined_by-block) for details. |
| `disabled`    | `bool`         | No       | Whether this entity is disabled. Defaults to `false`.                                                  |
| `enriched_by` | `list(string)` | No       | List of enrichment sources for the entity.                                                             |
| `lookup`      | `map(string)`  | No       | Lookup mappings for the entity to relate different label names.                                        |
| `scope`       | `map(string)`  | No       | Scope labels that define the boundaries of this entity type.                                           |

#### `defined_by` block

Each `defined_by` block supports the following:

| Name           | Type          | Required | Description                                                               |
| -------------- | ------------- | -------- | ------------------------------------------------------------------------- |
| `query`        | `string`      | Yes      | The Prometheus query that defines this entity.                            |
| `disabled`     | `bool`        | No       | Whether this query is disabled. Defaults to `false`.                      |
| `label_values` | `map(string)` | No       | Label value mappings for extracting entity attributes from query results. |
| `literals`     | `map(string)` | No       | Literal value mappings for adding static attributes to entities.          |
| `metric_value` | `string`      | No       | Metric value to use from the query result.                                |

{{< admonition type="note" >}}
When `disabled = true` is set for a `defined_by` query, only the `query` field is used for matching. All other fields in the block are ignored.
{{< /admonition >}}

## Best practices

### Entity models

- Design your entity models to reflect your actual infrastructure and application architecture
- Use descriptive names for custom model rules that indicate their purpose and scope
- Start with basic entity definitions and gradually add complexity as needed
- Define clear entity scopes using the `scope` parameter to organize entities by environment, region, or team

### Query design and performance

- Write efficient Prometheus queries that don't overload your monitoring system
- Test your Prometheus queries independently before using them in model rules
- Use specific label filters to reduce the scope of your queries where possible
- Consider the cardinality implications of your entity definitions
- Use the `disabled` flag to temporarily disable problematic queries during debugging

### Relationships and enrichment

- Use `lookup` mappings to establish relationships between different entity types
- Leverage `enriched_by` to specify additional data sources for entity enrichment
- Map Prometheus labels to entity attributes using clear and descriptive names
- Use meaningful `literals` to add static metadata that helps with entity identification

### Label and attribute management

- Establish consistent labeling conventions across your infrastructure
- Use `label_values` to extract dynamic attributes from your metrics
- Document the meaning and expected values of custom literals
- Ensure label names match across different entity definitions for proper relationship discovery

## Validation

After applying the Terraform configuration, verify that:

- Custom model rules are applied in your Knowledge Graph instance
- Entities are being discovered according to your defined queries
- Entity relationships and enrichment are working as expected
- Entity graphs display the correct entity types and connections
- Queries perform well without causing excessive load

## Related documentation

- [Manage entities and relations in Knowledge Graph](/docs/grafana-cloud/knowledge-graph/configure/manage-entities-relations/)
- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Knowledge graph basics](/docs/grafana-cloud/knowledge-graph/knowledge-graph-basics/)
