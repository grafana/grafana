---
description: Manage custom Prometheus recording and alerting rules for Knowledge Graph using Terraform
menuTitle: Prometheus rules
title: Manage Prometheus rules using Terraform
weight: 450
keywords:
  - Terraform
  - Knowledge Graph
  - Prometheus rules
  - Recording rules
  - Alerting rules
  - PromQL
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/prometheus-rules/
---

# Manage Prometheus rules using Terraform

Prometheus rules in the [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) allow you to define custom recording and alerting rules that are evaluated against your metrics data. Recording rules pre-compute frequently used or computationally expensive expressions and save the results as new time series. Alerting rules define conditions that, when met, trigger alerts.

Using the `grafana_asserts_prom_rule_file` resource, you can manage these rules as code, enabling version control, review processes, and consistent deployments across environments.

## Before you begin

To manage Prometheus rules using Terraform, you need:

- A Grafana Cloud stack with Knowledge Graph enabled
- [Terraform configured for Knowledge Graph](../getting-started/)
- An understanding of PromQL and Prometheus rule concepts

## Create a basic recording rule

Recording rules allow you to pre-compute PromQL expressions and store the results as new metrics. This is useful for expensive queries that you run frequently.

Create a file named `prom-rules.tf` and add the following:

```terraform
# Basic recording rule for request rate
resource "grafana_asserts_prom_rule_file" "request_rates" {
  provider = grafana.asserts

  name   = "request-rates"
  active = true

  group {
    name     = "request_rate_rules"
    interval = "30s"

    rule {
      record = "job:http_requests_total:rate5m"
      expr   = "sum(rate(http_requests_total[5m])) by (job)"

      labels = {
        aggregation = "job"
        source      = "custom"
      }
    }
  }
}
```

## Create alerting rules

Alerting rules define conditions that trigger alerts when met. Use the `alert` field instead of `record` to define an alerting rule.

```terraform
# Alerting rules for service health
resource "grafana_asserts_prom_rule_file" "service_alerts" {
  provider = grafana.asserts

  name   = "service-health-alerts"
  active = true

  group {
    name     = "service_health"
    interval = "1m"

    rule {
      alert    = "HighErrorRate"
      expr     = "sum(rate(http_requests_total{code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) > 0.05"
      duration = "5m"

      labels = {
        severity = "critical"
        team     = "platform"
      }

      annotations = {
        summary     = "High error rate detected"
        description = "Error rate is above 5% for the last 5 minutes"
        runbook_url = "https://docs.example.com/runbooks/high-error-rate"
      }
    }

    rule {
      alert    = "ServiceDown"
      expr     = "up == 0"
      duration = "2m"

      labels = {
        severity = "critical"
      }

      annotations = {
        summary     = "Service is down"
        description = "{{ $labels.job }} has been down for more than 2 minutes"
      }
    }
  }
}
```

## Create multiple rule groups

Organize related rules into groups with their own evaluation intervals:

```terraform
# Multiple rule groups for comprehensive monitoring
resource "grafana_asserts_prom_rule_file" "comprehensive_rules" {
  provider = grafana.asserts

  name   = "comprehensive-monitoring"
  active = true

  # Latency recording rules
  group {
    name     = "latency_recording"
    interval = "30s"

    rule {
      record = "job:http_request_duration_seconds:p99"
      expr   = "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (job, le))"

      labels = {
        quantile = "0.99"
      }
    }

    rule {
      record = "job:http_request_duration_seconds:p95"
      expr   = "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (job, le))"

      labels = {
        quantile = "0.95"
      }
    }

    rule {
      record = "job:http_request_duration_seconds:p50"
      expr   = "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (job, le))"

      labels = {
        quantile = "0.50"
      }
    }
  }

  # Latency alerting rules
  group {
    name     = "latency_alerts"
    interval = "1m"

    rule {
      alert    = "HighP99Latency"
      expr     = "job:http_request_duration_seconds:p99 > 1"
      duration = "5m"

      labels = {
        severity = "warning"
      }

      annotations = {
        summary     = "High P99 latency detected"
        description = "P99 latency for {{ $labels.job }} is above 1 second"
      }
    }

    rule {
      alert    = "CriticalLatency"
      expr     = "job:http_request_duration_seconds:p99 > 5"
      duration = "2m"

      labels = {
        severity = "critical"
      }

      annotations = {
        summary     = "Critical latency detected"
        description = "P99 latency for {{ $labels.job }} is above 5 seconds"
      }
    }
  }

  # Throughput rules
  group {
    name     = "throughput_rules"
    interval = "1m"

    rule {
      record = "job:http_requests:rate1m"
      expr   = "sum(rate(http_requests_total[1m])) by (job)"
    }

    rule {
      alert    = "LowThroughput"
      expr     = "job:http_requests:rate1m < 10"
      duration = "10m"

      labels = {
        severity = "warning"
      }

      annotations = {
        summary     = "Low throughput detected"
        description = "Request rate for {{ $labels.job }} is below 10 requests per second"
      }
    }
  }
}
```

