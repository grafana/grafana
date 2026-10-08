---
aliases:
  - ./observability-as-code/
  - ./observability-as-code/get-started/
  - ../observability-as-code/
description: Deploy, configure and provision Grafana with as-code workflows.
keywords:
  - observability
  - configuration
  - as code
  - dashboards
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
    - cloud
menuTitle: As code
title: Deploy, configure and provision Grafana with as-code workflows
hero:
  title: Configure and provision Grafana with as-code workflows
  level: 1
  width: 100
  height: 100
  description: Manage resources, including folders and dashboards, and configurations with as-code workflows.
cards:
  items:
    - title: Foundation SDK
      height: 24
      href: ./foundation-sdk/
      description: Define Grafana dashboards and resources using familiar programming languages like Go, TypeScript, Python, Java, and PHP. Use it in conjunction with `gcx` to push your programmatically generated resources.
    - title: Git Sync
      height: 24
      href: ./git-sync/
      description: Store your dashboard files in a GitHub repository and synchronize those changes with your Grafana instance, enabling version control, branching, and pull requests directly from Grafana.
    - title: On-prem file provisioning
      height: 24
      href: ./provision-resources/
      description: Include resources, including folders and dashboard JSON files, that are stored in a local file system.
    - title: Terraform
      height: 24
      href: ./terraform/
      description: Use the Grafana Terraform provider to manage dashboards, alerts, and more.
    - title: Ansible
      height: 24
      href: ./ansible/
      description: Use the Grafana Ansible collection to manage Grafana Cloud resources, including folders and cloud stacks.
    - title: Grafana Operator
      height: 24
      href: ./grafana-operator/
      description: Manage dashboards, folders, and data sources through Kubernetes Custom Resources.
    - title: Infrastructure as code tools
      height: 24
      href: ./compare-as-code-tools/
      description: Compare the Infrastructure as code tools available for Grafana Cloud, including who each tool is recommended for and its known limitations.
  title_class: pt-0 lh-1
weight: 600
canonical: https://grafana.com/docs/grafana/latest/as-code/
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

**Observability as code** lets you apply code management best practices to your observability resources. By representing Grafana resources as code, you can integrate them into existing infrastructure-as-code workflows and apply standard development practices. Instead of manually configuring dashboards or settings through the Grafana UI, you can:

- Write configurations in code: Define dashboards in JSON or other supported formats.
- Sync your Grafana setup to GitHub: Track changes, collaborate, and roll back updates using Git and GitHub, or other remote sources.
- Automate with CI/CD: Integrate Grafana directly into your development and deployment pipelines.
- Standardize workflows: Ensure consistency across your teams by using repeatable, codified processes for managing Grafana resources.

Historically, managing Grafana as code involved various community and Grafana Labs tools, but lacked a single, cohesive story. Grafana 12 introduces foundational improvements, including new versioned APIs and official tooling, to provide a clearer path forward:

- This approach requires handling HTTP requests and responses but provides complete control over resource management.
- `gcx`, Git Sync, and the Foundation SDK are all built on top of these APIs.
- To understand Dashboard Schemas accepted by the APIs, refer to the [JSON models documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/view-dashboard-json-model/).

To manage Grafana resources from the command line or with AI agents, refer to the [Grafana CLI](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/).

In Grafana Cloud, you can use **Infrastructure as code** to declaratively create and manage dashboards via configuration files in source code, and incorporate them efficiently into your own use cases. This enables you to review code, reuse it, and create better workflows. Infrastructure as code tools include Terraform, Ansible, the Grafana Operator, and Grizzly.

{{< admonition type="note" >}}

For basic configuration provisioning refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning).

{{< /admonition >}}

## Explore

{{< card-grid key="cards" type="simple" >}}

## Additional as-code tools

If you're already using established Infrastructure as code or other configuration management tools, Grafana offers integrations to manage resources within your existing workflows.

- [Crossplane](https://github.com/grafana/crossplane-provider-grafana) lets you manage Grafana resources using Kubernetes manifests with the Grafana Crossplane provider.
- [Grafonnet](https://github.com/grafana/grafonnet) is a Jsonnet library for generating Grafana dashboard JSON definitions programmatically. **Grafonnet is not officially supported by Grafana. Instead, use the [Foundation SDK](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/foundation-sdk/)** to create dashboards as code.
