---
description: Configure the Knowledge Graph stack using Terraform
menuTitle: Configure the Knowledge Graph stack
title: Configure the Knowledge Graph stack using Terraform
weight: 150
keywords:
  - Terraform
  - Knowledge Graph
  - Stack Configuration
  - Onboarding
  - Datasets
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/knowledge-graph-stack/
---

# Configure the Knowledge Graph stack using Terraform

The Knowledge Graph stack resource manages the full onboarding flow for your Grafana Cloud stack. It provisions API tokens, configures datasets based on available metrics, and enables the stack.

By default, datasets are auto-configured based on detected metrics. To manually configure datasets, for example when your metrics use non-standard label names, use the `dataset` block.

## Before you begin

Before you begin, ensure you have the following:

- A Grafana Cloud account, as shown in [Get started](/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine
- The Grafana Terraform provider configured, as shown in [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Knowledge Graph enabled](/docs/grafana-cloud/knowledge-graph/get-started/) on your Grafana Cloud stack
- A Cloud Access Policy with the following scopes: `stacks:read`, `metrics:read`, `metrics:write`

## Dataset types

The following dataset types are available:

- **`kubernetes`**: Kubernetes metrics. Requires [Kubernetes Monitoring](/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/) to be enabled on your stack.
- **`otel`**: Application Observability metrics. Requires [Application Observability](/docs/grafana-cloud/monitor-applications/application-observability/) to be enabled on your stack.
- **`prometheus`**: Standard Prometheus metrics.
- **`aws`**: Amazon Web Services metrics.

## Create the required tokens

Before you configure the Knowledge Graph stack, create the Cloud Access Policy and Grafana Service Account tokens that the resource requires.

Create a file named `knowledge-graph-stack.tf` and add the following:

```terraform
# Create a Cloud Access Policy with required scopes
resource "grafana_cloud_access_policy" "knowledge_graph" {
  name         = "knowledge-graph-stack-policy"
  display_name = "Knowledge Graph Stack Policy"

  scopes = [
    "stacks:read",
    "metrics:read",
    "metrics:write",
  ]

  realm {
    type       = "stack"
    identifier = var.stack_id
  }
}

# Create a token from the Cloud Access Policy
resource "grafana_cloud_access_policy_token" "knowledge_graph" {
  name             = "knowledge-graph-stack-token"
  access_policy_id = grafana_cloud_access_policy.knowledge_graph.policy_id
}

# Create a Grafana Service Account for dashboards and Grafana Managed Alerts
resource "grafana_cloud_stack_service_account" "knowledge_graph" {
  stack_slug  = var.stack_slug
  name        = "knowledge-graph-managed-alerts-sa"
  role        = "Admin"
  is_disabled = false
}

resource "grafana_cloud_stack_service_account_token" "knowledge_graph" {
  stack_slug         = var.stack_slug
  service_account_id = grafana_cloud_stack_service_account.knowledge_graph.id
  name               = "knowledge-graph-managed-alerts-token"
}

variable "stack_id" {
  description = "The Grafana Cloud stack ID"
  type        = string
}

variable "stack_slug" {
  description = "The Grafana Cloud stack slug"
  type        = string
}
```

Replace the following values:

- _`<STACK_ID>`_ with your Grafana Cloud stack ID
- _`<STACK_SLUG>`_ with your Grafana Cloud stack slug

## Basic stack configuration with auto-detected datasets

The simplest configuration provisions tokens and auto-detects datasets based on available metrics. This is the recommended approach when your metrics use standard label names.

Add the following to `knowledge-graph-stack.tf`:

```terraform
resource "grafana_asserts_stack" "main" {
  cloud_access_policy_token = grafana_cloud_access_policy_token.knowledge_graph.token
  grafana_token             = grafana_cloud_stack_service_account_token.knowledge_graph.key
}
```

When you apply this configuration, the resource:

1. Provisions API tokens for Grafana Cloud, Mimir, and the assertion detector
1. Auto-detects available datasets based on your stack's metrics
1. Enables the stack with the detected datasets

## Configure the dataset manually

Use manual configuration when your metrics use non-standard label names, for example a custom environment label. Each `dataset` block configures one dataset type.

```terraform
resource "grafana_asserts_stack" "manual" {
  cloud_access_policy_token = grafana_cloud_access_policy_token.knowledge_graph.token
  grafana_token             = grafana_cloud_stack_service_account_token.knowledge_graph.key

  dataset {
    type = "kubernetes"

    filter_group {
      env_label  = "deployment_environment"
      site_label = "cluster"

      env_label_values  = ["production", "staging"]
      site_label_values = ["us-east-1", "eu-west-1"]
    }
  }
}
```

{{< admonition type="note" >}}
When you specify one or more `dataset` blocks, auto-detection is skipped. You must define all datasets you want to configure.
{{< /admonition >}}

## Configure multiple datasets with filters

Configure multiple dataset types with custom label mappings and metric filters:

```terraform
resource "grafana_asserts_stack" "multi_dataset" {
  cloud_access_policy_token = grafana_cloud_access_policy_token.knowledge_graph.token
  grafana_token             = grafana_cloud_stack_service_account_token.knowledge_graph.key

  dataset {
    type = "kubernetes"

    filter_group {
      env_label  = "deployment_environment"
      site_label = "cluster"

      env_label_values  = ["production", "staging"]
      site_label_values = ["us-east-1", "eu-west-1"]
    }
  }

  dataset {
    type = "prometheus"

    filter_group {
      env_label = "environment"
      env_name  = "prod"

      filter {
        name     = "region"
        operator = "=~"
        values   = ["us-.*", "eu-.*"]
      }
    }
  }
}
```

## Resource reference

### `grafana_asserts_stack`

Manage the Knowledge Graph stack configuration through the Grafana API. This resource handles the full onboarding flow including token provisioning, dataset configuration, and stack enablement.

#### Arguments

| Name                        | Type           | Required | Description                                                                                                                                                                                                                       |
| --------------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cloud_access_policy_token` | `string`       | Yes      | A Grafana Cloud Access Policy token with the following scopes: `stacks:read`, `metrics:read`, `metrics:write`. Used for Grafana Cloud API access, Mimir authentication, and assertion detector webhook authentication. Sensitive. |
| `grafana_token`             | `string`       | No       | A Grafana Service Account token for installing dashboards and Grafana Managed Alerts. Create using `grafana_cloud_stack_service_account_token`. Sensitive.                                                                        |
| `dataset`                   | `list(object)` | No       | Manual dataset configuration. When specified, auto-detection is skipped. Refer to [dataset block](#dataset-block) for details.                                                                                                    |

#### Attributes

| Name      | Type     | Description                             |
| --------- | -------- | --------------------------------------- |
| `enabled` | `bool`   | Whether the stack is currently enabled. |
| `status`  | `string` | Current onboarding status of the stack. |
| `version` | `int`    | Configuration version number.           |

#### Dataset block

Each `dataset` block supports the following:

| Name               | Type           | Required | Description                                                                                              |
| ------------------ | -------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `type`             | `string`       | Yes      | The dataset type: `kubernetes`, `otel`, `prometheus`, or `aws`.                                          |
| `disabled_vendors` | `list(string)` | No       | List of vendors to disable for this dataset.                                                             |
| `filter_group`     | `list(object)` | No       | Filter groups for custom label mappings. Refer to [filter group block](#filter-group-block) for details. |

#### Filter group block

Each `filter_group` block supports the following:

| Name                | Type           | Required | Description                                                                                               |
| ------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `env_label`         | `string`       | No       | The metric label name used for environment (for example, `env`, `environment`, `deployment_environment`). |
| `env_name`          | `string`       | No       | A friendly name for the environment.                                                                      |
| `site_label`        | `string`       | No       | The metric label name used for site or cluster.                                                           |
| `env_label_values`  | `list(string)` | No       | Specific values of the environment label to match.                                                        |
| `site_label_values` | `list(string)` | No       | Specific values of the site label to match.                                                               |
| `filter`            | `list(object)` | No       | Additional metric filters. Refer to [filter block](#filter-block) for details.                            |

#### Filter block

Each `filter` block supports the following:

| Name       | Type           | Required | Description                                    |
| ---------- | -------------- | -------- | ---------------------------------------------- |
| `name`     | `string`       | Yes      | The label name to filter on.                   |
| `operator` | `string`       | Yes      | The filter operator: `=`, `!=`, `=~`, or `!~`. |
| `values`   | `list(string)` | Yes      | The values to match against.                   |

#### Example

```terraform
resource "grafana_asserts_stack" "example" {
  cloud_access_policy_token = grafana_cloud_access_policy_token.knowledge_graph.token
  grafana_token             = grafana_cloud_stack_service_account_token.knowledge_graph.key

  dataset {
    type = "kubernetes"

    filter_group {
      env_label         = "deployment_environment"
      site_label        = "cluster"
      env_label_values  = ["production"]
      site_label_values = ["us-east-1"]
    }
  }
}
```

## Best practices

### Token management

- Create a dedicated Cloud Access Policy for the Knowledge Graph stack with only the required scopes
- Use separate Service Accounts for different purposes rather than sharing a single admin token
- Rotate tokens regularly and use sensitive variable handling in Terraform to avoid exposing tokens in logs
- Store tokens in a secret management system and reference them through Terraform variables

### Dataset configuration

- Start with auto-detected datasets and switch to manual configuration only when needed
- When using manual configuration, define all datasets you want to monitor
- Use specific `env_label_values` and `site_label_values` to limit the scope of monitoring
- Test dataset configurations in a non-production stack first

### Filter groups

- Use filter groups when your metrics use non-standard label names
- Match your `env_label` and `site_label` values to the actual label names in your Prometheus metrics
- Use regular expression operators (`=~`, `!~`) in filters for flexible value matching across regions or environments
- Keep filter configurations consistent across datasets for predictable behavior

## Validation

After applying the Terraform configuration, verify that:

- The stack status shows as enabled by checking the `enabled` output attribute
- The `status` attribute indicates successful onboarding
- Datasets are configured correctly in the Knowledge Graph UI
- Dashboards and alerting rules are installed when `grafana_token` is provided

You can inspect the stack status using Terraform outputs:

```terraform
output "stack_enabled" {
  value       = grafana_asserts_stack.main.enabled
  description = "Whether the Knowledge Graph stack is enabled"
}

output "stack_status" {
  value       = grafana_asserts_stack.main.status
  description = "Current onboarding status of the stack"
}

output "stack_version" {
  value       = grafana_asserts_stack.main.version
  description = "Configuration version number"
}
```

## Related documentation

- [Knowledge Graph documentation](/docs/grafana-cloud/knowledge-graph/)
- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Grafana Terraform Provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs)
- [Cloud Access Policies](/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/)
- [Service accounts](/docs/grafana/latest/administration/service-accounts/)