## Create resource utilization rules

Define rules to monitor resource utilization across your infrastructure:

```terraform
# Resource utilization monitoring rules
resource "grafana_asserts_prom_rule_file" "resource_utilization" {
  provider = grafana.asserts

  name   = "resource-utilization"
  active = true

  group {
    name     = "cpu_rules"
    interval = "30s"

    rule {
      record = "instance:cpu_utilization:avg5m"
      expr   = "1 - avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) by (instance)"
    }

    rule {
      alert    = "HighCPUUtilization"
      expr     = "instance:cpu_utilization:avg5m > 0.85"
      duration = "10m"

      labels = {
        severity = "warning"
        resource = "cpu"
      }

      annotations = {
        summary     = "High CPU utilization"
        description = "CPU utilization on {{ $labels.instance }} is above 85%"
      }
    }

    rule {
      alert    = "CriticalCPUUtilization"
      expr     = "instance:cpu_utilization:avg5m > 0.95"
      duration = "5m"

      labels = {
        severity = "critical"
        resource = "cpu"
      }

      annotations = {
        summary     = "Critical CPU utilization"
        description = "CPU utilization on {{ $labels.instance }} is above 95%"
      }
    }
  }

  group {
    name     = "memory_rules"
    interval = "30s"

    rule {
      record = "instance:memory_utilization:ratio"
      expr   = "1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)"
    }

    rule {
      alert    = "HighMemoryUtilization"
      expr     = "instance:memory_utilization:ratio > 0.85"
      duration = "10m"

      labels = {
        severity = "warning"
        resource = "memory"
      }

      annotations = {
        summary     = "High memory utilization"
        description = "Memory utilization on {{ $labels.instance }} is above 85%"
      }
    }
  }

  group {
    name     = "disk_rules"
    interval = "1m"

    rule {
      record = "instance:disk_utilization:ratio"
      expr   = "1 - (node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"})"
    }

    rule {
      alert    = "DiskSpaceLow"
      expr     = "instance:disk_utilization:ratio > 0.80"
      duration = "15m"

      labels = {
        severity = "warning"
        resource = "disk"
      }

      annotations = {
        summary     = "Disk space running low"
        description = "Disk utilization on {{ $labels.instance }} is above 80%"
      }
    }
  }
}
```

## Create Kubernetes-specific rules

Define rules for monitoring Kubernetes workloads:

```terraform
# Kubernetes workload monitoring rules
resource "grafana_asserts_prom_rule_file" "kubernetes_rules" {
  provider = grafana.asserts

  name   = "kubernetes-workloads"
  active = true

  group {
    name     = "kubernetes_pod_rules"
    interval = "30s"

    rule {
      record = "namespace:pod_restarts:rate1h"
      expr   = "sum(increase(kube_pod_container_status_restarts_total[1h])) by (namespace)"
    }

    rule {
      alert    = "PodCrashLooping"
      expr     = "rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 3"
      duration = "5m"

      labels = {
        severity = "warning"
      }

      annotations = {
        summary     = "Pod is crash looping"
        description = "Pod {{ $labels.namespace }}/{{ $labels.pod }} is restarting frequently"
      }
    }

    rule {
      alert    = "PodNotReady"
      expr     = "kube_pod_status_ready{condition=\"true\"} == 0"
      duration = "10m"

      labels = {
        severity = "warning"
      }

      annotations = {
        summary     = "Pod not ready"
        description = "Pod {{ $labels.namespace }}/{{ $labels.pod }} has been in a non-ready state for more than 10 minutes"
      }
    }
  }

  group {
    name     = "kubernetes_deployment_rules"
    interval = "1m"

    rule {
      record = "deployment:replicas_unavailable:count"
      expr   = "kube_deployment_status_replicas_unavailable"
    }

    rule {
      alert    = "DeploymentReplicasMismatch"
      expr     = "kube_deployment_spec_replicas != kube_deployment_status_replicas_available"
      duration = "10m"

      labels = {
        severity = "warning"
      }

      annotations = {
        summary     = "Deployment replicas mismatch"
        description = "Deployment {{ $labels.namespace }}/{{ $labels.deployment }} has not matched the expected number of replicas for more than 10 minutes"
      }
    }
  }

  group {
    name     = "kubernetes_node_rules"
    interval = "1m"

    rule {
      alert    = "NodeNotReady"
      expr     = "kube_node_status_condition{condition=\"Ready\",status=\"true\"} == 0"
      duration = "5m"

      labels = {
        severity = "critical"
      }

      annotations = {
        summary     = "Kubernetes node not ready"
        description = "Node {{ $labels.node }} has been unready for more than 5 minutes"
      }
    }

    rule {
      alert    = "NodeMemoryPressure"
      expr     = "kube_node_status_condition{condition=\"MemoryPressure\",status=\"true\"} == 1"
      duration = "5m"

      labels = {
        severity = "warning"
      }

      annotations = {
        summary     = "Node under memory pressure"
        description = "Node {{ $labels.node }} is under memory pressure"
      }
    }
  }
}
```

