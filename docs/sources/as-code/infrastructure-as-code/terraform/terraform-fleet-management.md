---
description: Learn how to create Grafana Fleet Management collectors and pipelines in Grafana Cloud using Terraform
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Fleet Management
  - Alloy
  - OpenTelemetry Collector
  - OpAMP
labels:
  products:
    - cloud
title: Manage Fleet Management in Grafana Cloud using Terraform
weight: 200
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-fleet-management/
---

# Manage Fleet Management in Grafana Cloud using Terraform

Learn how to create [Grafana Fleet Management](https://grafana.com/docs/grafana-cloud/send-data/fleet-management/) collectors and pipelines in Grafana Cloud using Terraform.
This guide shows you how to create an access policy and a token for Fleet Management, preregister a collector with remote attributes, and create a configuration pipeline.

Fleet Management supports [Grafana Alloy](https://grafana.com/docs/alloy/latest/) and the [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/).
The two collector types connect to Fleet Management differently and use different configuration syntax, so this guide shows both paths side by side.
Follow the Alloy steps, the OpenTelemetry Collector steps, or both if you're managing a mixed fleet.

## Before you begin

Before you begin, ensure you have the following:

- A Grafana Cloud account, as shown in [Get started](https://grafana.com/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine
- Administrator permissions in your Grafana instance
- One of the following collectors installed on your machine:
  - [Alloy](https://grafana.com/docs/alloy/latest/set-up/install/)
  - A supported OpenTelemetry Collector distribution that includes the [OpAMP extension](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/extension/opampextension) (for example, `otelcol-contrib`), along with the [OpAMP Supervisor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/cmd/opampsupervisor)

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

## Create an access policy and token for your collector

Alloy and the OpenTelemetry Collector need properly scoped access to read remote configuration from Fleet Management and write telemetry to Grafana Cloud.

### Alloy

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

### OpenTelemetry Collector

This Terraform configuration creates the following:

- An access policy named `otel-policy` with `set:otel-data-write` scope, using [`grafana_cloud_access_policy` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy)
- A token named `otel-token`, using [`grafana_cloud_access_policy_token` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy_token)

1. Create a file named `otel-access-policy.tf` and add the following code block:

   ```terraform
   resource "grafana_cloud_access_policy" "otel_policy" {
     provider = grafana.cloud

     name   = "otel-policy"
     region = data.grafana_cloud_stack.stack.region_slug

     scopes = [
       "set:otel-data-write"
     ]

     realm {
       type       = "stack"
       identifier = data.grafana_cloud_stack.stack.id
     }
   }

   resource "grafana_cloud_access_policy_token" "otel_token" {
     provider = grafana.cloud

     name             = "otel-token"
     region           = grafana_cloud_access_policy.otel_policy.region
     access_policy_id = grafana_cloud_access_policy.otel_policy.policy_id
   }

   output "otel_token" {
     value     = grafana_cloud_access_policy_token.otel_token.token
     sensitive = true
   }
   ```

## Create a configuration file for your collector

In this step, you create a local configuration file for Alloy or the OpAMP Supervisor.

### Alloy

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

### OpenTelemetry Collector

This Terraform configuration creates a Supervisor configuration file that connects the OpenTelemetry Collector to Fleet Management over [OpAMP](https://github.com/open-telemetry/opamp-spec), using [`local_file` (Resource)](https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file).

1. Create a file named `supervisor.yaml.tftpl` and add the following content:

   ```yaml
   server:
     endpoint: '${fm_url}/v1/opamp'
     headers:
       Authorization: 'Basic ${fm_auth_base64}'

   capabilities:
     reports_effective_config: true
     accepts_remote_config: true
     reports_remote_config: true

   agent:
     executable: '<OTELCOL_EXECUTABLE_PATH>'

   storage:
     directory: '<STORAGE_DIRECTORY>'
   ```

1. Create a file named `otel-supervisor-config.tf` and add the following code block:

   ```terraform
   variable "otel_token" {
     type        = string
     description = "Grafana Cloud OpenTelemetry token"
   }

   resource "local_file" "otel_supervisor_config" {
     filename = "${path.module}/supervisor.yaml"
     content = templatefile(
       "supervisor.yaml.tftpl",
       {
         fm_auth_base64 = base64encode("${local.fm_id}:${var.otel_token}"),
         fm_url         = local.fm_url,
       },
     )
     directory_permission = "0644"
     file_permission      = "0644"
   }
   ```

1. Replace the following field values:
   - `<OTELCOL_EXECUTABLE_PATH>` with the path to your OpenTelemetry Collector executable
   - `<STORAGE_DIRECTORY>` with the path to a writable directory to use for [persistent data storage](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/cmd/opampsupervisor/README.md#persistent-data-storage).

## Create a Fleet Management collector

This step registers a collector with a remote attribute, using [`grafana_fleet_management_collector` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/fleet_management_collector).
The `collector_type` argument tells Fleet Management which configuration syntax and validation to expect for the collector: `ALLOY` (the default) or `OTEL`.

The following configurations only preregister the collector.
You must complete the [Run the collector](#run-the-collector) step for the collector to connect to Fleet Management and be assigned remote attributes.

### Alloy

1. Create a file named `fm-collector-alloy.tf` and add the following code block:

   ```terraform
   resource "grafana_fleet_management_collector" "fm_collector_alloy" {
     provider = grafana.fm

     id = "prod_alloy_collector"
     collector_type = "ALLOY"
     remote_attributes = {
       "env" = "PROD"
     }
     enabled = true
   }
   ```

### OpenTelemetry Collector

1. Create a file named `fm-collector-otel.tf` and add the following code block:

   ```terraform
   resource "grafana_fleet_management_collector" "fm_collector_otel" {
     provider = grafana.fm

     id = "prod_otel_collector"
     collector_type = "OTEL"
     remote_attributes = {
       "env" = "PROD"
     }
     enabled = true
   }
   ```

## Create a Fleet Management pipeline

The following Terraform configurations create pipelines with [matchers](https://grafana.com/docs/grafana-cloud/send-data/fleet-management/introduction/glossary/#attribute-matching) for the collectors declared in the previous step, using [`grafana_fleet_management_pipeline` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/fleet_management_pipeline).
The `config_type` argument tells Fleet Management how to parse and validate the `contents` argument: `ALLOY` (the default) expects Alloy configuration syntax, and `OTEL` expects OpenTelemetry Collector YAML.

Fleet Management delivers a pipeline only to collectors of the matching `collector_type`, so an `ALLOY` pipeline and an `OTEL` pipeline can safely share the same matchers.

### Alloy profiling pipeline

This pipeline profiles Alloy itself and writes the profiles to [Grafana Cloud Profiles](https://grafana.com/docs/grafana-cloud/monitor-applications/profiles/).

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

1. Create a file named `fm-pipeline-alloy-profiles.tf` and add the following code block:

   ```terraform
   locals {
     profiles_id  = data.grafana_cloud_stack.stack.profiles_user_id
     profiles_url = data.grafana_cloud_stack.stack.profiles_url
   }

   resource "grafana_fleet_management_pipeline" "profiles" {
     provider = grafana.fm

     name        = "alloy_profiling"
     config_type = "ALLOY"
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

### OpenTelemetry Collector host metrics pipeline

This pipeline collects host metrics with the [`hostmetrics` receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/hostmetricsreceiver) and writes them to Grafana Cloud over [OTLP](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/).

1. Create a file named `hostmetrics.otel.yaml.tftpl` and add the following content:

   ```yaml
   # This pipeline collects host metrics and sends them to Grafana Cloud over OTLP.
   receivers:
     hostmetrics:
       scrapers:
         memory: null
         load: null

   extensions:
     basicauth/grafana_cloud:
       client_auth:
         username: '${fm_user_id}'
         password: '${fm_token}'

   exporters:
     otlp_http/grafana_cloud:
       # Replace the following placeholder with the OTLP endpoint for your stack.
       endpoint: <OTLP_ENDPOINT>
       auth:
         authenticator: basicauth/grafana_cloud

   service:
     extensions: [basicauth/grafana_cloud]
     pipelines:
       metrics:
         receivers: [hostmetrics]
         exporters: [otlp_http/grafana_cloud]
   ```

1. Create a file named `fm-pipeline-otel-hostmetrics.tf` and add the following code block:

   ```terraform
   resource "grafana_fleet_management_pipeline" "host_metrics" {
     provider = grafana.fm

     name        = "otel_host_metrics"
     config_type = "OTEL"
     contents = templatefile(
       "hostmetrics.otel.yaml.tftpl",
       {
         fm_token  = var.otel_token,
         fm_user_id = local.fm_id,
       },
     )
     matchers = [
       "env=\"PROD\""
     ]
     enabled = true
   }
   ```

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

## Run the collector

The final step is to start your collector.
Make sure to set an environment variable containing the access token.
The pipelines used in this guide won't work without it.

### Alloy

1. Run the following command to view the Alloy token:

   ```shell
   terraform output -raw alloy_token
   ```

1. Set the environment variable `GCLOUD_RW_API_KEY` to the value from the first step.
1. Run Alloy.
   To learn how to start or restart Alloy, refer to [Run Grafana Alloy](https://grafana.com/docs/alloy/latest/set-up/run/).

### OpenTelemetry Collector

1. Run the following command to view the Fleet Management token.

   ```shell
   terraform output -raw otel_token
   ```

1. Run the following command, substituting the value from the first step, to export the token as an environment variable.
   Terraform fetches and injects the variable into `${var.otel_token}`.
   You can use `${var.otel_token}` to authenticate all your OpenTelemetry Collectors and pipelines to the Fleet Management service.

   ```shell
   export TF_VAR_otel_token=<TOKEN>
   ```

1. Start the Supervisor:

   ```shell
   opampsupervisor --config=supervisor.yaml
   ```

## Validation

After you apply the changes in the Terraform configurations and run your collector, you should be able to verify the following:

- A collector is added to the Fleet Management **Inventory tab**, showing the `collector_type` you configured (`ALLOY` or `OTEL`):

  {{< figure alt="The Inventory screen in the Fleet Management interface in Grafana Cloud which shows that a new collector called `prod_collector` is registered with attribute `env=PROD`, has a healthy status, and was last modified a few seconds ago." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-collector.png" >}}

- A pipeline is added to the Fleet Management **Remote configuration tab**:

  {{< figure alt="The Remote configuration screen in the Fleet Management interface in Grafana Cloud which shows that a new configuration pipeline called `profiling` is active and was last modified a few seconds ago." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-pipeline.png" >}}

- Telemetry is being exported to Grafana Cloud. For example, Alloy profiles are visible in Grafana Cloud Profiles:

  {{< figure alt="A dashboard in Grafana Cloud which shows Alloy profiling data, including graphs for CPU and memory." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-profiles.png" >}}

## Summary

In this guide, you created an access policy and a token for Fleet Management, registered an Alloy instance or OpenTelemetry Collector with remote attributes, and created a configuration pipeline based on collector type, all using Terraform.

To learn more about managing Grafana Cloud using Terraform, refer to the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
