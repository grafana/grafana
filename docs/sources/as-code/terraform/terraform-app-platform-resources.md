---
description: Set the stack ID in the Grafana Terraform provider to manage App Platform resources, such as Service Center services, alert rules, and dashboards, in a Grafana Cloud stack.
keywords:
  - Infrastructure as Code
  - Grafana Cloud
  - Terraform
  - App Platform
  - stack_id
  - Service Center
labels:
  products:
    - cloud
title: Configure the Grafana provider for App Platform resources in Grafana Cloud
menuTitle: Configure App Platform resources
weight: 105
canonical: https://grafana.com/docs/grafana/latest/as-code/terraform/terraform-app-platform-resources/
---

# Configure the Grafana provider for App Platform resources in Grafana Cloud

Learn how to configure the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to manage App Platform resources in a Grafana Cloud stack.
App Platform resources are the Terraform resources whose names start with `grafana_apps_`, such as Service Center services, alert rules, and dashboards.

To manage these resources in Grafana Cloud, you must set the `stack_id` argument in the provider configuration, in addition to `url` and `auth`.
If you omit `stack_id`, Terraform fails with an `HTTP 403 - Forbidden` error, even though `url` already points to your stack.

In this guide, you configure the provider with `stack_id` and create a Service Center service with the [`grafana_apps_servicemodel_component_v1alpha1`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_servicemodel_component_v1alpha1) resource.
You can use the same provider configuration for any other App Platform resource.

## Why App Platform resources need a stack ID

App Platform resources use the Grafana Kubernetes-style APIs, where every resource belongs to a namespace.
In Grafana Cloud, the namespace of a stack is `stacks-<STACK_ID>`.

The provider builds the namespace from its own configuration, not from the stack URL:

- **If you set `stack_id`:** The provider sends requests to the `stacks-<STACK_ID>` namespace of your stack.
- **If you don't set `stack_id`:** The provider falls back to `org_id`, which defaults to `1`, and sends requests to the `default` namespace.
  Grafana Cloud rejects requests to this namespace with `HTTP 403 - Forbidden`.

The `org_id` argument only applies to self-managed Grafana OSS and Grafana Enterprise instances.
In Grafana Cloud, use `stack_id` instead.

### Affected resources

The `stack_id` requirement applies to typed `grafana_apps_*` resources, including the following:

| Area                   | Resources                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Alerting**           | `grafana_apps_rules_*`, `grafana_apps_notifications_*`, and `grafana_apps_alertenrichment_alertenrichment_v1beta1`                |
| **Dashboards**         | `grafana_apps_dashboard_dashboard_v1beta1`, `grafana_apps_dashboard_dashboard_v2beta1`, and `grafana_apps_dashboard_dashboard_v2` |
| **Git Sync**           | `grafana_apps_provisioning_connection_v0alpha1` and `grafana_apps_provisioning_repository_v0alpha1`                               |
| **Playlists**          | `grafana_apps_playlist_*`                                                                                                         |
| **Product activation** | `grafana_apps_productactivation_*`                                                                                                |
| **Saved queries**      | `grafana_apps_queries_query_v1`                                                                                                   |
| **Secrets Management** | `grafana_apps_secret_*`                                                                                                           |
| **Service Center**     | `grafana_apps_servicemodel_component_v1alpha1`                                                                                    |

For the complete list, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

Unlike typed `grafana_apps_*` resources, `grafana_apps_generic_resource` discovers the stack namespace from `/bootdata` automatically and uses `stack_id` only as a fallback or to verify that the configured stack matches the instance.

Other resources, such as `grafana_folder`, `grafana_dashboard`, and `grafana_rule_group`, use the Grafana HTTP API and don't need `stack_id`.
You can set `stack_id` in a provider that manages both kinds of resources.

## Before you begin

Before you begin, ensure you have the following:

