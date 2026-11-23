---
description: Manage dashboards, saved queries, secrets, and plugins with the Grafana Terraform provider.
keywords:
  - Infrastructure as Code
  - Terraform
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Manage Grafana resources
title: Manage Grafana resources with Terraform
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/terraform/grafana-resources/
---

# Manage Grafana resources with Terraform

Use these guides to manage resources inside a Grafana instance or Grafana Cloud stack with Terraform. Some resources are only available in Grafana Cloud or Grafana Enterprise. Each guide lists its requirements.

{{< section withDescriptions="true" >}}

## Guides in other sections

The following Grafana resources document Terraform in their own sections:

- **Alerting:** [Use Terraform to provision alerting resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/) — Provision alert rules, contact points, notification templates, mute timings, and notification policy trees, and optionally allow editing them in the Grafana UI.
- **Git Sync:** [Set up Git Sync with Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-terraform/) — Create the connection and repository resources that synchronize a Git repository with Grafana.
- **Role-based access control:** [Provisioning RBAC with Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-terraform-provisioning/) — Set basic roles for users and service accounts, create custom roles, and assign fixed or custom roles to users, teams, and service accounts.

For the full list across Grafana and Grafana Cloud, refer to the [Terraform guides by area](../#terraform-guides-by-area).
