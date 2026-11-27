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

## What is a resource

Observability platforms commonly model the things you monitor as _entities_.
An entity is anything that gives you data: a service, a host, a container, a database, or a cloud account.
Each entity has a unique identity, a type, metadata that describes it, and relationships to other entities, so you can find it, group it, and follow its dependencies.
In Grafana Cloud, [Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) uses this model for the services and infrastructure that send you telemetry.

A Grafana resource applies the same model to the objects that let you work with that data.
A data source points to a system that gives you data, a dashboard visualizes it, and an alert rule watches it.
Like an entity, every resource has:

| Property      | What it records                                                                                        | Where it lives                                       |
| ------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Identity      | A name that's unique for its type within a namespace.                                                  | `metadata.name` and `metadata.namespace`             |
| Type          | The kind of resource and the API group and version that define it.                                     | `kind` and `apiVersion`                              |
| Metadata      | Labels and annotations that describe the resource, such as who changed it last and which tool owns it. | `metadata.labels` and `metadata.annotations`         |
| Desired state | The configuration of the resource, such as the panels of a dashboard.                                  | `spec`                                               |
| Relationships | References to other resources, such as the folder that contains it or the data sources it queries.     | Annotations such as `grafana.app/folder`, and `spec` |

The following dashboard shows each property:

```yaml
apiVersion: dashboard.grafana.app/v1
kind: Dashboard
metadata:
  name: checkout-latency
  namespace: default
  labels:
    team: payments
  annotations:
    grafana.app/folder: payments-folder
spec:
  title: Checkout latency
```

Because every resource shares this shape, an as-code tool can store it as a file, compare it with what's running in Grafana, and apply changes the same way for any resource type.

## Who manages a resource

You can create a resource in the Grafana UI, or let an as-code tool create it for you.
When a tool creates a resource, Grafana records which tool manages it, and uses that record to decide whether you can change the resource in the UI.
Give each resource a single manager, so that one tool doesn't overwrite changes made by another.

For what each tool records and allows, refer to [Manage resources in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/resources/manage-resources/).
