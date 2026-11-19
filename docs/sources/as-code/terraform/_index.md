---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
menuTitle: Provision with Terraform
title: Provision Grafana with Terraform
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/terraform/
aliases:
  - ./infrastructure-as-code/terraform/
---

# Provision Grafana with Terraform

The [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest) provisions configuration management resources for Grafana. If you're a Grafana administrator you can manage dashboards, data sources, plugins, alerts and collectors, add synthetic monitoring probes and checks, manage identity and access, and more, using the Terraform provider.

{{< admonition type="note" >}}
The resources you can manage depend on the permissions of the credentials you configure in the provider. Use a [service account](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/) with the roles that the resources need. For Grafana Cloud resources, use a token from an [access policy](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/) with the required scopes. To learn more, refer to [Roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).
{{< /admonition >}}

## Why use the Terraform provider

To manage the entire Grafana ecosystem of resources on either Grafana Cloud or OSS deployments of Grafana, the Grafana Terraform provider supports the most Grafana resources compared to other as-code solutions.

The Terraform provider is a good fit when you want to:

- **Manage everything from one configuration:** Create a Grafana Cloud stack, its access policies and tokens, and the resources inside it, such as folders, data sources, dashboards, and alerts, in the same Terraform configuration.
- **Use your existing Terraform workflow:** Review changes with `terraform plan`, keep configuration in version control, and apply changes from CI/CD pipelines such as GitHub Actions.
- **Manage Grafana alongside your infrastructure:** Provision Grafana resources in the same configuration as the cloud infrastructure they monitor, for example AWS accounts and Microsoft Azure credentials for Cloud Provider Observability.
- **Use Kubernetes manifests instead of HCL:** The [Grafana Crossplane provider](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/grafana-operator/#grafana-crossplane-provider) is built from the Terraform provider and supports all of its resources as Kubernetes custom resources.

To compare Terraform with the other as-code tools, refer to [Choose a tool](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/#choose-a-tool).

## Best practices

Follow these recommendations when you manage Grafana with Terraform:

- **Store state in a remote backend:** The Terraform state file can contain sensitive data, such as tokens and data source credentials. Don't commit it to Git. Use a [remote backend](https://developer.hashicorp.com/terraform/language/state/remote) with access control instead.
- **Give each resource a single owner:** Don't manage the same resource with Terraform and another tool, or change Terraform-managed resources in the Grafana UI. The next `terraform apply` overwrites changes made outside Terraform. For example, folders created by Git Sync are owned by Git Sync, so reference them by UID instead of managing them with the `grafana_folder` resource. Refer to [Set permissions with Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/permissions-grafana/#set-permissions-with-terraform).
- **Know which resources are authoritative:** Some resources replace all existing settings with the ones you declare, while others only add entries. For example, `grafana_folder_permission` removes any folder permission you don't list, while `grafana_folder_permission_item` manages only the entries you declare.
- **Use credentials with the least privilege:** Use a service account token for resources inside a Grafana instance and a Grafana Cloud access policy token for Grafana Cloud resources. Grant only the scopes you need. Some products, such as Frontend Observability, need their own access policy token.
- **Import existing resources:** Bring resources you created in the UI under Terraform management with `terraform import` instead of recreating them. For an example, refer to [Manage saved queries using Terraform](manage-saved-queries/).

## Terraform guides by area

The following table lists the Grafana areas and Grafana Cloud products that have a Terraform guide, what you can do with Terraform in each area, and where to find the guide. For the complete list of resources and data sources, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

| Area                         | What you can do with Terraform                                                                                                                                                       | Guide                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud Provider Observability | Configure AWS accounts, Amazon CloudWatch metrics and resource metadata scrape jobs, and Microsoft Azure credentials.                                                                | [Manage Cloud Provider Observability in Grafana Cloud using Terraform](terraform-cloud-provider-o11y/)                                      |
| Dashboards                   | Create folders and manage multiple dashboards stored as JSON source code, and deploy changes with GitHub Actions.                                                                    | [Create and manage dashboards using Terraform and GitHub Actions](dashboards-github-action/)                                                |
| Fleet Management             | Preregister collectors before they're operational, add remote attributes to registered collectors, and create configuration pipelines.                                               | [Managing Fleet Management in Grafana Cloud using Terraform](https://grafana.com/docs/grafana-cloud/as-code/terraform/terraform-fleet-management/) |
| Frontend Observability       | Create the access policy and token that let the provider manage Frontend Observability resources.                                                                                   | [Managing Frontend Observability in Grafana Cloud using Terraform](https://grafana.com/docs/grafana-cloud/as-code/terraform/terraform-frontend-observability/) |
| Grafana Cloud stacks         | Create a Grafana Cloud stack with a service account and token, and add a folder, a data source, and a dashboard to it.                                                               | [Create and manage a Grafana Cloud stack using Terraform](terraform-cloud-stack/)                                                           |
| IRM                          | Connect integrations and routes, configure escalation chains and policies, and add on-call schedules.                                                                               | [Managing IRM on Grafana Cloud using Terraform](terraform-oncall/)                                                                          |
| Knowledge Graph              | Manage notification alerts, suppressed assertions, custom model rules, log, trace, and profile configurations, thresholds, and Prometheus rules.                                     | [Manage Knowledge Graph in Grafana Cloud using Terraform](terraform-knowledge-graph/)                                                       |
| Plugins                      | Install plugins in a Grafana Cloud stack.                                                                                                                                            | [Install plugins in Grafana Cloud using Terraform](terraform-plugins/)                                                                      |
| Saved queries                | Create saved queries in the query library and import existing saved queries into Terraform.                                                                                         | [Manage saved queries using Terraform](manage-saved-queries/)                                                                               |
| Secrets Management           | Create, rotate, and manage secure values, and configure and activate the keepers that store them.                                                                                   | [Manage secrets in Grafana Cloud using Terraform](terraform-secrets-management/)                                                            |
