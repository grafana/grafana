---
description: Learn how to install plugins in Grafana Cloud using Terraform
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Plugins
title: Install plugins in Grafana Cloud using Terraform
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-plugins/
---

# Install plugins in Grafana Cloud using Terraform

This guide shows you how to install plugins in Grafana Cloud using Terraform. For more information about Grafana plugins see [Find and use Grafana plugins](/docs/grafana-cloud/introduction/find-and-use-plugins/).

## Before you begin

Before you begin, you should have the following available:

- A Grafana Cloud account; for more information on setting up a Grafana Cloud account, refer to [Get started](https://grafana.com/docs/grafana-cloud/get-started/).
- Terraform installed on your machine; for more information on how to install Terraform, refer to the [Terraform install documentation](https://developer.hashicorp.com/terraform/install).
- Administrator permissions in your Grafana instance; for more information on assigning Grafana RBAC roles, refer to [Assign RBAC roles](/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-control/assign-rbac-roles/).

{{< admonition type="note" >}}
Save all of the following Terraform configuration files in the same directory.
{{< /admonition >}}

## Configure the Grafana provider

Use this Terraform configuration to set up the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide the authentication required to manage plugin resources.

1. Create a service account and token in Grafana. For more information on creating a service account and token, refer to [Service account tokens](https://grafana.com/docs/grafana/latest/administration/service-accounts/#service-account-tokens). You can also refer to [Creating and managing a Grafana Cloud stack using Terraform](../terraform-cloud-stack/) to set up a service account and a token.

1. Make sure that the token has the following permissions:

- `stack-plugins:read`
- `stack-plugins:write`
- `stack-plugins:delete`

Next, create a file named `main.tf` and add the following:

```terraform
   terraform {
     required_providers {
       grafana = {
         source  = "grafana/grafana"
         version = ">= 4.5.3"
       }
     }
   }

   provider "grafana" {
     cloud_api_url      = "<Stack-URL>"
     cloud_access_policy_token     = "<Service-account-token>"
   }
```

Replace the following field values:

- `Stack-URL` with the URL of your Grafana stack, for example `https://my-stack.grafana.net/`
- `Service-account-token` with the service account token that you created

## Create new plugin resource

Create a file named `plugins.tf` and add the following:

```terraform
resource "grafana_cloud_plugin_installation" "grafana-clock-panel" {
  stack_slug   = "<Your-Stack-Slug>"
  slug         = "grafana-clock-panel"
  version      = "latest"
}
```

## Conclusion

In this guide, you learned how to install a plugin in Grafana Cloud using Terraform.

To learn more about plugin installation, refer to [Grafana provider's documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_plugin_installation).
