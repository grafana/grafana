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
   - cloud
   - enterprise
   - oss
title: Get started with Observability as Code
weight: 100
---

# Get started with Observability as Code

Simply put, with Observability as Code, you can _declaratively_ manage Grafana resources--that is, write code that describes what you want the dashboard to do, rather than manipulate it via the UI.

Observability as Code enables users to manage dashboards, resources, and configurations programmatically, leveraging powerful tools for automation and standardization. After familiarizing yourself with the [key features and benefits](./_index.md) of Observability as Code, refer to the resources in this section to get started quickly.

## Get started with Observability as Code

To begin, explore the following topics:

1. [**Understand the Dashboard Schemas**](./json-models/_index.md)

    - Learn about the Dashboard JSON models, which introduces clearer separation of properties, improved layouts, and metadata management.
    - Review examples of JSON definitions for dashboards to get familiar with the structure and fields.

1. [**Understand the Foundation SDK**](./foundation-sdk.md)

    - Learn about a toolkit for programmatically creating and managing Grafana dashboards and resources with reusable components and streamlined workflows.

1. [**Set up Git Sync**](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/git-sync-setup/)

    - Configure Git repositories to store your dashboard JSON files.
    - Understand best practices for version control, including collaboration through pull requests and rollbacks.
    - Edit your JSON files in GitHub and then sync with Grafana.

1. [**Manage dashboard deployments from GitHub**](./git-sync/use-git-sync.md)

    - Integrate dashboards into CI/CD pipelines using tools like GitHub Actions.
    - Leverage provisioning features in Grafana to automate updates and deployment of dashboards.

1. **Explore additional tools and libraries for working with Observability as Code**

    - [**Grafanactl**](grafanactl.md)
        - Use a command-line tool for simplifying the management of Grafana resources.

    - [**Terraform**](./infrastructure-as-code/terraform/_index.md)

        - Use the Grafana Terraform provider to declaratively manage dashboards, alerts, and more.
        - Understand how to define and deploy resources using HCL/JSON configurations.

    - [**Ansible**](./infrastructure-as-code/ansible/_index.md)

        - Learn to use the Grafana Ansible collection to manage Grafana Cloud resources, including folders and cloud stacks.
        - Write playbooks to automate resource provisioning through the Grafana API.

    - [**Grafana Operator**](./infrastructure-as-code/grafana-operator/_index.md)

        - Utilize Kubernetes-native management with the Grafana Operator.
        - Manage dashboards, folders, and data sources via Kubernetes Custom Resources.
        - Integrate with GitOps workflows for seamless version control and deployment.

## Explore additional Observability as Code tools

- [**Crossplane:**](https://github.com/grafana/crossplane-provider-grafana) Manage Grafana resources using Kubernetes manifests with the Grafana Crossplane provider.
- [**Grafonnet:**](https://github.com/grafana/grafonnet) Grafonnet is a Jsonnet library for generating Grafana dashboard JSON definitions programmatically. It is currently in the process of being deprecated.
- [**Grizzly:**](./infrastructure-as-code/grizzly/_index.md) Grizzly is a command-line tool that simplifies managing Grafana resources using Kubernetes-inspired YAML syntax. It is currently in the process of being deprecated.

Observability as Code empowers teams to bring observability closer to their DevOps workflows. Explore these foundational topics to maximize the potential of programmatically managing Grafana resources.
