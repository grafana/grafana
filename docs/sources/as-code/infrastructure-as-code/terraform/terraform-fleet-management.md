---
description: Learn how to create Grafana Fleet Management collectors and pipelines in Grafana Cloud using Terraform
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Fleet Management
  - Alloy
labels:
  products:
    - cloud
title: Manage Fleet Management in Grafana Cloud using Terraform
weight: 200
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-fleet-management/
---

# Manage Fleet Management in Grafana Cloud using Terraform

Learn how to create [Grafana Fleet Management](https://grafana.com/docs/grafana-cloud/send-data/fleet-management/) collectors and pipelines in Grafana Cloud using Terraform.
This guide shows you how to create an access policy and a token for Fleet Management and [Grafana Alloy](https://grafana.com/docs/alloy/latest/), a collector with remote attributes, and a pipeline for profiling Alloy.

## Before you begin

Before you begin, you should have the following available:

- A Grafana Cloud account, as shown in [Get started](https://grafana.com/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine
- [Alloy](https://grafana.com/docs/alloy/latest/set-up/install/) installed on your machine
- Administrator permissions in your Grafana instance

{{< admonition type="note" >}}
All of the following Terraform configuration files should be saved in the same directory.
{{< /admonition >}}

## Configure a provider for Grafana Cloud

This Terraform configuration configures the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide necessary authentication when interacting with the Cloud API.
The [`grafana_cloud_stack` (Data Source)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/data-sources/cloud_stack) is used to retrieve the user ID and URL details of your instance.

1. Create a Grafana Cloud access policy and token.
   To create a new one, refer to [Grafana Cloud Access Policies](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/).
   Add your stack to the realms list.
   The scopes needed for the examples in this guide are:
   - `accesspolicies:read`
   - `accesspolicies:write`
   - `accesspolicies:delete`
   - `stacks:read`

1. Create a file named `cloud-provider.tf` and add the following code block:

   ```terraform
   terraform {
     required_providers {
       grafana = {
         source  = "grafana/grafana"
         version = ">= 3.19.0"
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

## Create an access policy and token for Fleet Management

This Terraform configuration creates the following:

- An access policy named `fleet-management-policy` with `fleet-management:read` and `fleet-management:write` scopes, using [`grafana_cloud_access_policy` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy)
- A token named `fleet-management-token`, using [`grafana_cloud_access_policy_token` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy_token)

1. Create a file named `fm-access-policy.tf` and add the following code block:

   ```terraform
   resource "grafana_cloud_access_policy" "fm_policy" {
     provider = grafana.cloud

     name   = "fleet-management-policy"
     region = data.grafana_cloud_stack.stack.region_slug

     scopes = [
       "fleet-management:read",
       "fleet-management:write"
     ]

     realm {
       type       = "stack"
       identifier = data.grafana_cloud_stack.stack.id
     }
   }

   resource "grafana_cloud_access_policy_token" "fm_token" {
     provider = grafana.cloud

     name             = "fleet-management-token"
     region           = grafana_cloud_access_policy.fm_policy.region
     access_policy_id = grafana_cloud_access_policy.fm_policy.policy_id
   }
   ```

## Configure a provider for Fleet Management

This Terraform configuration configures the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide necessary authentication when interacting with the Fleet Management API.

1. Create a file named `fm-provider.tf` and add the following code block:

   ```terraform
   locals {
     fm_id    = data.grafana_cloud_stack.stack.fleet_management_user_id
     fm_token = grafana_cloud_access_policy_token.fm_token.token
     fm_url   = data.grafana_cloud_stack.stack.fleet_management_url
   }

   provider "grafana" {
     alias = "fm"

     fleet_management_auth = "${local.fm_id}:${local.fm_token}"
     fleet_management_url  = local.fm_url
   }
   ```

## Create a Fleet Management collector

This Terraform configuration creates a collector with a remote attribute, using [`grafana_fleet_management_collector` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/fleet_management_collector).

This configuration only preregisters the collector.
You must complete the [Run Alloy](#run-alloy) step for the collector to register with Fleet Management and be assigned remote attributes.

1. Create a file named `fm-collector.tf` and add the following code block:

   ```terraform
   resource "grafana_fleet_management_collector" "fm_collector" {
     provider = grafana.fm

     id = "prod_collector"
     remote_attributes = {
       "env" = "PROD"
     }
     enabled = true
   }
   ```

## Create a Fleet Management pipeline

This Terraform configuration creates a pipeline for Alloy profiling with a matcher for the collector declared in the previous step, using [`grafana_fleet_management_pipeline` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/fleet_management_pipeline).
The pipeline writes the profiles to [Grafana Cloud Profiles](https://grafana.com/docs/grafana-cloud/monitor-applications/profiles/).

1. Create a file named `profiling.alloy.tftpl` and add the following content:

   ```alloy
   // This pipeline scrapes pprof Go profiles from Alloy and sends them to Pyroscope.
   //
   // It requires the following environment variables to be set where Alloy is running:
   //   Required:
   //     * GCLOUD_RW_API_KEY: The Grafana Cloud API key with write access to Pyroscope.
   //   Optional:
   //     * ALLOY_ADDRESS: The address Alloy listens on. Defaults to 127.0.0.1:12345.
   pyroscope.scrape "alloy" {
       targets = [
           {
               "__address__" = coalesce(
                   sys.env("ALLOY_ADDRESS"),
                   "127.0.0.1:12345",
               ),
               "service_name" = "alloy",
           },
       ]
       forward_to = [pyroscope.write.grafana_cloud.receiver]

       profiling_config {
           profile.process_cpu {
               enabled = true
           }

           profile.memory {
               enabled = true
           }

           profile.mutex {
               enabled = true
           }

           profile.block {
               enabled = true
           }

           profile.goroutine {
               enabled = true
           }
       }
   }

   pyroscope.write "grafana_cloud" {
       endpoint {
           url = "${profiles_url}"

           basic_auth {
               username = "${profiles_id}"
               password = sys.env("GCLOUD_RW_API_KEY")
           }
       }
   }
   ```

1. Create a file named `fm-pipeline.tf` and add the following code block:

   ```terraform
   locals {
     profiles_id  = data.grafana_cloud_stack.stack.profiles_user_id
     profiles_url = data.grafana_cloud_stack.stack.profiles_url
   }

   resource "grafana_fleet_management_pipeline" "pipeline" {
     provider = grafana.fm

     name = "profiling"
     contents = templatefile(
       "profiling.alloy.tftpl",
       {
         profiles_id  = local.profiles_id,
         profiles_url = local.profiles_url,
       },
     )
     matchers = [
       "env=\"PROD\""
     ]
     enabled = true
   }
   ```

## Create an access policy and token for Alloy

This Terraform configuration creates the following:

- An access policy named `alloy-policy` with `set:alloy-data-write` scope, using [`grafana_cloud_access_policy` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy)
- A token named `alloy-token`, using [`grafana_cloud_access_policy_token` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy_token)

1. Create a file named `alloy-access-policy.tf` and add the following code block:

   ```terraform
   resource "grafana_cloud_access_policy" "alloy_policy" {
     provider = grafana.cloud

     name   = "alloy-policy"
     region = data.grafana_cloud_stack.stack.region_slug

     scopes = [
       "set:alloy-data-write"
     ]

     realm {
       type       = "stack"
       identifier = data.grafana_cloud_stack.stack.id
     }
   }

   resource "grafana_cloud_access_policy_token" "alloy_token" {
     provider = grafana.cloud

     name             = "alloy-token"
     region           = grafana_cloud_access_policy.alloy_policy.region
     access_policy_id = grafana_cloud_access_policy.alloy_policy.policy_id
   }

   output "alloy_token" {
     value     = grafana_cloud_access_policy_token.alloy_token.token
     sensitive = true
   }
   ```

## Create a configuration file for Alloy

This Terraform configuration creates an Alloy configuration file with the [`remotecfg` block](https://grafana.com/docs/grafana-cloud/send-data/alloy/reference/config-blocks/remotecfg/) for Fleet Management, using [`local_file` (Resource)](https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file).

1. Create a file named `config.alloy.tftpl` and add the following content:

   ```alloy
   remotecfg {
       id             = "${collector_id}"
       url            = "${fm_url}"
       poll_frequency = "60s"

       basic_auth {
           username = "${fm_id}"
           password = sys.env("GCLOUD_RW_API_KEY")
       }
   }
   ```

1. Create a file named `alloy-config.tf` and add the following code block:

   ```terraform
   resource "local_file" "alloy_config" {
     filename = "<ALLOY_CONFIG_PATH>"
     content = templatefile(
       "config.alloy.tftpl",
       {
         collector_id = "prod_collector",
         fm_id        = local.fm_id,
         fm_url       = local.fm_url,
       },
     )
     directory_permission = "0644"
     file_permission      = "0644"
   }
   ```

1. Replace the following field values:
   - `<ALLOY_CONFIG_PATH>` with the path the Alloy configuration file should be written to, for example `config.alloy`

## Apply the Terraform configuration

In a terminal, run the following commands from the directory where all of the configuration files are located.

1. Initialize a working directory containing Terraform configuration files:

   ```shell
   terraform init
   ```

1. Preview the Terraform changes:

   ```shell
   terraform plan
   ```

1. Apply the configuration:

   ```shell
   terraform apply
   ```

## Run Alloy

To learn how to start or restart Alloy, refer to [Run Grafana Alloy](https://grafana.com/docs/alloy/latest/set-up/run/).

{{< admonition type="note" >}}
The variable `GCLOUD_RW_API_KEY` must be set in the environment where Alloy is running for the remote configuration in this example to work.
{{< /admonition >}}

1. Run the following command to view the Alloy token:

   ```shell
   terraform output -raw alloy_token
   ```

1. Set the environment variable `GCLOUD_RW_API_KEY` to the value from the first step.
1. Run Alloy.

## Validation

After you apply the changes in the Terraform configurations and run Alloy, you should be able to verify the following:

- A collector is added to the Fleet Management **Inventory tab**:

  {{< figure alt="The Inventory screen in the Fleet Management interface in Grafana Cloud which shows that a new collector called `prod_collector` is registered with attribute `env=PROD`, has a healthy status, and was last modified a few seconds ago." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-collector.png" >}}

- A pipeline is added to the Fleet Management **Remote configuration tab**:

  {{< figure alt="The Remote configuration screen in the Fleet Management interface in Grafana Cloud which shows that a new configuration pipeline called `profiling` is active and was last modified a few seconds ago." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-pipeline.png" >}}

- Alloy profiles are being exported to Grafana Cloud Profiles:

  {{< figure alt="A dashboard in Grafana Cloud which shows Alloy profiling data, including graphs for CPU and memory." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-profiles.png" >}}

## Conclusion

In this guide, you created an access policy and a token for Fleet Management and Alloy, a collector with remote attributes, and a pipeline for profiling Alloy, all using Terraform.

To learn more about managing Grafana Cloud using Terraform, refer to [Grafana provider's documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
