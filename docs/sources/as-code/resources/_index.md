---
description: Learn how the Grafana platform is organized, what a Grafana resource is, and how as-code tools work with resources.
keywords:
  - as code
  - as-code
  - resources
  - entities
  - architecture
  - managed resources
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Resources in Grafana
menuTitle: Resources in Grafana
weight: 50
canonical: https://grafana.com/docs/grafana/latest/as-code/resources/
---

# Resources in Grafana

Every as-code tool, from Git Sync to Terraform, works with the same building blocks: Grafana resources.
This section explains how the Grafana platform is organized, what a resource is, and how Grafana keeps track of the tool that manages each one.

## How the Grafana platform is organized

Grafana doesn't store most of your telemetry. It connects to the systems that produce and store it, and gives you one place to query, visualize, and act on that data.

- **Instance:** A Grafana server, either one you run yourself with Grafana OSS or Grafana Enterprise, or the Grafana instance in a Grafana Cloud stack.
- **Namespace:** The boundary that isolates resources inside an instance. In Grafana OSS and Grafana Enterprise, each organization is a namespace. In Grafana Cloud, each stack is a namespace.
- **Data sources:** Connections to the systems that store your metrics, logs, traces, and profiles, such as Prometheus, Loki, Tempo, or a cloud provider.
- **Plugins:** Extensions that add data sources, visualizations, and apps to an instance.
- **Resources:** The objects you create in an instance to work with your data, such as dashboards, folders, and alert rules.

Grafana exposes resources through a common API at `/apis`, so every resource type is read, written, and versioned the same way.
For the API itself, refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## What is a resource in Grafana

Observability platforms commonly model the things you monitor as _entities_, a service, a host, a container, a database, or a cloud account that gives you data. Each entity has a unique identity, a type, metadata that describes it, and relationships to other entities, so you can find it, group it, and follow its dependencies. In Grafana Cloud, [Knowledge Graph](https://grafana.com/docs/grafana-cloud/platform/knowledge-graph/) uses this model for the services and infrastructure that send you telemetry.

A Grafana resource applies the same model to the objects that let you work with your data. Because every resource shares the same data structure, an as code tool can store it as a file, compare it with what's running in Grafana, and apply changes the same way for any resource type.

### Who manages a resource?

You can create a resource in the Grafana UI, or use an as-code tool to create it for you. Grafana records the tool that created and manages your resource, and uses this information to decide whether you can change the resource in the UI.

For what each tool records and allows, refer to [Manage resources in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/resources/manage-resources/).

### Resource definitions

A resource's _definition_ is the full description of the resource in JSON or YAML: its `apiVersion`, `kind`, `metadata`, and `spec`. For example, for a dashboard the definition is the dashboard JSON, including its title, panels, queries, and variables.

The same definition can exist in two places:

- **In Grafana:** The copy that Grafana stores and shows in the UI.
- **Outside Grafana:** A file that you write or export, such as a dashboard JSON file in a Git repository or a Terraform configuration.

Some as-code tools keep Grafana in sync with the file, and Grafana records which file the resource comes from. To learn which tools do this, refer to [Manage your resource definition](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/resources/manage-resources/#manage-your-resource-definition).
