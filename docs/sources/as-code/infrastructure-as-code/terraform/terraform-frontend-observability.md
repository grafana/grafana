---
description: Learn how to manage Grafana Frontend Observability resources in Grafana Cloud using Terraform
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Frontend Observability
title: Manage Frontend Observability in Grafana Cloud with Terraform
weight: 200
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-frontend-observability/
---

# Manage Frontend Observability in Grafana Cloud with Terraform

Learn how to use Terraform to manage [Grafana Frontend Observability](https://grafana.com/docs/grafana-cloud/frontend-observability/) resources, such as your applications.
This guide shows you how to create an access policy and a token for Frontend Observability so that you can connect to the Frontend Observability API.

## Before you begin

Before you begin, you should have the following available:

- A Grafana Cloud account, as shown in [Get started](https://grafana.com/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine
- Administrator permissions in your Grafana instance

{{< admonition type="note" >}}
All of the following Terraform configuration files should be saved in the same directory.
{{< /admonition >}}

## Configure a provider for Grafana Cloud

This Terraform configuration configures the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide necessary authentication when interacting with the Cloud API.
The [`grafana_cloud_stack` (Data Source)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/data-sources/cloud_stack) is used to retrieve the details of your instance.

1. Create a Grafana Cloud access policy and token.
   To create a new one, refer to [Grafana Cloud Access Policies](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/).
   Add your stack to the realms list.
   The scopes needed for the examples in this guide are:
   - `accesspolicies:read`
   - `accesspolicies:write`
   - `accesspolicies:delete`
   - `dashboards:read`
   - `dashboards:write`
   - `dashboards:delete`
   - `orgs:read`
   - `orgs:write`
   - `stacks:read`
   - `stacks:write`
   - `stacks:delete`
   - `stack-dashboards:read`
   - `stack-dashboards:write`
   - `stack-dashboards:delete`
   - `stack-service-accounts:write`

1. Create a file named `cloud-provider.tf` and add the following code block:

   ```terraform
   terraform {
     required_providers {
       grafana = {
         source  = "grafana/grafana"
       }
     }
   }

   provider "grafana" {
     alias = "cloud"

     cloud_access_policy_token = "<CLOUD_ACCESS_POLICY_TOKEN>"
   }

   data "grafana_cloud_stack" "stack" {
     provider = grafana.cloud

     slug = "<STACK_SLUG>"
   }
   ```

1. Replace the following field values:
   - `<CLOUD_ACCESS_POLICY_TOKEN>` with the access policy token you created in the first step
   - `<STACK_SLUG>` with your stack slug, which is the subdomain where your Grafana Cloud instance is available: `https://<STACK_SLUG>.grafana.net`

## Create an access policy and token for Frontend Observability

You must create a Terraform configuration with the following:

- An access policy with `frontend-observability:read`, `frontend-observability:write`, and `frontend-observability:delete` scopes, using [`grafana_cloud_access_policy` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy)
- A token named `frontend_o11y_api_access_token`, using [`grafana_cloud_access_policy_token` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy_token)

## Configure the provider to use the Frontend Observability API

After you have created the token, you can configure the provider as follows:

```terraform
provider "grafana" {
  frontend_o11y_api_access_token = "<access token from previous step>"
}
```

## Conclusion

In this guide, you created an access policy and a token for Frontend Observability using Terraform.

To learn more about managing Grafana Cloud using Terraform, refer to [Grafana provider's documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
