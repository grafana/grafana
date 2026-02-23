---
description: Configure thresholds for Knowledge Graph using Terraform
menuTitle: Thresholds
title: Configure thresholds using Terraform
weight: 600
keywords:
  - Terraform
  - Knowledge Graph
  - Thresholds
  - Request Thresholds
  - Resource Thresholds
  - Health Thresholds
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/thresholds/
---

# Configure thresholds using Terraform

Threshold configurations in [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) allow you to define custom thresholds for request, resource, and health assertions. These configurations help you set specific limits and conditions for monitoring your services and infrastructure.

For information about managing thresholds in the Knowledge Graph UI, refer to [Manage thresholds](/docs/grafana-cloud/knowledge-graph/configure/manage-thresholds/).

## Basic threshold configuration

Create a file named `thresholds.tf` and add the following:

```terraform
# Basic threshold configuration with all three types
resource "grafana_asserts_thresholds" "basic" {
  provider = grafana.asserts

  request_thresholds = [{
    entity_name     = "payment-service"
    assertion_name  = "ErrorRatioBreach"
    request_type    = "inbound"
    request_context = "/charge"
    value           = 0.01
  }]

  resource_thresholds = [{
    assertion_name = "Saturation"
    resource_type  = "container"
    container_name = "worker"
    source         = "metrics"
    severity       = "warning"
    value          = 75
  }]

  health_thresholds = [{
    assertion_name = "ServiceDown"
    expression     = "up < 1"
    entity_type    = "Service"
  }]
}
```

## Request threshold configurations

Configure thresholds for different service request types and contexts:

```terraform
# Multiple request thresholds for different services
resource "grafana_asserts_thresholds" "request_thresholds" {
  provider = grafana.asserts

  request_thresholds = [
    {
      entity_name     = "api-service"
      assertion_name  = "ErrorRatioBreach"
      request_type    = "inbound"
      request_context = "/api/v1/users"
      value           = 0.02
    },
    {
      entity_name     = "api-service"
      assertion_name  = "LatencyP99ErrorBuildup"
      request_type    = "inbound"
      request_context = "/api/v1/orders"
      value           = 500
    },
    {
      entity_name     = "payment-gateway"
      assertion_name  = "RequestRateAnomaly"
      request_type    = "outbound"
      request_context = "/payment/process"
      value           = 1000
    }
  ]
}
```

## Resource threshold configurations

Define resource thresholds for different severity levels:

```terraform
# Resource thresholds for different severity levels
resource "grafana_asserts_thresholds" "resource_thresholds" {
  provider = grafana.asserts

  resource_thresholds = [
    {
      assertion_name = "Saturation"
      resource_type  = "container"
      container_name = "web-server"
      source         = "metrics"
      severity       = "warning"
      value          = 75
    },
    {
      assertion_name = "Saturation"
      resource_type  = "container"
      container_name = "web-server"
      source         = "metrics"
      severity       = "critical"
      value          = 90
    },
    {
      assertion_name = "ResourceRateBreach"
      resource_type  = "Pod"
      container_name = "database"
      source         = "logs"
      severity       = "warning"
      value          = 80
    }
  ]
}
```

## Health threshold configurations

Configure health checks with Prometheus expressions:

```terraform
# Health thresholds with Prometheus expressions
resource "grafana_asserts_thresholds" "health_thresholds" {
  provider = grafana.asserts

  health_thresholds = [
    {
      assertion_name = "ServiceDown"
      expression     = "up{job=\"api-service\"} < 1"
      entity_type    = "Service"
    },
    {
      assertion_name = "HighMemoryUsage"
      expression     = "memory_usage_percent > 85"
      entity_type    = "Service"
    },
    {
      assertion_name = "DatabaseConnectivity"
      expression     = "db_connection_pool_active / db_connection_pool_max > 0.9"
      entity_type    = "Service"
    }
  ]
}
```

## Comprehensive threshold configuration

Define comprehensive thresholds for production environments:

```terraform
# Production environment with comprehensive thresholds
resource "grafana_asserts_thresholds" "production" {
  provider = grafana.asserts

  request_thresholds = [
    {
      entity_name     = "frontend"
      assertion_name  = "ErrorRatioBreach"
      request_type    = "inbound"
      request_context = "/"
      value           = 0.005
    },
    {
      entity_name     = "backend-api"
      assertion_name  = "LatencyP99ErrorBuildup"
      request_type    = "inbound"
      request_context = "/api"
      value           = 200
    }
  ]

  resource_thresholds = [
    {
      assertion_name = "Saturation"
      resource_type  = "container"
      container_name = "frontend"
      source         = "metrics"
      severity       = "warning"
      value          = 70
    },
    {
      assertion_name = "Saturation"
      resource_type  = "container"
      container_name = "backend-api"
      source         = "metrics"
      severity       = "critical"
      value          = 85
    }
  ]

  health_thresholds = [
    {
      assertion_name = "ServiceDown"
      expression     = "up < 1"
      entity_type    = "Service"
    },
    {
      assertion_name = "NodeDown"
      expression     = "up{job=\"node-exporter\"} < 1"
      entity_type    = "Service"
    }
  ]
}
```

## Resource reference

