---
description: Learn how to manage Grafana Frontend Observability resources in Grafana Cloud using Terraform
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Frontend Observability
title: Manage Frontend Observability in Grafana Cloud with Terraform
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/terraform/cloud-products/terraform-frontend-observability/
aliases:
  - ../infrastructure-as-code/terraform/terraform-frontend-observability/
  - ../terraform-frontend-observability/
  - ../../infrastructure-as-code/terraform/terraform-frontend-observability/
---

# Manage Frontend Observability in Grafana Cloud with Terraform

Learn how to use Terraform to manage [Grafana Frontend Observability](https://grafana.com/docs/grafana-cloud/frontend-observability/) resources, such as your applications.
This guide shows you how to create an access policy and a token for the Frontend Observability API, and how to use them to create a Frontend Observability app.

{{< admonition type="note" >}}
The Grafana Terraform provider is updated frequently. For the latest provider version and the complete reference for every resource and data source, refer to the [Grafana provider in the Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
{{< /admonition >}}

## Before you begin

Before you begin, ensure you have the following:

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
         version = ">= 3.22.1"
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

The Frontend Observability API needs its own access token. Create an access policy with the `frontend-observability:read`, `frontend-observability:write`, and `frontend-observability:delete` scopes using [`grafana_cloud_access_policy`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy), and a token for it using [`grafana_cloud_access_policy_token`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy_token).

Create a file named `frontend-o11y-token.tf` and add the following:

```terraform
resource "grafana_cloud_access_policy" "frontend_o11y" {
  provider = grafana.cloud

  name   = "frontend-o11y-policy"
  region = data.grafana_cloud_stack.stack.region_slug

  scopes = [
    "frontend-observability:read",
    "frontend-observability:write",
    "frontend-observability:delete",
    "stacks:read",
  ]

  realm {
    type       = "stack"
    identifier = data.grafana_cloud_stack.stack.id
  }
}

resource "grafana_cloud_access_policy_token" "frontend_o11y" {
  provider = grafana.cloud

  name             = "frontend-o11y-token"
  region           = grafana_cloud_access_policy.frontend_o11y.region
  access_policy_id = grafana_cloud_access_policy.frontend_o11y.policy_id
}
```

## Configure the provider to use the Frontend Observability API

Add a second provider block that uses the token to connect to the Frontend Observability API. Add the following to `cloud-provider.tf`:

```terraform
provider "grafana" {
  alias = "frontend_o11y"

  frontend_o11y_api_access_token = grafana_cloud_access_policy_token.frontend_o11y.token
}
```

## Create a Frontend Observability app

Use [`grafana_frontend_o11y_app`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/frontend_o11y_app) to create an app in Frontend Observability.

Create a file named `frontend-o11y-app.tf` and add the following:

```terraform
resource "grafana_frontend_o11y_app" "my_app" {
  provider = grafana.frontend_o11y

  stack_id        = data.grafana_cloud_stack.stack.id
  name            = "<APP_NAME>"
  allowed_origins = ["<ALLOWED_ORIGIN>"]

  extra_log_attributes = {
    team = "<TEAM_NAME>"
  }

  settings = {
    "geolocation.enabled" = "1"
  }
}

output "frontend_o11y_collector_endpoint" {
  value = grafana_frontend_o11y_app.my_app.collector_endpoint
}
```

Replace the following placeholders:

- _`<APP_NAME>`_: The name of your frontend app.
- _`<ALLOWED_ORIGIN>`_: The origin that sends telemetry to Frontend Observability, for example `https://example.com`.
- _`<TEAM_NAME>`_: A value for the `team` attribute that's added to every signal from the app.

The `allowed_origins`, `extra_log_attributes`, and `settings` arguments are required. For the available settings, refer to the [`grafana_frontend_o11y_app` documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/frontend_o11y_app).

After you run `terraform apply`, the `frontend_o11y_collector_endpoint` output shows the collector URL to use in the Faro Web SDK configuration of your app.

To bring an existing app under Terraform management, import it with its stack ID and name:

```sh
terraform import grafana_frontend_o11y_app.my_app "<STACK_ID>:<APP_NAME>"
```

## Read an existing Frontend Observability app

To reference an existing Frontend Observability app without managing it in Terraform, use the [`grafana_frontend_o11y_app` data source](https://registry.terraform.io/providers/grafana/grafana/latest/docs/data-sources/frontend_o11y_app):

```terraform
data "grafana_frontend_o11y_app" "existing" {
  provider = grafana.frontend_o11y

  stack_id = data.grafana_cloud_stack.stack.id
  name     = "<APP_NAME>"
}
```

## Summary

In this guide, you created an access policy and a token for Frontend Observability, and used them to create a Frontend Observability app with Terraform.

To learn more about managing Grafana Cloud using Terraform, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
