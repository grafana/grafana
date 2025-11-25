---
keywords:
  - Infrastructure as code
  - Quickstart
  - Grafana Cloud
menuTitle: Infrastructure as code
title: Provision Grafana Cloud with Infrastructure as code
weight: 800
labels:
  products:
    - cloud
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/
---

# Provision Grafana Cloud with Infrastructure as code

With Grafana Cloud, you can use as-code tools to create and manage resources via code, and incorporate them efficiently into your own use cases. This enables you to review code, reuse it, and create better workflows.

{{< admonition type="note" >}}

Most of the tools defined here can be used with one another.

{{< /admonition >}}

## Grafana Terraform provider

Grafana administrators can manage dashboards, alerts and collectors, add synthetic monitoring probes and checks, manage identity and access, and more using the [Terraform provider for Grafana](https://registry.terraform.io/providers/grafana/grafana/latest).

The following example shows a Terraform configuration for creating a dashboard:

```terraform
resource "grafana_dashboard" "metrics" {
  config_json = jsonencode({
    title   = "as-code dashboard"
    uid     = "ascode"
  })
}
```

This example dashboard only creates the dashboard and does not add any panels or rows.
To get started, see the [Grafana Terraform provider guides](/docs/grafana-cloud/as-code/infrastructure-as-code/terraform/) or refer to the [Terraform Grafana Provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

### Who is this recommended for?

Grafana Terraform provider is best suited for users who are already using Terraform for non-Grafana use cases.

To manage the entire Grafana ecosystem of resources on either Grafana Cloud or OSS deployments of Grafana, it’s best to use the Terraform Grafana provider because it supports the most Grafana resources compared to Grafana’s other as-code solutions.

For Grafana Fleet Management users, the Grafana Terraform provider is best used to preregister new collectors before they are operational or add remote attributes to collectors already registered with the service.

### Known limitations

Managing dashboards isn’t the simplest process—you have to work with long JSON files, which can become difficult to review and update, as well. Grafonnet can help with generating dashboard JSONs that can be used in Terraform, but Grafonnet requires knowing Jsonnet.

## Grafana Ansible collection

Resources for configuration management are available for Grafana through the [Ansible collection for Grafana](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/index.html#plugins-in-grafana-grafana). The Grafana Ansible collection can be used to manage a variety of resources, including folders, cloud stacks, and dashboards. You can programmatically manage resources on Grafana that aren’t currently part of the Grafana Ansible collection by writing Ansible playbooks that use the HTTP APIs to manage resources for Grafana.

The following example shows an Ansible configuration for creating a dashboard:

```yaml
- name: dashboard as code
  grafana.grafana.dashboard:
    dashboard: { 'title': 'as-code dashboard', 'uid': 'ascode' }
    stack_slug: '{{ stack_slug }}'
    grafana_api_key: '{{ grafana_api_key }}'
    state: present
```

This example dashboard creates only the dashboard and does not add any panels or rows.

To get started, see the [quickstart guides for the Grafana Ansible Collection](/docs/grafana-cloud/as-code/infrastructure-as-code/ansible/) or check out the [collections's documentation](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/index.html#plugins-in-grafana-grafana).

### Who is this recommended for?

Like Terraform, the Grafana Ansible collection is best suited for people already using Ansible for non-Grafana use cases. The collection only works for Grafana Cloud right now, so it makes the most sense for Grafana Cloud customers who want to manage resources using Ansible.

### Known limitations

The Grafana Ansible collection only works for Grafana Cloud and only supports eight resources: API keys, cloud stacks, plugins, dashboards, folders, data sources, alert contact points, and notification policies. This can be a drawback if you want to manage the entire Grafana ecosystem as code with Ansible. As with Terraform, building dashboards is a challenging process.

## Grafana Operator

The Grafana Operator is a Kubernetes operator that can provision, manage, and operate Grafana instances and their associated resources within Kubernetes through Custom Resources. This Kubernetes-native tool eases the administration of Grafana, including managing dashboards, data sources, and folders. It also automatically syncs the Kubernetes Custom resources and the actual resources in the Grafana Instance. It supports leveraging Grafonnet for generating Grafana dashboard definitions for seamless dashboard configuration as code.

To get started, see the [quickstart guides for the Grafana Operator](/docs/grafana-cloud/as-code/infrastructure-as-code/grafana-operator/) or check out the [Grafana Operator's documentation](https://grafana.github.io/grafana-operator/).

A sample Kubernetes configuration for creating a dashboard using the Grafana operator looks like this:

```yaml
apiVersion: integreatly.org/v1alpha1
kind: GrafanaDashboard
metadata:
  name: simple-dashboard
  labels:
    app: grafana
spec:
  instanceSelector:
    matchLabels:
      dashboards: <Grafana-custom-resource-name>
  json: >
    {
      "title": "as-code dashboard",
      “uid” : “ascode”
    }
```

### Who is this recommended for?

The Grafana Operator is particularly fitting for:

- Teams seeking integrated solutions to manage Grafana resources within the Kubernetes cluster ecosystem.
- Teams employing a GitOps approach, allowing them to treat Grafana configurations as code, stored alongside application manifests for versioned and automated deployments.

### Known limitations

While the Grafana Operator simplifies many aspects of operating Grafana and its resources on Kubernetes, its current support is mainly focused on managing dashboards, folders, and data sources. Advanced features like alerting and plugins (only works for OSS) are not supported yet.

## Grafana Crossplane provider

[Grafana Crossplane provider](https://github.com/grafana/crossplane-provider-grafana) is built using Terrajet and provides support for all resources supported by the Grafana Terraform provider. It enables users to define Grafana resources as Kubernetes manifests and it also help users who build their GitOps pipelines around Kubernetes manifests using tools like ArgoCD.

To get started with the Grafana Crossplane provider, install Crossplane in the Kubernetes cluster and use this command to install the provider:

```shell
kubectl crossplane install provider grafana/crossplane-provider-grafana:v0.1.0
```

During installation of the provider, CRDs for all the resources supported by the Terraform provider are added to the cluster so users can begin defining their Grafana resources as Kubernetes custom resources. The Crossplane provider ensures that whatever is defined in the custom resource definitions is what is visible in Grafana UI. If any changes are made directly in the UI, the changes will be discarded when the provider resyncs. This helps ensure that whatever is defined via code in the cluster will be the source of truth for Grafana resources.

To get started, refer to the examples folder in the Grafana Crossplane repository.

The following example shows a Kubernetes custom resource definition for creating a dashboard:

```yaml
apiVersion: grafana.jet.crossplane.io/v1alpha1
kind: Dashboard
metadata:
  name: as-code-dashboard
spec:
  forProvider:
    configJson: |
      {
        "title": "as-code dashboard",
        "uid": "ascode"
      }
  providerConfigRef:
    name: grafana-crossplane-provider
```

### Who is this recommended for?

The Grafana Crossplane provider is intended for existing Crossplane users looking to manage Grafana resources from within Kubernetes and as Kubernetes manifests for the GitOps pipelines.

### Known limitations

To use the Crossplane provider, you must have the Crossplane CLI and Crossplane installed in the Kubernetes cluster. Note that the Crossplane provider is in an alpha stage, so it has not reached a stable state yet.

## Grafana as code comparison

The following chart compares the properties and tools mentioned above.

| Property/Tool                          | Grafana Terraform Provider  | Grafana Ansible Collection                                                    | Grafana Operator                                                 | Grafana Crossplane Provider                                      |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Grafana resources supported            | All major Grafana resources | Grafana Cloud stack, plugins, API keys, dashboards, data sources, and folders | Dashboards, data sources, Folders                                | All major Grafana resources                                      |
| Tool format                            | HCL/JSON                    | YAML                                                                          | YAML                                                             | YAML/JSON                                                        |
| Follows Kubernetes-style manifests     |                             |                                                                               | ✓                                                                | ✓                                                                |
| Easy dashboard building process        |                             |                                                                               | ✓                                                                |                                                                  |
| Manage resources using Kubernetes      |                             |                                                                               | ✓                                                                | ✓                                                                |
| Retrieves Grafana resource information | ✓                           |                                                                               |                                                                  |                                                                  |
| Built-in resource sync process         |                             |                                                                               | ✓                                                                | ✓                                                                |
| Recommended for                        | Existing Terraform users    | Existing Ansible users                                                        | Users looking to manage Grafana resources from within Kubernetes | Users looking to manage Grafana resources from within Kubernetes |
