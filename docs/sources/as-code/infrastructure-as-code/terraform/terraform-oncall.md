---
description: Learn how to create Grafana IRM integrations, escalation policies, and on-call schedules in Grafana Cloud using Terraform
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Grafana Cloud IRM
  - OnCall
title: Manage Grafana IRM in Grafana Cloud using Terraform
weight: 120
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-oncall/
---

# Manage Grafana IRM in Grafana Cloud using Terraform

Learn how to use Terraform to manage [Grafana IRM](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/) resources.
This guide shows you how to connect an integration, configure escalation policies, and add on-call schedules using Terraform.

To illustrate the use of IRM across multiple teams, this guide features examples with two teams: `Devs` and `SREs`.
Additionally, it includes the necessary steps to configure Slack for IRM.

{{< admonition type="note" >}}
Grafana IRM supports Terraform-based configuration for a limited set of resources, primarily those related to OnCall functionality.
These resources use the `grafana_oncall_` naming convention in Terraform. Additional IRM components are not yet configurable via Terraform.
{{< /admonition >}}

## Before you begin

Before you begin, you should have the following:

- A Grafana Cloud account, as shown in [Get started](https://grafana.com/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine
- Administrator permissions in your Grafana instance
- (Optional) Administrator permissions in your Slack workspace, if you plan to integrate Slack with Grafana IRM

{{< admonition type="note" >}}
All of the following Terraform configuration files should be saved in the same directory.
{{< /admonition >}}

## Connect Slack to Grafana IRM

Before including Slack settings in your Terraform setup, you must first configure the Slack integration with Grafana IRM.

To connect your Slack workspace to Grafana IRM, refer to the [Slack integration for Grafana IRM](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/configure/integrations/irm-slack/) documentation.

## Configure the Grafana provider

This Terraform configuration sets up the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide necessary authentication when managing resources for Grafana IRM.

You can reuse a similar setup to the one described in [Creating and managing a Grafana Cloud stack using Terraform](../terraform-cloud-stack/) to set up a service account and a token.

1. Create a Service account and token in Grafana. To create a new one, refer to [Service account tokens](https://grafana.com/docs/grafana/latest/administration/service-accounts/#service-account-tokens).

1. Create a file named `main.tf` and add the following:

   ```terraform
   terraform {
     required_providers {
       grafana = {
         source  = "grafana/grafana"
         version = ">= 3.15.3"
       }
     }
   }

   provider "grafana" {
     alias = "oncall"

     url  = "<Stack-URL>"
     auth = "<Service-account-token>"
     oncall_url = "<OnCall-URL>"
   }
   ```

1. Replace the following field values:
   - `<Stack-URL>` with the URL of your Grafana stack
   - `<Service-account-token>` with the service account token that you created
   - `<OnCall-URL>` with the API URL found on the **Admin & API** tab of the IRM **Settings** page

{{< admonition type="note" >}}
If the service account has the right permissions, this provider setup also allows you to manage other Grafana resources.
{{< /admonition >}}

### Authentication via OnCall API tokens (deprecated)

OnCall API tokens are being deprecated.
While existing tokens will continue to work, we recommend using
[Grafana Cloud service account tokens](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/service-accounts/) for all new API authentication.

{{< collapse title="Authentication via OnCall API tokens" >}}
To use an existing OnCall API token:

1. Log into your Grafana Cloud instance
1. Select **Alerts & IRM** > **IRM**
1. Click **Settings**, and then select **Admin & API**
1. Locate the **Grafana IRM API** section
1. View, copy or revoke existing **OnCall API tokens**

1. Create a file named `main.tf` and add the following:

   ```terraform
   terraform {
     required_providers {
       grafana = {
         source  = "grafana/grafana"
         version = ">= 2.9.0"
       }
     }
   }

   provider "grafana" {
     alias = "oncall"

     oncall_access_token = "<OnCall-API-Token>"
     oncall_url = "<OnCall-URL>"
   }
   ```

1. Replace the following field values:
   - `<OnCall-API-Token>` with your existing OnCall API Token
   - `<OnCall-URL>` with the API URL found on the **Admin & API** tab of the IRM **Settings** page
     {{< /collapse >}}

## Add on-call schedules

This Terraform configuration sets up two on-call schedules, `SREs` and `Devs`, using the [`grafana_oncall_schedule` resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/oncall_schedule) to define the schedules within Grafana IRM.
Additionally, this configuration includes Slack channels to receive notifications for the on-call schedules of each team.

To learn more about managing on-call schedules, refer to the [On-call schedules documentation](https://grafana.com/docs/grafana-cloud/alerting-and-irm/irm/manage/on-call-schedules/).

1. Create two new calendars in your calendar service, one for `Devs` and one for `SREs`

1. Locate and save the secret iCal URLs.
   For example, in a Google calendar, these URLs can be found in **Settings > Settings for my calendars > Integrate calendar**

1. Create a file named `schedule.tf` and add the following:

   ```terraform
   # Name of the Slack channel to notify about on-call schedules for Devs
   data "grafana_oncall_slack_channel" "Devs" {
     provider = grafana.oncall

     name = "<Devs-channel-name>"
   }

   # Name of the Slack channel to notify about on-call schedules for SREs
   data "grafana_oncall_slack_channel" "SREs" {
     provider = grafana.oncall

     name = "<SREs-channel-name>"
   }

   resource "grafana_oncall_schedule" "schedule_Devs" {
     provider = grafana.oncall

     name             = "Devs"
     type             = "ical"
     ical_url_primary = "<secret-iCal-URL-for-devs-calendar>"
     slack {
       channel_id = data.grafana_oncall_slack_channel.Devs.slack_id
     }
   }

   resource "grafana_oncall_schedule" "schedule_SREs" {
     provider = grafana.oncall

     name             = "SREs"
     type             = "ical"
     ical_url_primary = "<secret-iCal-URL-for-SREs-calendar>"
     slack {
       channel_id = data.grafana_oncall_slack_channel.SREs.slack_id
     }
   }
   ```

1. Replace the following field values:
   - `<Devs-channel-name>` with name of the Slack channel to notify about on-call schedules for `Devs`
   - `<SREs-channel-name>` with name of the Slack channel to notify about on-call schedules for `SREs`
   - `<secret-iCal-URL-for-devs-calendar>` with the secret iCal URL created in the first step for `Devs` Calendar
   - `<secret-iCal-URL-for-SREs-calendar>` with the secret iCal URL created in the first step for `SREs` Calendar

## Add escalation chains

This Terraform configuration creates two escalation chains named `SREs` and `Devs` in Grafana IRM using the [`grafana_oncall_escalation_chain` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/oncall_escalation_chain).
The configuration also adds the following three steps to each escalation chain using the [`grafana_oncall_escalation` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/oncall_escalation):

- Notify users from on-call schedule
- Wait for 5 minutes
- Notify default Slack channel

1. Create a file named `escalation-devs.tf` and add the following:

   ```terraform
   resource "grafana_oncall_escalation_chain" "Devs" {
     provider = grafana.oncall

     name = "Devs"
   }

   // Notify users from on-call schedule
   resource "grafana_oncall_escalation" "notify_schedule_step_Devs" {
     provider = grafana.oncall

     escalation_chain_id          = grafana_oncall_escalation_chain.Devs.id
     type                         = "notify_on_call_from_schedule"
     notify_on_call_from_schedule = grafana_oncall_schedule.schedule_Devs.id
     position                     = 0
   }

   // Wait step for 5 Minutes
   resource "grafana_oncall_escalation" "wait_step_Devs" {
     provider = grafana.oncall

     escalation_chain_id = grafana_oncall_escalation_chain.Devs.id
     type                = "wait"
     duration            = 300
     position            = 1
   }

   // Notify default Slack channel step
   resource "grafana_oncall_escalation" "notify_step_Devs" {
     provider = grafana.oncall

     escalation_chain_id = grafana_oncall_escalation_chain.Devs.id
     type                = "notify_whole_channel"
     important           = true
     position            = 2
   }
   ```

2. Create a file named `escalation-sre.tf` and add the following:

   ```terraform
   resource "grafana_oncall_escalation_chain" "SREs" {
     provider = grafana.oncall

     name = "SREs"
   }

   // Notify users from on-call schedule
   resource "grafana_oncall_escalation" "notify_schedule_step_SREs" {
     provider = grafana.oncall

     escalation_chain_id          = grafana_oncall_escalation_chain.SREs.id
     type                         = "notify_on_call_from_schedule"
     notify_on_call_from_schedule = grafana_oncall_schedule.schedule_SREs.id
     position                     = 0
   }

   // Wait step for 5 Minutes
   resource "grafana_oncall_escalation" "wait_step_SREs" {
     provider = grafana.oncall

     escalation_chain_id = grafana_oncall_escalation_chain.SREs.id
     type                = "wait"
     duration            = 300
     position            = 1
   }

   // Notify default Slack channel step
   resource "grafana_oncall_escalation" "notify_step_SREs" {
     provider = grafana.oncall

     escalation_chain_id = grafana_oncall_escalation_chain.SREs.id
     type                = "notify_whole_channel"
     important           = true
     position            = 2
   }
   ```

## Connect an integration to Grafana IRM

This Terraform configuration connects Alertmanager to Grafana IRM using the [`grafana_oncall_integration` (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/oncall_integration).
It also adds the `Devs` escalation chain as the default route for alerts.

1. Create a file named `integrations.tf` and add the following:

   ```terraform
   resource "grafana_oncall_integration" "AlertManager" {
     provider = grafana.oncall

     name = "AlertManager"
     type = "alertmanager"
     default_route {
       escalation_chain_id = grafana_oncall_escalation_chain.Devs.id
     }
   }
   ```

1. To configure Alertmanager, refer to [Alertmanager integration for Grafana OnCall](https://grafana.com/docs/grafana-cloud/alerting-and-irm/oncall/integrations/alertmanager/)

## Set up a route to configure escalation behavior for alert group notifications

This Terraform configuration sets up a route to the Alertmanager integration using the `grafana_oncall_route` (Resource).
This route ensures that notifications for alerts with `\"namespace\" *: *\"ops-.*\"` in the payload are escalated to the `SREs` escalation chain.

Create a file named `routes.tf` and add the following:

```terraform
resource "grafana_oncall_route" "route_SREs" {
  provider = grafana.oncall

  integration_id      = grafana_oncall_integration.AlertManager.id
  escalation_chain_id = grafana_oncall_escalation_chain.SREs.id
  routing_regex       = "\"namespace\" *: *\"ops-.*\""
  position            = 0
}
```

## Apply the Terraform configuration

In a terminal, run the following commands from the directory where all of the configuration files are located.

1. Initialize a working directory containing Terraform configuration files.

   ```shell
   terraform init
   ```

1. Preview the changes that Terraform will make.

   ```shell
   terraform plan
   ```

1. Apply the configuration files.

   ```shell
   terraform apply
   ```

## Validation

After you apply the changes in the Terraform configurations, you can verify the following:

- Two new Schedules named `Devs` and `SREs` are created in Grafana IRM:

  ![`Devs` and `SREs` OnCall schedules](/media/docs/grafana-cloud/alerting-and-irm/screenshot-oncall-schedules-tf.png)

- New Escalation chain named `SREs` is created in Grafana IRM:

  ![`SREs` escalation chain](/media/docs/grafana-cloud/alerting-and-irm/screenshot-oncall-escalation-sre-tf.png)

- New Escalation chain named `Devs` is created in Grafana IRM:

  ![`Devs` escalation chain](/media/docs/grafana-cloud/alerting-and-irm/screenshot-oncall-escalation-devs-tf.png)

- The Alertmanager integration is added and configured with escalation policies:

  ![Alertmanager integration for SREs escalation](/media/docs/grafana-cloud/alerting-and-irm/screenshot-oncall-alertmanager-tf.png)

## Conclusion

In this guide, you learned how to use Terraform to manage Grafana IRM by connecting an integration, configuring escalation policies, and setting up on-call schedules.

To learn more about managing Grafana Cloud using Terraform, refer to [Grafana provider's documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