## Use conditional rule disabling

Disable specific rules in certain groups using the `disable_in_groups` field:

```terraform
# Rules with conditional disabling
resource "grafana_asserts_prom_rule_file" "conditional_rules" {
  provider = grafana.asserts

  name   = "conditional-alerting"
  active = true

  group {
    name     = "production_alerts"
    interval = "1m"

    rule {
      alert    = "HighErrorRate"
      expr     = "sum(rate(http_requests_total{code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) > 0.01"
      duration = "5m"

      labels = {
        severity    = "critical"
        environment = "production"
      }

      annotations = {
        summary     = "High error rate in production"
        description = "Error rate is above 1% for the last 5 minutes"
      }

      # Disable this rule in staging group
      disable_in_groups = ["staging_alerts"]
    }
  }

  group {
    name     = "staging_alerts"
    interval = "1m"

    rule {
      alert    = "HighErrorRate"
      expr     = "sum(rate(http_requests_total{code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) > 0.10"
      duration = "10m"

      labels = {
        severity    = "warning"
        environment = "staging"
      }

      annotations = {
        summary     = "High error rate in staging"
        description = "Error rate is above 10% for the last 10 minutes"
      }
    }
  }
}
```

## Manage inactive rule files

Temporarily disable an entire rules file without deleting it:

```terraform
# Inactive rules file (not evaluated)
resource "grafana_asserts_prom_rule_file" "experimental_rules" {
  provider = grafana.asserts

  name   = "experimental-rules"
  active = false  # Rules are not evaluated

  group {
    name     = "experimental_alerts"
    interval = "1m"

    rule {
      alert    = "ExperimentalAlert"
      expr     = "some_experimental_metric > 100"
      duration = "5m"

      labels = {
        severity = "info"
      }

      annotations = {
        summary = "Experimental alert triggered"
      }
    }
  }
}
```

## Resource reference

### `grafana_asserts_prom_rule_file`

Manage Prometheus recording and alerting rules through the Knowledge Graph API. This resource allows you to create and manage custom Prometheus rules that are evaluated against your metrics data.

#### Arguments

