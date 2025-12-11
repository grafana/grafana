---
description: Learn how to configure knowledge graph SLOs in Grafana using Terraform for entity-centric monitoring and root cause analysis
menuTitle: Knowledge graph SLOs
title: Configure knowledge graph SLOs using Terraform
weight: 650
keywords:
  - Terraform
  - Knowledge graph
  - SLO
  - Service Level Objectives
  - RCA workbench
---

# Configure knowledge graph SLOs using Terraform

Service level objectives (SLOs) in the [knowledge graph](/docs/grafana-cloud/knowledge-graph/) provide entity-centric service level monitoring with integrated root cause analysis capabilities. By using the `grafana_slo_provenance` label with the value `asserts`, you can create SLOs that display the "asserts" badge in the UI and enable the **Open RCA workbench** button for seamless troubleshooting.

For details about creating and managing SLOs in the knowledge graph UI, refer to [Create and manage the knowledge graph SLOs](/docs/grafana-cloud/knowledge-graph/configure/manage-slos/).

## Overview

Knowledge graph SLOs extend standard Grafana SLOs with entity-centric monitoring and root cause analysis features:

- **Entity-centric monitoring:** SLOs are tied to specific services, applications, or infrastructure entities tracked by the knowledge graph
- **RCA workbench integration:** The **Open RCA workbench** button enables deep-linking to pre-filtered troubleshooting views
- **Knowledge graph provenance badge:** SLOs display an "asserts" badge instead of "provisioned" in the UI
- **Search expressions:** Define custom search expressions to filter entities in RCA workbench when troubleshooting an SLO breach

## Before you begin

To create a knowledge graph SLO using Terraform, you need to:

- Configure the knowledge graph and have metrics flowing into Grafana Cloud
- [Set up Terraform for the knowledge Graph](../getting-started/)
- Possess knowledge of and have experience with defining SLOs, SLIs, SLAs, and error budgets
- Have an understanding of PromQL

## Create a basic knowledge graph SLO

Create a file named `kg-slo.tf` and add the following:

```terraform
# Basic knowledge graph SLO with entity-centric monitoring
resource "grafana_slo" "kg_example" {
  name        = "API Service Availability"
  description = "SLO managed by knowledge graph for entity-centric monitoring and RCA"

  query {
    freeform {
      query = "sum(rate(http_requests_total{code!~\"5..\"}[$__rate_interval])) / sum(rate(http_requests_total[$__rate_interval]))"
    }
    type = "freeform"
  }

  objectives {
    value  = 0.995
    window = "30d"
  }

  destination_datasource {
    uid = "grafanacloud-prom"
  }

  # Knowledge graph integration labels
  # The grafana_slo_provenance label triggers knowledge graph-specific behavior:
  # - Displays "asserts" badge instead of "provisioned"
  # - Shows "Open RCA workbench" button in the SLO UI
  # - Enables correlation with knowledge graph entity-centric monitoring
  label {
    key   = "grafana_slo_provenance"
    value = "asserts"
  }

  label {
    key   = "service_name"
    value = "api-service"
  }

  # Search expression for RCA workbench
  # This enables the "Open RCA workbench" button to deep-link with pre-filtered context
  search_expression = "service=api-service"

  alerting {
    fastburn {
      annotation {
        key   = "name"
        value = "SLO Burn Rate Very High"
      }
      annotation {
        key   = "description"
        value = "Error budget is burning too fast"
      }
    }
    slowburn {
      annotation {
        key   = "name"
        value = "SLO Burn Rate High"
      }
      annotation {
        key   = "description"
        value = "Error budget is burning too fast"
      }
    }
  }
}
```

## Configure an SLO with multiple entity labels

Configure SLOs with multiple entity labels for fine-grained filtering in RCA workbench:

```terraform
# Knowledge graph SLO with comprehensive entity labels
resource "grafana_slo" "payment_service" {
  name        = "Payment Service Latency SLO"
  description = "Latency SLO for payment processing with team and environment context"

  query {
    freeform {
      query = "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service=\"payment\"}[$__rate_interval])) by (le)) < 0.5"
    }
    type = "freeform"
  }

  objectives {
    value  = 0.99
    window = "7d"
  }

  destination_datasource {
    uid = "grafanacloud-prom"
  }

  # Knowledge graph provenance - required for RCA workbench integration
  label {
    key   = "grafana_slo_provenance"
    value = "asserts"
  }

  # Service identification
  label {
    key   = "service_name"
    value = "payment-service"
  }

  # Team ownership
  label {
    key   = "team_name"
    value = "payments-team"
  }

  # Environment
  label {
    key   = "environment"
    value = "production"
  }

  # Business unit
  label {
    key   = "business_unit"
    value = "fintech"
  }

  # Search expression with multiple filters
  search_expression = "service=payment-service AND environment=production"

  alerting {
    fastburn {
      annotation {
        key   = "name"
        value = "Payment Latency Critical"
      }
      annotation {
        key   = "description"
        value = "Payment service P99 latency exceeding SLO - immediate attention required"
      }
      annotation {
        key   = "runbook_url"
        value = "https://docs.example.com/runbooks/payment-latency"
      }
    }
    slowburn {
      annotation {
        key   = "name"
        value = "Payment Latency Warning"
      }
      annotation {
        key   = "description"
        value = "Payment service experiencing elevated latency"
      }
    }
  }
}
```

