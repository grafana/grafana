---
description: Configure suppressed assertions for Knowledge Graph using Terraform
menuTitle: Suppressed assertions
title: Configure suppressed assertions using Terraform
weight: 300
keywords:
  - Terraform
  - Knowledge Graph
  - Suppressed Assertions
  - Alert Suppression
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/suppressed-assertions/
---

# Configure suppressed assertions using Terraform

Suppressed assertions configurations allow you to disable specific alerts or assertions based on label matching in [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/). This is useful for maintenance windows, test environments, or when you want to temporarily suppress certain types of alerts.

For information about suppressing insights in the Knowledge Graph UI, refer to [Suppress insights](/docs/grafana-cloud/knowledge-graph/troubleshoot-infra-apps/suppress-insights/).

## Basic suppressed assertions configuration

Create a file named `suppressed-assertions.tf` and add the following:

```terraform
# Basic suppressed alert configuration for maintenance
resource "grafana_asserts_suppressed_assertions_config" "maintenance_window" {
  provider = grafana.asserts

  name = "MaintenanceWindow"

  match_labels = {
    service     = "api-service"
    maintenance = "true"
  }
}

# Suppress specific alertname during deployment
resource "grafana_asserts_suppressed_assertions_config" "deployment_suppression" {
  provider = grafana.asserts

  name = "DeploymentSuppression"

  match_labels = {
    alertname = "HighLatency"
    job       = "web-service"
    env       = "staging"
  }
}

# Suppress alerts for specific test environment
resource "grafana_asserts_suppressed_assertions_config" "test_environment_suppression" {
  provider = grafana.asserts

  name = "TestEnvironmentSuppression"

  match_labels = {
    alertgroup  = "test.alerts"
    environment = "test"
  }
}
```

## Service-specific suppression configurations

Suppress alerts for specific services during maintenance or operational activities:

```terraform
# Suppress alerts for specific services during maintenance
resource "grafana_asserts_suppressed_assertions_config" "api_service_maintenance" {
  provider = grafana.asserts

  name = "APIServiceMaintenance"

  match_labels = {
    service     = "api-gateway"
    job         = "api-gateway"
    maintenance = "scheduled"
  }
}

# Suppress database alerts during backup operations
resource "grafana_asserts_suppressed_assertions_config" "database_backup" {
  provider = grafana.asserts

  name = "DatabaseBackupSuppression"

  match_labels = {
    service     = "postgresql"
    job         = "postgres-exporter"
    backup_mode = "active"
  }
}

# Suppress monitoring system alerts during updates
resource "grafana_asserts_suppressed_assertions_config" "monitoring_update" {
  provider = grafana.asserts

  name = "MonitoringSystemUpdate"

  match_labels = {
    service = "prometheus"
    job     = "prometheus"
    update  = "in_progress"
  }
}
```

## Environment and team-based suppression

Create suppression rules based on environment or team:

```terraform
# Suppress all alerts for development environment
resource "grafana_asserts_suppressed_assertions_config" "dev_environment" {
  provider = grafana.asserts

  name = "DevelopmentEnvironmentSuppression"

  match_labels = {
    environment = "development"
    team        = "platform"
  }
}

# Suppress alerts for specific team during their maintenance window
resource "grafana_asserts_suppressed_assertions_config" "team_maintenance" {
  provider = grafana.asserts

  name = "TeamMaintenanceWindow"

  match_labels = {
    team        = "backend"
    maintenance = "team_scheduled"
    timezone    = "UTC"
  }
}

# Suppress alerts for staging environment during testing
resource "grafana_asserts_suppressed_assertions_config" "staging_testing" {
  provider = grafana.asserts

  name = "StagingTestingSuppression"

  match_labels = {
    environment = "staging"
    testing     = "automated"
    job         = "integration-tests"
  }
}
```

## Alert type and severity-based suppression

Suppress alerts based on their type or severity:

```terraform
# Suppress low severity alerts during business hours
resource "grafana_asserts_suppressed_assertions_config" "low_severity_business_hours" {
  provider = grafana.asserts

  name = "LowSeverityBusinessHours"

  match_labels = {
    severity = "warning"
    timezone = "business_hours"
  }
}

# Suppress specific alert types during known issues
resource "grafana_asserts_suppressed_assertions_config" "known_issue_suppression" {
  provider = grafana.asserts

  name = "KnownIssueSuppression"

  match_labels = {
    alertname = "HighMemoryUsage"
    service   = "legacy-service"
    issue_id  = "LEG-123"
  }
}

# Suppress infrastructure alerts during planned maintenance
resource "grafana_asserts_suppressed_assertions_config" "infrastructure_maintenance" {
  provider = grafana.asserts

  name = "InfrastructureMaintenance"

  match_labels = {
    alertgroup = "infrastructure.alerts"
    maintenance_type = "planned"
    affected_services = "all"
  }
}
```

## Complex multi-label suppression

Define complex suppression rules with multiple labels:

```terraform
# Complex suppression for multi-service deployments
resource "grafana_asserts_suppressed_assertions_config" "multi_service_deployment" {
  provider = grafana.asserts

  name = "MultiServiceDeploymentSuppression"

  match_labels = {
    deployment_id = "deploy-2024-01-15"
    services      = "api,worker,frontend"
    environment   = "production"
    deployment_type = "blue_green"
  }
}

# Suppress alerts for specific cluster during maintenance
resource "grafana_asserts_suppressed_assertions_config" "cluster_maintenance" {
  provider = grafana.asserts

  name = "ClusterMaintenanceSuppression"

  match_labels = {
    cluster     = "production-cluster-1"
    maintenance = "cluster_upgrade"
    affected_nodes = "all"
    estimated_duration = "2h"
  }
}

# Suppress alerts for specific region during network issues
resource "grafana_asserts_suppressed_assertions_config" "regional_network_issue" {
  provider = grafana.asserts

  name = "RegionalNetworkIssueSuppression"

  match_labels = {
    region      = "us-west-2"
    issue_type  = "network"
    affected_services = "external_dependencies"
    incident_id = "NET-456"
  }
}
```

## Resource reference

### `grafana_asserts_suppressed_assertions_config`

Manage Knowledge Graph suppressed assertions configurations through the Grafana API.

#### Arguments

| Name           | Type          | Required | Description                                                                                                        |
| -------------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `name`         | `string`      | Yes      | The name of the suppressed assertions configuration. This field is immutable and forces recreation if changed.     |
| `match_labels` | `map(string)` | No       | Labels to match for this suppressed assertions configuration. Used to determine which alerts should be suppressed. |

#### Example

```terraform
resource "grafana_asserts_suppressed_assertions_config" "example" {
  provider = grafana.asserts

  name = "ExampleSuppression"

  match_labels = {
    alertname = "TestAlert"
    env       = "development"
  }
}
```

## Best practices

### Suppression strategy

- Use suppression rules for temporary situations rather than permanent solutions
- Document the reason for suppression in your Terraform configuration comments
- Set expiration dates or reminders to review suppression rules
- Prefer fixing alert thresholds over suppressing recurring false positives

### Label match rules

- Be specific with match labels to avoid suppressing unintended alerts
- Test suppression rules in non-production environments first
- Use descriptive names that indicate the purpose and scope of the suppression
- Include relevant context in labels (for example, incident IDs, maintenance windows)

### Lifecycle management

- Regularly review active suppression rules to ensure they're still needed
- Remove or update suppression rules after maintenance windows or deployments
- Use version control to track when suppression rules were added and why
- Consider using time-based automation to enable or disable suppression rules

## Validation

After applying the Terraform configuration, verify that:

- Suppressed assertions configurations are active in your Knowledge Graph instance
- Configurations appear in the Knowledge Graph UI under **Observability > Rules > Suppress**
- Matching alerts are properly suppressed
- Suppression rules don't affect unintended alerts

## Related documentation

- [Suppress insights in Knowledge Graph](/docs/grafana-cloud/knowledge-graph/troubleshoot-infra-apps/suppress-insights/)
- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Configure notifications](/docs/grafana-cloud/knowledge-graph/configure/notifications/)