| Name     | Type           | Required | Description                                                                                      |
| -------- | -------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `name`   | `string`       | Yes      | The name of the Prometheus rules file. This field is immutable and forces recreation if changed. |
| `active` | `bool`         | No       | Whether the rules file is active. Inactive rules are not evaluated. Defaults to `true`.          |
| `group`  | `list(object)` | Yes      | List of Prometheus rule groups. Refer to [group block](#group-block) for details.                |

#### Group block

Each `group` block contains a set of related rules with a shared evaluation interval:

| Name       | Type           | Required | Description                                                                                                           |
| ---------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`     | `string`       | Yes      | The name of the rule group (for example, `latency_monitoring`).                                                       |
| `interval` | `string`       | No       | Evaluation interval for this group (for example, `30s`, `1m`). If not specified, uses the global evaluation interval. |
| `rule`     | `list(object)` | Yes      | List of Prometheus rules in this group. Refer to [rule block](#rule-block) for details.                               |

#### Rule block

Each `rule` block defines a recording or alerting rule. Either `record` or `alert` must be specified, but not both:

| Name                | Type          | Required    | Description                                                                                                                            |
| ------------------- | ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `record`            | `string`      | Conditional | The name of the time series to output for recording rules. Required if `alert` is not specified.                                       |
| `alert`             | `string`      | Conditional | The name of the alert for alerting rules. Required if `record` is not specified.                                                       |
| `expr`              | `string`      | Yes         | The PromQL expression to evaluate.                                                                                                     |
| `duration`          | `string`      | No          | How long the condition must be true before firing the alert (for example, `5m`). Only for alerting rules. Maps to `for` in Prometheus. |
| `labels`            | `map(string)` | No          | Labels to attach to the resulting time series or alert.                                                                                |
| `annotations`       | `map(string)` | No          | Annotations to add to alerts (for example, `summary`, `description`). Only applicable for alerting rules.                              |
| `disable_in_groups` | `set(string)` | No          | List of group names where this rule should be disabled. Useful for conditional rule enablement.                                        |

#### Example

```terraform
resource "grafana_asserts_prom_rule_file" "example" {
  provider = grafana.asserts

  name   = "example-rules"
  active = true

  group {
    name     = "example_group"
    interval = "1m"

    # Recording rule
    rule {
      record = "job:http_requests:rate5m"
      expr   = "sum(rate(http_requests_total[5m])) by (job)"
    }

    # Alerting rule
    rule {
      alert    = "HighErrorRate"
      expr     = "job:http_errors:rate5m > 0.05"
      duration = "5m"

      labels = {
        severity = "critical"
      }

      annotations = {
        summary     = "High error rate detected"
        description = "Error rate for {{ $labels.job }} is above 5%"
      }
    }
  }
}
```

## Best practices

### Rule organization

- Group related rules together in the same rule group
- Use descriptive names for rules that indicate their purpose
- Separate recording rules from alerting rules into different groups when they have different evaluation needs
- Use consistent naming conventions for recorded metrics, such as `level:metric:operation`

### Recording rules

- Use recording rules for expensive queries that are run frequently
- Pre-compute aggregations that are used by multiple dashboards or alerts
- Choose appropriate evaluation intervals based on how frequently the data changes
- Follow Prometheus naming conventions, such as `job:metric:aggregation`

### Alerting rules

- Set appropriate `duration` values to avoid flapping alerts
- Include meaningful labels like `severity` and `team` for routing
- Provide comprehensive annotations including `summary`, `description`, and `runbook_url`
- Use template variables in annotations such as `{{ $labels.job }}` to provide context

### Performance considerations

- Avoid overly complex PromQL expressions that may timeout
- Use appropriate evaluation intervals; don't evaluate faster than needed
- Test your PromQL queries in Grafana before adding them to Terraform
- Consider the cardinality impact of recording rules that create new time series

### Testing and validation

- Test rules in a non-production environment before deploying to production
- Use the `active = false` flag to stage rules without evaluating them
- Monitor the performance impact of new rules after deployment
- Review and prune unused rules periodically

## Validation

After applying the Terraform configuration, verify that:

- Rule files are created and visible in the Knowledge Graph rules configuration
- Recording rules are generating the expected time series
- Alerting rules are evaluating correctly
- Alert thresholds trigger notifications as expected
- Rule evaluation times are within acceptable ranges
- No errors appear in the rule evaluation logs

## Troubleshooting

### Rules not being evaluated

If your rules are not being evaluated:

1. Verify that `active = true` is set on the rule file
2. Check that the rule filename follows naming validation rules (alphanumeric, hyphens, underscores)
3. Ensure the PromQL expression is valid by testing it in Grafana

### Recording rule not producing data

If a recording rule is not producing data:

1. Verify the source metrics exist and have data
2. Check the PromQL expression returns results
3. Ensure the evaluation interval is appropriate
4. Review the rule evaluation logs for errors

### Alerts not firing

If alerting rules are not firing:

1. Verify the condition is actually met by querying the expression manually
2. Check that the `duration` period has elapsed
3. Ensure the alerting system is properly configured to receive alerts
4. Review annotation templates for syntax errors

### Import error when recreating rules

If you receive errors when recreating rules:

- The `name` field is immutable and forces recreation if changed
- Ensure no conflicting rule files exist with the same name
- Use `terraform import` to import existing resources if needed

## Related documentation

- [Get started with Terraform for Knowledge Graph](../getting-started/)
- [Create custom model rules using Terraform](../custom-model-rules/)
- [Prometheus recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [Prometheus alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