- **Grafana Cloud stack:** You need a Grafana Cloud stack to provision resources into. To create one, refer to [Create and manage a Grafana Cloud stack using Terraform](../terraform-cloud-stack/).
- **Terraform CLI:** Install [Terraform](https://developer.hashicorp.com/terraform/install) on your machine.
- **Grafana Terraform provider:** Use `grafana/grafana` version 4.44.0 or later, which adds the `grafana_apps_servicemodel_component_v1alpha1` resource that this guide uses.

{{< admonition type="note" >}}
All of the following Terraform configuration files should be saved in the same directory.
{{< /admonition >}}

## Find your stack ID

The stack ID is the numeric ID of your Grafana Cloud stack, for example `123456`.

To find your stack ID, follow these steps:

1. Open the [Grafana Cloud Portal](https://grafana.com/profile/org).
1. Select your stack.
1. In the stack details, copy the numeric **Instance ID**. That value is your `stack_id`.

## Create a service account token

Terraform authenticates against your Grafana Cloud stack with a service account token.

To create a service account and token, follow these steps:

1. Create a service account in your Grafana Cloud stack and assign it the **Admin** role.
   To create a service account, refer to [Create a service account](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/#create-a-service-account-in-grafana).

   If you don't want to grant the **Admin** role, assign the roles or role-based access control (RBAC) permissions that the resources you manage require.

1. Add a token to the service account.
   To add a token, refer to [Add a token to a service account](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/#add-a-token-to-a-service-account-in-grafana).

1. Copy the token and store it securely, because you can't view it again after you leave the page.

## Configure the Grafana provider

Create a file named `main.tf` and add the following:

```terraform
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 4.44.0"
    }
  }
}

variable "grafana_auth" {
  type      = string
  sensitive = true
}

provider "grafana" {
  url  = "<GRAFANA_URL>"
  auth = var.grafana_auth

  # Required for App Platform resources in Grafana Cloud.
  stack_id = <STACK_ID>
}
```

Replace the following placeholders:

- _`<GRAFANA_URL>`_ is the URL of your Grafana Cloud stack, for example `https://my-stack.grafana.net/`.
- _`<STACK_ID>`_ is the stack ID that you found in [Find your stack ID](#find-your-stack-id), for example `123456`.

The `grafana_auth` variable holds the service account token.
To keep the token out of your configuration files, you set it through the `TF_VAR_grafana_auth` environment variable when you apply the configuration.

You can also set the stack ID through the `GRAFANA_STACK_ID` environment variable instead of the `stack_id` argument.

If you create the stack in the same Terraform configuration, reference the stack ID from the `grafana_cloud_stack` resource instead of hard-coding it:

```terraform
provider "grafana" {
  alias = "my_stack"

  url      = grafana_cloud_stack.my_stack.url
  auth     = grafana_cloud_stack_service_account_token.cloud_sa.key
  stack_id = grafana_cloud_stack.my_stack.id
}
```

## Define an App Platform resource

The following example creates a service in [Service Center](https://grafana.com/docs/grafana-cloud/alerting-and-irm/service-center/).

Create a file named `service.tf` and add the following:

```terraform
resource "grafana_apps_servicemodel_component_v1alpha1" "<RESOURCE_NAME>" {
  metadata {
    uid = "<SERVICE_UID>"
  }

  spec {
    title = "<SERVICE_TITLE>"
  }
}
```

Replace the following placeholders:

- _`<RESOURCE_NAME>`_ is a name for the resource in Terraform, for example `payments`.
- _`<SERVICE_UID>`_ is the identifier of the service, for example `payments-api`.
  The identifier can only contain lowercase letters, numbers, and dashes, and must be 2 to 63 characters long.
- _`<SERVICE_TITLE>`_ is the display name of the service in Service Center, for example `Payments API`.

If your configuration uses more than one Grafana provider, add a `provider` argument to the resource that references the provider with `stack_id`, for example `provider = grafana.my_stack`.

For the complete schema, including owners, dependencies, and links, refer to the [`grafana_apps_servicemodel_component_v1alpha1` resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_servicemodel_component_v1alpha1).

## Apply the Terraform configuration

In a terminal, run the following commands from the directory where all of the configuration files are located.

1. Initialize a working directory containing Terraform configuration files.

   ```sh
   terraform init
   ```

1. Set the service account token, then preview the changes that Terraform makes.

   ```sh
   export TF_VAR_grafana_auth='<TOKEN>'
   terraform plan
   ```

   Replace _`<TOKEN>`_ with the service account token that you created in [Create a service account token](#create-a-service-account-token).

1. Apply the configuration files.

   ```sh
   terraform apply
   ```

   After you confirm, Terraform creates the service:

   ```console
   Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
   ```

To verify the result, open **Service Center** in your Grafana Cloud stack and check that the service is listed.

## Troubleshoot HTTP 403 errors

If `terraform plan` or `terraform apply` fails with `HTTP 403 - Forbidden` for an App Platform resource, the error message includes the API group of the resource, for example `components.servicemodel.ext.grafana.com`.

To fix the error, check the following:

- **The provider sets `stack_id`:** Make sure that the `provider "grafana"` block that the resource uses includes `stack_id`, or that the `GRAFANA_STACK_ID` environment variable is set.
  If your configuration has more than one Grafana provider, check that the resource references the provider with `stack_id` in its `provider` argument.
- **The stack ID matches the stack URL:** Make sure that `stack_id` is the ID of the stack in `url`.
  If the IDs don't match, the provider sends requests to a namespace that the token can't access.
- **The service account has the required permissions:** If the error persists after you set `stack_id`, check that the service account token in `auth` belongs to a service account with the **Admin** role, or with the permissions that the resource requires.

## Summary

In this guide, you configured the Grafana provider with `stack_id` and created a Service Center service, an App Platform resource, in a Grafana Cloud stack.
You also learned how to fix `HTTP 403 - Forbidden` errors caused by a missing `stack_id`.

To learn more about managing Grafana Cloud using Terraform, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

## Next steps

- To manage alerting resources, refer to [Use Terraform to provision alerting resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/).
- To manage saved queries, refer to [Manage saved queries using Terraform](../manage-saved-queries/).
- To manage secure values, refer to [Manage secrets in Grafana Cloud using Terraform](../terraform-secrets-management/).
- To synchronize a Git repository with Grafana, refer to [Set up Git Sync with Terraform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-terraform/).