### `grafana_asserts_thresholds`

Manage Knowledge Graph threshold configurations through the Grafana API. This resource allows you to define custom thresholds for request, resource, and health assertions.

#### Arguments

| Name                  | Type           | Required | Description                                                                                                              |
| --------------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `request_thresholds`  | `list(object)` | No       | List of request threshold configurations. Refer to [request thresholds block](#request-thresholds-block) for details.    |
| `resource_thresholds` | `list(object)` | No       | List of resource threshold configurations. Refer to [resource thresholds block](#resource-thresholds-block) for details. |
| `health_thresholds`   | `list(object)` | No       | List of health threshold configurations. Refer to [health thresholds block](#health-thresholds-block) for details.       |

#### Request thresholds block

Each `request_thresholds` block supports the following:

| Name              | Type     | Required | Description                                            |
| ----------------- | -------- | -------- | ------------------------------------------------------ |
| `entity_name`     | `string` | Yes      | The name of the entity to apply the threshold to.      |
| `assertion_name`  | `string` | Yes      | The name of the assertion to configure.                |
| `request_type`    | `string` | Yes      | The type of request (inbound, outbound).               |
| `request_context` | `string` | Yes      | The request context or path to apply the threshold to. |
| `value`           | `number` | Yes      | The threshold value.                                   |

#### Resource thresholds block

Each `resource_thresholds` block supports the following:

| Name             | Type     | Required | Description                                          |
| ---------------- | -------- | -------- | ---------------------------------------------------- |
| `assertion_name` | `string` | Yes      | The name of the assertion to configure.              |
| `resource_type`  | `string` | Yes      | The type of resource (container, Pod, node).         |
| `container_name` | `string` | Yes      | The name of the container to apply the threshold to. |
| `source`         | `string` | Yes      | The source of the metrics (metrics, logs).           |
| `severity`       | `string` | Yes      | The severity level (warning, critical).              |
| `value`          | `number` | Yes      | The threshold value.                                 |

#### Health thresholds block

Each `health_thresholds` block supports the following:

| Name             | Type     | Required | Description                                                                          |
| ---------------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| `assertion_name` | `string` | Yes      | The name of the assertion to configure.                                              |
| `expression`     | `string` | Yes      | The Prometheus expression for the health check.                                      |
| `entity_type`    | `string` | Yes      | Entity type for the health threshold (for example, Service, Pod, Namespace, Volume). |
| `alert_category` | `string` | No       | Optional alert category label for the health threshold.                              |

#### Example

```terraform
resource "grafana_asserts_thresholds" "example" {
  provider = grafana.asserts

  request_thresholds = [{
    entity_name     = "api-service"
    assertion_name  = "ErrorRatioBreach"
    request_type    = "inbound"
    request_context = "/api/v1/users"
    value           = 0.02
  }]

  resource_thresholds = [{
    assertion_name = "Saturation"
    resource_type  = "container"
    container_name = "web-server"
    source         = "metrics"
    severity       = "warning"
    value          = 75
  }]

  health_thresholds = [{
    assertion_name = "ServiceDown"
    expression     = "up{job=\"api-service\"} < 1"
    entity_type    = "Service"
  }]
}
```

## Best practices

### Threshold configuration management

- Set appropriate threshold values based on your service level objectives (SLOs)
- Use different severity levels (warning, critical) to create escalation paths
- Test threshold configurations in non-production environments first
- Monitor threshold effectiveness and adjust values based on actual performance data

### Request threshold best practices

- Configure request thresholds for critical user-facing endpoints
- Set different thresholds for different request types (inbound vs outbound)
- Consider request context when setting thresholds for specific API paths
- Use error ratio thresholds to catch service degradation early
- Review historical performance data to set realistic threshold values

### Resource threshold best practices

- Set resource thresholds based on your infrastructure capacity
- Use container-specific thresholds for microservices architectures
- Configure both warning and critical thresholds for gradual escalation
- Monitor resource utilization patterns to set realistic threshold values
- Consider seasonal or periodic patterns in resource usage

### Health threshold best practices

- Use Prometheus expressions that accurately reflect service health
- Test health check expressions independently before applying them
- Set up health thresholds for critical dependencies and external services
- Use composite expressions for complex health checks
- Ensure expressions perform efficiently without causing excessive load

### Value selection guidelines

- Start conservative and adjust based on real-world performance
- Use percentages (0-1 range) for ratio-based metrics
- Use milliseconds for latency thresholds
- Document the reasoning behind specific threshold values
- Review and update thresholds regularly based on system evolution

## Validation

After applying the Terraform configuration, verify that:

- Threshold configurations are applied in your Knowledge Graph instance
- Configurations appear in the Knowledge Graph UI under **Observability > Rules > Threshold**
- Request thresholds correctly identify breaches for specified services
- Resource thresholds trigger at appropriate severity levels
- Health thresholds accurately reflect service status
- Threshold values align with your SLO commitments

## Related documentation

- [Manage thresholds in Knowledge Graph](/docs/grafana-cloud/knowledge-graph/configure/manage-thresholds/)
- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Configure alerts in Knowledge Graph](/docs/grafana-cloud/knowledge-graph/configure/alerts/)
