---
description: Get started with Observability as Code by exploring the documentation, libraries, and tools available for as-code practices.
keywords:
  - configuration
  - as code
  - as-code
  - dashboards
  - Git Sync
  - Git
labels:
  products:
    - enterprise
    - oss
title: Get started with Observability as Code
weight: 100
---

# Get started with Observability as Code

Simply put, with Observability as Code, you can manage Grafana resources.
You can write code that describes what you want the dashboard to do, rather than manipulate it via the UI.

Observability as Code lets you manage dashboards, resources, and configurations programmatically, leveraging powerful tools for automation and standardization.

## Get started with Observability as Code

<!--
1. [**Understand the Dashboard Schemas**](json-models/)

   - Learn about the Dashboard JSON models, which introduces clearer separation of properties, improved layouts, and metadata management.
   - Review examples of JSON definitions for dashboards to get familiar with the structure and fields.

1. [**Understand the Foundation SDK**](foundation-sdk)

   - Learn about a toolkit for programmatically creating and managing Grafana dashboards and resources with reusable components and streamlined workflows.
-->

1. [Grafana CLI (`grafanactl`)](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/grafana-cli)

   - Use a command-line tool for simplifying the management of Grafana resources.
   - Grafana CLI Works across environments (OSS, Enterprise, Cloud), and provides solutions for many as-code situations.
   - It provides the flexibility many advanced users and existing pipelines require: CI/CD, pull/push from remotes, and more.

1. [Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync/)

   - Configure Git repositories to store your dashboard JSON files.
   - Understand best practices for version control, including collaboration through pull requests and rollbacks.
   - Edit your JSON files in GitHub and then sync with Grafana.

1. [Manage dashboard deployments from GitHub](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/use-git-sync/)

   - Integrate dashboards into CI/CD pipelines using tools like GitHub Actions.
   - Leverage provisioning features in Grafana to automate updates and deployment of dashboards.

## Additional Observability as Code tools

Explore these additional tools and libraries for working with Observability as Code.

- [Terraform](../infrastructure-as-code/terraform/)

  - Use the Grafana Terraform provider to manage dashboards, alerts, and more.
  - Understand how to define and deploy resources using HCL/JSON configurations.

- [Ansible](../infrastructure-as-code/ansible/)

  - Learn to use the Grafana Ansible collection to manage Grafana Cloud resources, including folders and cloud stacks.
  - Write playbooks to automate resource provisioning through the Grafana API.

- [Grafana Operator](../infrastructure-as-code/grafana-operator/)

  - Utilize Kubernetes-native management with the Grafana Operator.
  - Manage dashboards, folders, and data sources via Kubernetes Custom Resources.
  - Integrate with GitOps workflows for seamless version control and deployment.

- [Crossplane](https://github.com/grafana/crossplane-provider-grafana) lets you manage Grafana resources using Kubernetes manifests with the Grafana Crossplane provider.
- [Grafonnet](https://github.com/grafana/grafonnet) is a Jsonnet library for generating Grafana dashboard JSON definitions programmatically. It is currently in the process of being deprecated.
- [Grizzly](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/grizzly/dashboards-folders-datasources/) is a deprecated command-line tool that simplifies managing Grafana resources using Kubernetes-inspired YAML syntax.
