---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
menuTitle: Terraform
title: Grafana Terraform provider
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/
---

# Grafana Terraform provider

The [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest) provisions configuration management resources for Grafana. You can use it to manage resources such as dashboards, data sources, plugins, folders, organizations or alert notification channels.

Use the following guides to get started using Terraform to manage your Grafana Cloud stack:

- [Creating and managing a Grafana Cloud stack using Terraform](terraform-cloud-stack/) describes how to create a Grafana Cloud stack and add a data source and dashboard using [Terraform](https://www.terraform.io/).
- [Creating and managing dashboards using Terraform and GitHub Actions](dashboards-github-action/) describes how to create and manage multiple dashboards represented as JSON source code for Grafana using [Terraform](https://www.terraform.io/) and [GitHub Actions](https://github.com/features/actions).
- [Managing IRM on Grafana Cloud using Terraform](terraform-oncall/) describes how to connect an integration to Grafana IRM, configure escalation policies, and add your on-call schedule using [Terraform](https://www.terraform.io/).
- [Managing Fleet Management in Grafana Cloud using Terraform](https://grafana.com/docs/grafana-cloud/as-code/infrastructure-as-code/terraform/terraform-fleet-management/) describes how to create collectors and pipelines in Grafana Fleet Management using [Terraform](https://www.terraform.io/).
- [Managing Frontend Observability in Grafana Cloud using Terraform](https://grafana.com/docs/grafana-cloud/as-code/infrastructure-as-code/terraform/terraform-frontend-observability/) describes how to manage resources in Frontend Observability using [Terraform](https://www.terraform.io/).
- [Manage Cloud Provider Observability in Grafana Cloud using Terraform](terraform-cloud-provider-o11y/) describes how to manage Amazon CloudWatch and Microsoft Azure resources in Cloud Provider Observability using Terraform.
- [Manage Knowledge Graph in Grafana Cloud using Terraform](terraform-knowledge-graph/) describes how to create and manage notification alerts, suppressed assertions, custom model rules, log, trace, and profile configurations, threshold configurations, and Prometheus rules in Grafana Cloud Knowledge Graph using [Terraform](https://www.terraform.io/).
- [Install plugins in Grafana Cloud using Terraform](terraform-plugins) describes how to install plugins in Grafana Cloud using [Terraform](https://www.terraform.io/).