## Configure a Kubernetes service SLO

Configure knowledge graph SLOs for Kubernetes services with Pod and namespace context:

```terraform
# Knowledge graph SLO for Kubernetes service
resource "grafana_slo" "k8s_frontend" {
  name        = "Frontend Service Availability"
  description = "Availability SLO for frontend service in Kubernetes"

  query {
    freeform {
      query = "sum(rate(http_requests_total{namespace=\"frontend\",code!~\"5..\"}[$__rate_interval])) / sum(rate(http_requests_total{namespace=\"frontend\"}[$__rate_interval]))"
    }
    type = "freeform"
  }

  objectives {
    value  = 0.999
    window = "30d"
  }

  destination_datasource {
    uid = "grafanacloud-prom"
  }

  label {
    key   = "grafana_slo_provenance"
    value = "asserts"
  }

  label {
    key   = "service_name"
    value = "frontend"
  }

  label {
    key   = "namespace"
    value = "frontend"
  }

  label {
    key   = "cluster"
    value = "prod-us-west-2"
  }

  # Search expression targeting Kubernetes entities
  search_expression = "namespace=frontend AND cluster=prod-us-west-2"

  alerting {
    fastburn {
      annotation {
        key   = "name"
        value = "Frontend Service Critical"
      }
      annotation {
        key   = "description"
        value = "Frontend service availability below SLO"
      }
      annotation {
        key   = "severity"
        value = "critical"
      }
    }
    slowburn {
      annotation {
        key   = "name"
        value = "Frontend Service Degraded"
      }
      annotation {
        key   = "description"
        value = "Frontend service showing signs of degradation"
      }
      annotation {
        key   = "severity"
        value = "warning"
      }
    }
  }
}
```

## Configure an API endpoint-specific SLO

Configure knowledge graph SLOs for specific API endpoints with request context:

```terraform
# Knowledge graph SLO for critical API endpoint
resource "grafana_slo" "checkout_api" {
  name        = "Checkout API Availability"
  description = "Availability SLO for /api/checkout endpoint"

  query {
    freeform {
      query = "sum(rate(http_requests_total{path=\"/api/checkout\",code!~\"5..\"}[$__rate_interval])) / sum(rate(http_requests_total{path=\"/api/checkout\"}[$__rate_interval]))"
    }
    type = "freeform"
  }

  objectives {
    value  = 0.9999
    window = "30d"
  }

  destination_datasource {
    uid = "grafanacloud-prom"
  }

  label {
    key   = "grafana_slo_provenance"
    value = "asserts"
  }

  label {
    key   = "service_name"
    value = "checkout-service"
  }

  label {
    key   = "endpoint"
    value = "/api/checkout"
  }

  label {
    key   = "criticality"
    value = "high"
  }

  # Search expression with endpoint context
  search_expression = "service=checkout-service AND path=/api/checkout"

  alerting {
    fastburn {
      annotation {
        key   = "name"
        value = "Checkout API Critical Failure"
      }
      annotation {
        key   = "description"
        value = "Checkout API experiencing high error rates - revenue impact"
      }
      annotation {
        key   = "severity"
        value = "critical"
      }
      annotation {
        key   = "alert_priority"
        value = "P0"
      }
    }
    slowburn {
      annotation {
        key   = "name"
        value = "Checkout API Degradation"
      }
      annotation {
        key   = "description"
        value = "Checkout API showing elevated error rates"
      }
      annotation {
        key   = "severity"
        value = "warning"
      }
    }
  }
}
```

## Configure a multi-environment SLO

Manage knowledge graph SLOs across multiple environments using Terraform workspaces or modules:

```terraform
# Variable for environment-specific configuration
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "slo_target" {
  description = "SLO target percentage"
  type        = number
}

# Environment-aware knowledge graph SLO
resource "grafana_slo" "api_service" {
  name        = "${var.environment} - API Service Availability"
  description = "API service availability SLO for ${var.environment} environment"

  query {
    freeform {
      query = "sum(rate(http_requests_total{environment=\"${var.environment}\",code!~\"5..\"}[$__rate_interval])) / sum(rate(http_requests_total{environment=\"${var.environment}\"}[$__rate_interval]))"
    }
    type = "freeform"
  }

  objectives {
    value  = var.slo_target
    window = "30d"
  }

  destination_datasource {
    uid = "grafanacloud-prom"
  }

  label {
    key   = "grafana_slo_provenance"
    value = "asserts"
  }

  label {
    key   = "service_name"
    value = "api-service"
  }

  label {
    key   = "environment"
    value = var.environment
  }

  search_expression = "service=api-service AND environment=${var.environment}"

  alerting {
    fastburn {
      annotation {
        key   = "name"
        value = "${var.environment} API Critical"
      }
      annotation {
        key   = "description"
        value = "API service in ${var.environment} experiencing critical errors"
      }
    }
    slowburn {
      annotation {
        key   = "name"
        value = "${var.environment} API Warning"
      }
      annotation {
        key   = "description"
        value = "API service in ${var.environment} showing elevated errors"
      }
    }
  }
}
```

## Resource reference

### `grafana_slo` with knowledge graph provenance

When creating knowledge graph-managed SLOs, the `grafana_slo` resource requires the `grafana_slo_provenance` label set to `asserts` to enable RCA workbench integration.

#### Required knowledge graph configuration

| Name                           | Type     | Required    | Description                                                                                        |
| ------------------------------ | -------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `grafana_slo_provenance` label | `string` | Yes         | Must be set to `asserts` to enable knowledge graph-specific features and RCA workbench integration |
| `search_expression`            | `string` | Recommended | Search expression for filtering entities in RCA workbench                                          |

#### Key arguments for knowledge graph SLOs

| Name                     | Type           | Required | Description                                                       |
| ------------------------ | -------------- | -------- | ----------------------------------------------------------------- |
| `name`                   | `string`       | Yes      | The name of the SLO                                               |
| `description`            | `string`       | No       | Description of the SLO purpose and scope                          |
| `query`                  | `object`       | Yes      | Query configuration defining how SLO is calculated                |
| `objectives`             | `object`       | Yes      | Target objectives including value and time window                 |
| `destination_datasource` | `object`       | Yes      | Destination data source for SLO metrics                           |
| `label`                  | `list(object)` | Yes      | Labels for the SLO, must include `grafana_slo_provenance=asserts` |
| `search_expression`      | `string`       | No       | Search expression for RCA workbench filtering                     |
| `alerting`               | `object`       | No       | Alerting configuration for fast burn and slow burn alerts         |

#### Query block

The `query` block supports the following:

| Name       | Type     | Required | Description                                               |
| ---------- | -------- | -------- | --------------------------------------------------------- |
| `type`     | `string` | Yes      | Query type, typically `freeform` for knowledge graph SLOs |
| `freeform` | `object` | Yes      | Freeform query configuration                              |

The `freeform` block supports:

| Name    | Type     | Required | Description                      |
| ------- | -------- | -------- | -------------------------------- |
| `query` | `string` | Yes      | PromQL query for SLO calculation |

#### Objectives block

The `objectives` block supports the following:

| Name     | Type     | Required | Description                                         |
| -------- | -------- | -------- | --------------------------------------------------- |
| `value`  | `number` | Yes      | Target SLO value (for example, 0.995 for 99.5%)     |
| `window` | `string` | Yes      | Time window for SLO evaluation (for example, "30d") |

#### Label block

Each `label` block supports the following:

| Name    | Type     | Required | Description |
| ------- | -------- | -------- | ----------- |
| `key`   | `string` | Yes      | Label key   |
| `value` | `string` | Yes      | Label value |

**Required label for knowledge graph SLOs:**

- `grafana_slo_provenance` = `asserts` (enables knowledge graph features)

**Recommended labels for entity tracking:**

- `service_name` - Name of the service
- `team_name` - Team responsible for the service
- `environment` - Environment (prod, staging, development)
- `namespace` - Kubernetes namespace
- `cluster` - Kubernetes cluster name

<!-- vale Grafana.Gerunds = NO -->

#### Alerting block

The `alerting` block supports the following:

| Name       | Type     | Required | Description                        |
| ---------- | -------- | -------- | ---------------------------------- |
| `fastburn` | `object` | No       | Fast burn rate alert configuration |
| `slowburn` | `object` | No       | Slow burn rate alert configuration |

Each alert block (`fastburn`, `slowburn`) supports:

| Name         | Type           | Required | Description                     |
| ------------ | -------------- | -------- | ------------------------------- |
| `annotation` | `list(object)` | No       | Annotations to add to the alert |

Each `annotation` block supports:

| Name    | Type     | Required | Description      |
| ------- | -------- | -------- | ---------------- |
| `key`   | `string` | Yes      | Annotation key   |
| `value` | `string` | Yes      | Annotation value |

Common annotation keys:

- `name` - Alert name
- `description` - Alert description
- `severity` - Alert severity level
- `runbook_url` - Link to runbook documentation
<!-- vale Grafana.Gerunds = YES -->

#### Example

```terraform
resource "grafana_slo" "kg_example" {
  name        = "My Service SLO"
  description = "SLO with knowledge graph RCA integration"

  query {
    freeform {
      query = "sum(rate(http_requests_total{code!~\"5..\"}[$__rate_interval])) / sum(rate(http_requests_total[$__rate_interval]))"
    }
    type = "freeform"
  }

  objectives {
    value  = 0.995
    window = "30d"
  }

  destination_datasource {
    uid = "grafanacloud-prom"
  }

  label {
    key   = "grafana_slo_provenance"
    value = "asserts"
  }

  label {
    key   = "service_name"
    value = "my-service"
  }

  search_expression = "service=my-service"

  alerting {
    fastburn {
      annotation {
        key   = "name"
        value = "SLO Fast Burn"
      }
    }
    slowburn {
      annotation {
        key   = "name"
        value = "SLO Slow Burn"
      }
    }
  }
}
```

## Best practices

Follow these best practices when setting knowledge graph SLOs.

### Use the knowledge graph provenance label

- Always include the `grafana_slo_provenance` label with value `asserts` for knowledge graph-managed SLOs
- This label enables the "asserts" badge in the UI instead of "provisioned"
- It also enables the **Open RCA workbench** button for troubleshooting SLO breaches

### Define search expressions

- Define meaningful search expressions that filter relevant entities in RCA workbench
- The search expression defines which entities populate RCA workbench when you troubleshoot an SLO breach
- Use entity attributes like service name, environment, namespace, and cluster
- Combine multiple filters with `AND` operators for precise filtering
- Test search expressions in RCA workbench before codifying them in Terraform

### Add entity labels

- Add descriptive labels to track service ownership, environment, and criticality
- Use consistent label naming conventions across all SLOs
- Include team names to enable quick identification of ownership
- Tag critical business services with appropriate labels

### Set SLO targets

- Set realistic SLO targets based on service requirements and capabilities
- Use higher targets (0.999+) for critical user-facing services
- Consider different targets for different environments (production vs staging)
- Review and adjust targets based on actual service performance

### Add alert annotations

- Add comprehensive descriptions to help on-call engineers understand the alert
- Include runbook URLs in annotations for quick access to troubleshooting guides
- Set appropriate severity levels (critical, warning) based on business impact
- Customize alert names to clearly identify the affected service and issue

### Configure queries

- Use PromQL queries that accurately represent service health
- Exclude expected error codes, such as 404, from error calculations when appropriate
- Leverage rate intervals with `$__rate_interval` for dynamic time range support
- Test queries in Grafana before adding them to Terraform configurations

### Set compliance windows

- Use 30-day windows for production SLOs to align with monthly reporting
- Consider shorter windows (7d) for development or testing environments
- Ensure compliance windows align with business requirements and error budget policies

## Verify the configuration

After applying the Terraform configuration, verify that:

- SLOs are created in your Grafana Cloud stack
- SLOs appear in **Observability > SLO** with the "asserts" badge
- The **Open RCA workbench** button is visible when you expand **Objective** for an SLO
- You can select a time range in the **Error Budget Burndown** panel and click **Open in RCA workbench**
- Search expressions correctly filter entities in RCA workbench
- Fast burn and slow burn alerts are configured with appropriate thresholds
- Labels are correctly applied and visible in the SLO details

## Troubleshooting

Follow these troubleshooting steps if you experience issues setting knowledge graph SLOs.

### SLO shows "provisioned" instead of "asserts" badge

Ensure the `grafana_slo_provenance` label is set to `asserts`:

```terraform
label {
  key   = "grafana_slo_provenance"
  value = "asserts"
}
```

### Open RCA workbench button not appearing

- Verify the `search_expression` field is populated
- The **Open RCA workbench** button appears after you have added a search expression in the **RCA workbench Context** section
- Ensure the search expression uses valid entity attributes
- Check that the knowledge graph is properly configured and receiving data

### Alerts not triggering

- Verify the PromQL query returns valid results in Grafana
- Check that the destination data source is correctly configured
- Ensure alerting blocks are properly defined with annotations

## Related documentation

- [Create and manage knowledge graph SLOs](/docs/grafana-cloud/knowledge-graph/configure/manage-slos/)
- [Troubleshoot an SLO breach with the knowledge graph](/docs/grafana-cloud/knowledge-graph/troubleshoot-infra-apps/slos/)
- [Get started with Terraform for the knowledge graph](../getting-started/)
- [Introduction to Grafana SLO](/docs/grafana-cloud/alerting-and-irm/slo/introduction/)
- [Configure notifications in the knowledge graph](/docs/grafana-cloud/knowledge-graph/configure/notifications/)
