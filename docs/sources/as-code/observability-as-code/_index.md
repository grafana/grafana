---
description: Overview of Observability as code including description, key features, and explanation of benefits.
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
title: Observability as code
weight: 100
cards:
  items:
    - title: Grafana CLI
      height: 24
      href: ./grafana-cli/
      description: Grafana CLI (`grafanactl`) is a command-line tool designed to simplify interaction with Grafana instances using the new REST APIs. You can authenticate, manage multiple environments, and perform administrative tasks from the terminal. It's suitable for CI/CD pipelines, local development, or free-form tasks.
    - title: Foundation SDK
      height: 24
      href: ./foundation-sdk/
      description: The Grafana Foundation SDK is a set of tools, types, and libraries that let you define Grafana dashboards and resources using familiar programming languages like Go, TypeScript, Python, Java, and PHP. Use it in conjunction with `grafanactl` to push your programmatically generated resources.
    - title: JSON schema v2
      height: 24
      href: ./schema-v2/
      description: Grafana dashboards are represented as JSON objects that store metadata, panels, variables, and settings. Observability as Code works with all versions of the JSON model, and it's fully compatible with version 2.
    - title: Git Sync (private preview)
      height: 24
      href: ./provision-resources/intro-git-sync/
      description: Git Sync lets you store your dashboard files in a GitHub repository and synchronize those changes with your Grafana instance, enabling version control, branching, and pull requests directly from Grafana.
    - title: File provisioning (private preview)
      height: 24
      href: ./provision-resources/
      description: File provisioning in Grafana lets you include resources, including folders and dashboard JSON files, that are stored in a local file system.
  title_class: pt-0 lh-1
hero:
  title: Observability as Code
  description: Using Observability as Code, you can version, automate, and scale Grafana configurations, including dashboards and observability workflows.
  height: 110
  level: 1
  width: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/
aliases:
  - ../observability-as-code/ # /docs/grafana/next/observability-as-code/
  - ../observability-as-code/get-started/
refs:
  infra-as-code:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/as-code/infrastructure-as-code/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/as-code/infrastructure-as-code/
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

Grafana provides a suite of tools for **Observability as code** to help you manage your Grafana resources programmatically and at scale. This approach lets you define dashboards, data sources, and other configurations in code, enabling version control, automated testing, and reliable deployments through CI/CD pipelines. You can apply code management best practices to your observability resources, and integrate them into existing infrastructure-as-code workflows.

Historically, managing Grafana as code involved various community and Grafana Labs tools, but lacked a single, cohesive story. Grafana 12 introduces foundational improvements, including new versioned APIs and official tooling, to provide a clearer path forward:

- This approach requires handling HTTP requests and responses but provides complete control over resource management.
- `grafanactl`, Git Sync, and the Foundation SDK are all built on top of these APIs.
- To understand Dashboard Schemas accepted by the APIs, refer to the [JSON models documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/).

## Explore

{{< card-grid key="cards" type="simple" >}}

## Additional Observability as code tools

If you're already using established [Infrastructure as code](ref:infra-as-code) or other configuration management tools, Grafana offers integrations to manage resources within your existing workflows.

- [Terraform](https://grafana.com/docs/grafana-cloud/as-code/infrastructure-as-code/terraform/)
  - Use the Grafana Terraform provider to manage dashboards, alerts, and more.
  - Understand how to define and deploy resources using HCL/JSON configurations.
- [Ansible](https://grafana.com/docs/grafana-cloud/as-code/infrastructure-as-code/ansible/)
  - Learn to use the Grafana Ansible collection to manage Grafana Cloud resources, including folders and cloud stacks.
  - Write playbooks to automate resource provisioning through the Grafana API.
- [Grafana Operator](https://grafana.com/docs/grafana-cloud/as-code/infrastructure-as-code/grafana-operator/)
  - Utilize Kubernetes-native management with the Grafana Operator.
  - Manage dashboards, folders, and data sources via Kubernetes Custom Resources.
  - Integrate with GitOps workflows for seamless version control and deployment.
- [Crossplane](https://github.com/grafana/crossplane-provider-grafana) lets you manage Grafana resources using Kubernetes manifests with the Grafana Crossplane provider.
- [Grafonnet](https://github.com/grafana/grafonnet) is a Jsonnet library for generating Grafana dashboard JSON definitions programmatically.
