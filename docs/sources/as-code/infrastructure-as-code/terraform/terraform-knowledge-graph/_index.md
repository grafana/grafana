---
aliases:
  - ./knowledge-graph-slo/ # /docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/knowledge-graph-slo/
cards:
  items:
    - description: Learn how to set up Terraform provider and configure your environment for managing Knowledge Graph resources.
      height: 24
      href: ./getting-started/
      title: Get started with Terraform
    - description: Configure notification alerts to manage how alerts are processed and routed in your Knowledge Graph.
      height: 24
      href: ./notification-alerts/
      title: Notification alerts
    - description: Define suppression rules to temporarily disable specific alerts during maintenance windows or testing.
      height: 24
      href: ./suppressed-assertions/
      title: Suppressed assertions
    - description: Create custom entity models and define how entities are discovered based on Prometheus queries.
      height: 24
      href: ./custom-model-rules/
      title: Custom model rules
    - description: Configure log data correlation with entities using data source mappings and filtering options.
      height: 24
      href: ./log-configurations/
      title: Log configurations
    - description: Configure trace data correlation with entities using data source mappings and filtering options.
      height: 24
      href: ./trace-configurations/
      title: Trace configurations
    - description: Set up profile data correlation with entities using data source mappings and filtering options.
      height: 24
      href: ./profile-configurations/
      title: Profile configurations
    - description: Set custom thresholds for request, resource, and health assertions to monitor your services.
      height: 24
      href: ./thresholds/
      title: Thresholds
    - description: Define custom Prometheus recording and alerting rules that are evaluated against your metrics data.
      height: 24
      href: ./prometheus-rules/
      title: Prometheus rules
  title_class: pt-0 lh-1
description: Manage Grafana Cloud Knowledge Graph using Terraform
hero:
  description: Use Terraform to manage Grafana Cloud Knowledge Graph resources as code. Configure notification alerts, suppressed assertions, custom model rules, log configurations, and threshold configurations using infrastructure as code best practices.
  level: 1
  title: Manage Knowledge Graph using Terraform
menuTitle: Manage Knowledge Graph in Grafana Cloud using Terraform
title: Manage Knowledge Graph in Grafana Cloud using Terraform
weight: 130
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Knowledge Graph
  - Alert Configuration
  - Suppressed Assertions
  - Custom Model Rules
  - Log Configuration
  - Trace Configuration
  - Profile Configuration
  - Threshold Configuration
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

Terraform enables you to manage [Grafana Cloud Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) resources using infrastructure as code. With Terraform, you can define, version control, and deploy Knowledge Graph configurations including alert rules, suppression policies, entity models, log, trace, and profile correlations, and thresholds.

## Explore

{{< card-grid key="cards" type="simple" >}}

---

## Related resources

- [Grafana Terraform Provider Documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs)
- [Knowledge Graph Documentation](/docs/grafana-cloud/knowledge-graph/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
