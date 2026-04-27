---
description: Instructions for setting up Git Sync as code, so you can provision Git repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - terraform
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync with Terraform
weight: 210
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-terraform
aliases:
---

# Set up Git Sync with Terraform

{{< admonition type="note" >}}

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) to understand usage limits for the different tiers.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

You can also configure Git Sync via the Grafana provisioning app platform using Terraform.

## Before you begin

Before you begin, make sure to have the following:

- A Grafana Cloud account or an on-prem Grafana instance.
- Administrator permissions in your Grafana stack/instance.
- Terraform 1.11 or later installed on your machine. Refer to the [Terraform install documentation](https://developer.hashicorp.com/terraform/install) to learn more.

{{< admonition type="note" >}}
Save all of the following Terraform configuration files in the same directory.
{{< /admonition >}}

## Configure the Grafana provider

Use this Terraform configuration to set up the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide the authentication required to configure Git Sync.

1. Create a service account and token in Grafana. For more information refer to [Service account tokens](https://grafana.com/docs/grafana/latest/administration/service-accounts/#service-account-tokens) or [Creating and managing a Grafana Cloud stack using Terraform](https://grafana.com/docs/grafana-cloud/as-code/infrastructure-as-code/terraform/terraform-cloud-stack/).

1. Make sure that the token has the Admin or the `Provisioning:Repositories` writer permission.

1. Create a file named `main.tf` and add the following:

   ```terraform
      terraform {
        required_providers {
          grafana = {
            source  = "grafana/grafana"
            version = ">= 4.28.1"
          }
        }
      }

      provider "grafana" {
        cloud_api_url = "<STACK_URL>"
        stack_id = "<STACK_ID>"
        cloud_access_policy_token = "<SERVICE_ACCOUNT_TOKEN>"
      }
   ```

Replace the following field values:

- `STACK_URL` with the URL of your Grafana stack, for example `https://my-stack.grafana.net/`
- `<STACK_ID>` with the Grafana stack ID, if you are using a Grafana Cloud stack
- `SERVICE_ACCOUNT_TOKEN` with the service account token that you created

## Create the resources to use Git Sync

You need two resources for configure and manage Git Sync:

- The repository resource configures the Git repository to sync Grafana resources with. For examples, refer to [Repository resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_provisioning_repository_v0alpha1) in the Terraform registry.
- The connection resource configures your Git provider credentials. For examples, refer to [Connection resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_provisioning_connection_v0alpha1) in the Terraform registry.

For better understanding of the required resources, refer to [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts).
