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
This guide shows you how to create an access policy and a token for Fleet Management and manage resources for [Grafana Alloy](https://grafana.com/docs/alloy/latest/) or OpenTelemetry Collectors.

{{< admonition type="note" >}}
Grafana Fleet Management support for OpenTelemetry Collectors is currently in [private preview](https://grafana.com/docs/release-life-cycle/).
Grafana Labs offers support on a best-effort basis, and breaking changes might occur prior to the feature being made generally available. If you are interested in joining the preview, contact Grafana support.
{{< /admonition >}}

## Before you begin

Before you begin, you should have the following available:

- A Grafana Cloud account, as shown in [Get started](https://grafana.com/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine
- [Alloy](https://grafana.com/docs/alloy/latest/set-up/install/) (TODO: What should they have installed for OTel?) installed on your machine
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

## Create an access policy and token for the collector

This Terraform configuration creates the following:

- An access policy:
  - For Alloy collectors, the policy is named `alloy-policy` with `set:alloy-data-write` scope, using [`grafana_cloud_access_policy` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy)
  - For OpenTelemetry Collectors, the policy is named `otel-policy` with `otel-data-write` scope using [`grafana_cloud_access_policy` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy)
- A token:
  - For Alloy collectors, the token is named `alloy-token`, using [`grafana_cloud_access_policy_token` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy_token)
  - For OpenTelemetry Collectors, the token is named `otel-token`, using [`grafana_cloud_access_policy_token` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_access_policy_token)

1. Create a file and add the following code block:

   {{< tabs >}}
   {{< tab-content name="Alloy" >}}
   Create a file named `alloy-access-policy.tf`:

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

   {{< /tab-content >}}
   {{< tab-content name="OpenTelemetry" >}}

   Create a file named `otel-access-policy.tf`:

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

   {{< /tab-content >}}
   {{< /tabs >}}

## Create a local configuration file

This step creates a local configuration file for the collector or Supervisor, using [`local_file` (Resource)](https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file).

{{< tabs >}}
{{< tab-content name="Alloy" >}}

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

{{< /tab-content >}}
{{< tab-content name="OpenTelemetry" >}}

1. Create a file named `supervisor.yaml.tftpl` and add the following content:

   ```yaml
   server:
     endpoint: "${fm_url}/v1/opamp"
     headers:
       Authorization: "Basic ${fm_auth_base64}"

   capabilities:
     accepts_remote_config: true

   agent:
     executable: /path/to/collector/executable

   storage:
     directory: /path/to/storage
   ```

1. Create a file named `otel_config.tf` and add the following content:

   ```terraform
   variable "otel_token" {
     type        = string
     description = "Grafana Cloud OpenTelemetry token"
   }

   resource "local_file" "otel_config" {
     filename = "${path.module}/supervisor.yaml"
     content = templatefile(
       "supervisor.yaml.tftpl",
       {
         fm_auth_base64 = base64encode("${local.fm_id}:${var.otel_token}"),
         fm_url = local.fm_url,
       },
     )
     directory_permission = "0644"
     file_permission      = "0644"
   }
   ```

1. Run the command `terraform output -raw otel_token` to output the Fleet Management token.
1. Run the command `export TF_VAR_otel_token=<FM_TOKEN>`, replacing <FM_TOKEN> with the output of the previous command.
   Terraform fetches the variable and injects it into `${var.otel_token}` so that you can authenticate the Supervisor and its Collector.
   Use `${var.otel_token}` to authenticate any OpenTelemetry pipelines and collectors that are needed for Fleet Management.

{{< /tab-content >}}
{{< /tabs >}}

## Create a Fleet Management collector

This section tells you how to preregister Alloy collectors with Fleet Management.
Preregistration isn't possible with OpenTelemetry Collectors.
Refer to the OpenTelemetry tab for more information.

{{< tabs >}}
{{< tab-content name="Alloy" >}}
This Terraform configuration creates an Alloy collector with a remote attribute, using [`grafana_fleet_management_collector` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/fleet_management_collector).

This configuration only preregisters the collector.
You must complete the [Run Alloy](#run-the-collector) step for the collector to register with Fleet Management and be assigned remote attributes.

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

{{< /tab-content >}}
{{< tab-content name="OpenTelemetry" >}}
Fleet Management requires each collector in your fleet to have a universally unique identifier (UUID) so its health data is distinguishable from others and to prevent misconfiguration.
Users can't set UUIDs with the OpAMP Supervisor, which means preregistration isn't possible with OpenTelemetry Collectors.
Instead, the Supervisor generates a UUID on startup and registers its Collector with Fleet Management using this ID.
To manage an OpenTelemetry Collector as a Terraform resource, you must start the Supervisor, wait until the Collector registers with Fleet Management, and then import it to Terraform.
Continue following the OpenTelemetry steps in this guide to learn how to start the Supervisor and import the Collector.
{{< /tab-content >}}
{{< /tabs >}}

## Create a Fleet Management pipeline

This Terraform configuration creates a configuration pipeline with a matcher for the collector declared in the previous step, using [`grafana_fleet_management_pipeline` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/fleet_management_pipeline).
The Alloy pipeline writes the profiles to [Grafana Cloud Profiles](https://grafana.com/docs/grafana-cloud/monitor-applications/profiles/).
The OpenTelemetry pipeline collects host metrics and writes them to Grafana Cloud.

   {{< tabs >}}
   {{< tab-content name="Alloy" >}}

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

   {{< /tab-content >}}
   {{< tab-content name="OpenTelemetry" >}}

1. Create a file named `hostmetrics.otel.tftpl` and add the following content:

   ```yaml
   exporters:
     otlphttp/grafana_cloud:
       auth:
         authenticator: basicauth/grafana_cloud
       endpoint: https://otlp-gateway-prod-ca-east-0.grafana.net/otlp
   extensions:
     basicauth/grafana_cloud:
       client_auth:
         password: "${fm_token}"
         username: "${fm_user_id}"
   processors:
     batch: null
     resourcedetection:
       detectors:
         - env
         - system
       override: false
     transform/add_host_metric_attributes:
       error_mode: ignore
       metric_statements:
         - context: datapoint
           statements:
             - set(attributes["host.name"], resource.attributes["host.name"])
             - set(attributes["os.type"], resource.attributes["os.type"])
   receivers:
     hostmetrics:
       scrapers:
         load: null
         memory: null
   service:
     extensions:
       - basicauth/grafana_cloud
     pipelines:
       metrics/hostmetrics:
         exporters:
           - otlphttp/grafana_cloud
         processors:
           - resourcedetection
           - transform/add_host_metric_attributes
           - batch
         receivers:
           - hostmetrics
   ```

1. Create a file named `fm-pipeline.tf` and add the following code block.
   If your pipeline requires a token to authenticate to Fleet Management, use `${var.otel_token}` as a placeholder.
   Authentication will fail until you export this variable in the next step.

   ```terraform
   resource "grafana_fleet_management_pipeline" "host_metrics" {
     provider = grafana.fm

     name = "host_metrics"
     config_type = "OTEL"
     contents = templatefile(
       "hostmetrics.otel.tfpl",
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

{{< /tab-content >}}
{{< /tabs >}}

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

For a collector to register with Fleet Management, it must be running.
This step shows you how to run Alloy or the OpAMP Supervisor, which creates a running OpenTelemetry Collector.

{{< tabs >}}
{{< tab-content name="Alloy" >}}

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

{{< /tab-content >}}
{{< tab-content name="OpenTelemetry" >}}

When you run the OpAMP Supervisor, it creates a Collector instance.

TODO: Which env var need to be set? This is the list in the google doc:
Set the following environment variables:
GCLOUD_FM_URL to the Fleet Management URL used by your Grafana Cloud stack. You can find the URL in Grafana Cloud: navigate to the page Home > Connections > Collector > Fleet Management, select the tab API, and scroll to the section Base URLs.
GCLOUD_OTLP_URL to the OTLP gateway URL used by your Grafana Cloud stack. You can find the URL in Grafana Cloud Portal: scroll to the section Your stacks, select Details for your stack, configure the card OpenTelemetry, and scroll to the section OTLP Endpoint.
GCLOUD_INSTANCE_ID to your Grafana Cloud instance ID. You can find your instance ID in Grafana Cloud: navigate to the page Home > Connections > Collector > Fleet Management, select the tab API, and scroll to the section API Authentication.
GCLOUD_RW_API_KEY to the cloud access policy token that you created in Step 1.
GCLOUD_BASIC_AUTH to the base64-encoded representation of your basic authentication in username:password format, where the username is your cloud instance ID, and the password is the cloud access policy token.

Run the Supervisor with the following command:

```
opampsupervisor --config=supervisor-config.yaml <<<TODO: what is the file name we should put here?
```

{{< /tab-content >}}
{{< /tabs >}}

## [OpenTelemetry only] Import the Collectors

The OpAMP Supervisor has created a running Collector.
Before you can manage it in Fleet Management, however, you must import it.

1. Create a file named `fm-collector.tf` and add the following content:

   ```terraform
   resource "grafana_fleet_management_collector" "otel_collector" {
     provider = grafana.fm

     id = "<COLLECTOR_ID>"
     collector_type = "OTEL"
     remote_attributes = {
       "env" = "PROD"
     }
     enabled = true
   }
   ```

   Replace <COLLECTOR_ID> with the UUID generated by the Supervisor. TODO: Where do they find this ID?

1. Run the following command, replacing the <COLLECTOR_ID> placeholder with the same UUID in the previous step:

   ```
   terraform import grafana_fleet_management_collector.otel_collector <COLLECTOR_ID>
   ```

## Validation

After you apply the changes in the Terraform configurations and run the collector, you should be able to verify the following:

- A collector is added to the Fleet Management **Inventory tab**:

  {{< figure alt="The Inventory screen in the Fleet Management interface in Grafana Cloud which shows that a new collector called `prod_collector` is registered with attribute `env=PROD`, has a healthy status, and was last modified a few seconds ago." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-collector.png" >}}

- A pipeline is added to the Fleet Management **Remote configuration tab**:

  {{< figure alt="The Remote configuration screen in the Fleet Management interface in Grafana Cloud which shows that a new configuration pipeline called `profiling` is active and was last modified a few seconds ago." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-pipeline.png" >}}

- Telemetry is being exported to Grafana Cloud:

  {{< figure alt="A dashboard in Grafana Cloud which shows Alloy profiling data, including graphs for CPU and memory." src="/media/docs/fleet-management/screenshot-fleet-management-terraform-validate-profiles.png" >}}

## Conclusion

In this guide, you created an access policy and a token for Fleet Management and a collector, a collector with remote attributes, and a configuration pipeline, all using Terraform.

To learn more about managing Grafana Cloud using Terraform, refer to [Grafana provider's documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
