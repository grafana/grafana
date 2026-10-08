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
menuTitle: As code and Provisioning
title: Deploy, configure and provision Grafana with as-code workflows
hero:
  title: Configure and provision Grafana with as-code workflows
  level: 1
  width: 100
  height: 100
  description: Manage resources, including folders and dashboards, and configurations with as-code workflows.
cards:
  items:
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
    - title: Foundation SDK
      height: 24
      href: ./foundation-sdk/
      description: Define Grafana dashboards and resources using familiar programming languages like Go, TypeScript, Python, Java, and PHP. Use it in conjunction with `gcx` to push your programmatically generated resources.
  title_class: pt-0 lh-1
weight: 900
canonical: https://grafana.com/docs/grafana/latest/as-code/
---

{{< docs/hero-simple key="hero" >}}

---

# Overview of Provisioning and as Code

**As code** lets you apply code management best practices to your observability resources. By representing Grafana resources as code, you can integrate them into existing infrastructure-as-code workflows and apply standard development practices. Instead of manually configuring dashboards or settings through the Grafana UI, you can:

- Write configurations in code: Define dashboards in JSON or other supported formats.
- Sync your Grafana setup to GitHub: Track changes, collaborate, and roll back updates using Git and GitHub, or other remote sources.
- Automate with CI/CD: Integrate Grafana directly into your development and deployment pipelines.
- Standardize workflows: Ensure consistency across your teams by using repeatable, codified processes for managing Grafana resources.

{{< admonition type="note" >}}

For basic configuration provisioning refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning).

{{< /admonition >}}

## Explore

{{< card-grid key="cards" type="simple" >}}

## A new approach

Historically, managing Grafana as code involved various community and Grafana Labs tools, but lacked a single, cohesive story. Grafana 12 introduces foundational improvements, including new versioned APIs and official tooling, to provide a clearer path forward:

- This approach requires handling HTTP requests and responses but provides complete control over resource management.
- `gcx`, Git Sync, and the Foundation SDK are all built on top of these APIs.
- To understand Dashboard Schemas accepted by the APIs, refer to the [JSON models documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/view-dashboard-json-model/).

In Grafana Cloud, you can create and manage dashboards via configuration files in source code, and incorporate them efficiently into your own use cases. This enables you to review code, reuse it, and create better workflows. Infrastructure as code tools include Terraform, Ansible, the Grafana Operator, and Grizzly.

{{< admonition type="note" >}}

Most of the tools defined here can be used with one another.

{{< /admonition >}}

## as Code for Kubernetes: Grafana Operator and Grafana Crossplane provider

The Grafana Operator is a Kubernetes operator that can provision, manage, and operate Grafana instances and their associated resources within Kubernetes through Custom Resources. This Kubernetes-native tool eases the administration of Grafana, including managing dashboards, data sources, and folders. It also automatically syncs the Kubernetes Custom resources and the actual resources in the Grafana Instance. It supports leveraging Grafonnet for generating Grafana dashboard definitions for seamless dashboard configuration as code.

To get started, see the [quickstart guides for the Grafana Operator](https://grafana.com/docs/grafana-cloud/as-code/grafana-operator) or check out the [Grafana Operator's documentation](https://grafana.github.io/grafana-operator/).

### Grafana Crossplane provider

[Grafana Crossplane provider](https://github.com/grafana/crossplane-provider-grafana) is built using Terrajet and provides support for all resources supported by the Grafana Terraform provider. It enables you to define Grafana resources as Kubernetes manifests and it also help users who build their GitOps pipelines around Kubernetes manifests using tools like ArgoCD.

To get started with the Grafana Crossplane provider, install Crossplane in the Kubernetes cluster and use this command to install the provider:

```shell
kubectl crossplane install provider grafana/crossplane-provider-grafana:v0.1.0
```

During installation of the provider, CRDs for all the resources supported by the Terraform provider are added to the cluster so users can begin defining their Grafana resources as Kubernetes custom resources. The Crossplane provider ensures that whatever is defined in the custom resource definitions is what is visible in Grafana UI. If any changes are made directly in the UI, the changes will be discarded when the provider resyncs. This helps ensure that whatever is defined via code in the cluster will be the source of truth for Grafana resources.

To get started, refer to the examples folder in the Grafana Crossplane repository.

The Grafana Crossplane provider is intended for existing Crossplane users looking to manage Grafana resources from within Kubernetes and as Kubernetes manifests for the GitOps pipelines. To use the Crossplane provider, you must have the Crossplane CLI and Crossplane installed in the Kubernetes cluster. Note that the Crossplane provider is in an alpha stage, so it has not reached a stable state yet.

## Additional as-code tools

[Grafonnet](https://github.com/grafana/grafonnet) is a Jsonnet library for generating Grafana dashboard JSON definitions programmatically. **Grafonnet is not officially supported by Grafana. Instead, use the [Foundation SDK](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/foundation-sdk/)** to create dashboards as code.
