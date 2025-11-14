---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Grafana Operator
menuTitle: Grafana Operator
title: Grafana Operator
weight: 120
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/grafana-operator/
---

# Grafana Operator

[Grafana Operator](https://grafana.github.io/grafana-operator/) is a Kubernetes operator built to help you manage your Grafana instances and its resources from within Kubernetes. The Operator can install and manage local Grafana instances, Dashboards and Datasources through Kubernetes/OpenShift Custom resources. The Grafana Operator Automatically syncs the Kubernetes Custom resources and the actual resources in the Grafana Instance.

## Installing the Grafana Operator

To install the Grafana Operator in your Kubernetes cluster, Run the following command in your terminal:

```
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade -i grafana-operator grafana/grafana-operator
```

For other installation methods, Refer [Grafana Operator Installation Documentation](https://grafana.github.io/grafana-operator/docs/installation/).

## Getting Started

Use the following guide to get started with using Grafana Operator to manage your Grafana instance:

- [Manage data sources, and dashboards with folders using the Grafana Operator](operator-dashboards-folders-datasources/) describes how to add a folders, data sources, and dashboards, using the [Grafana Operator](https://grafana.github.io/grafana-operator/).
- [Manage Dashboards with GitOps Using ArgoCD](manage-dashboards-argocd/) describes how to create and manage dashboards using ArgoCD and [Grafana Operator](https://grafana.github.io/grafana-operator/).
