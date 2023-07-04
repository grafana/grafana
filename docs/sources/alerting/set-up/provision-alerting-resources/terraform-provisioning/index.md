---
aliases:
  - ../../provision-alerting-resources/terraform-provisioning/
description: Create and manage alerting resources using Terraform
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
  - Terraform
title: Create and manage alerting resources using Terraform
weight: 200
---

# Create and manage alerting resources using Terraform

Use Terraform’s Grafana Provider to manage your alerting resources and provision them into your Grafana system. Terraform provider support for Grafana Alerting makes it easy to create, manage, and maintain your entire Grafana Alerting stack as code.

For more information on managing your alerting resources using Terraform, refer to the [Grafana Provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) documentation.

Complete the following tasks to create and manage your alerting resources using Terraform.

1. Create an API key for provisioning.
1. Configure the Terraform provider.
1. Define your alerting resources in Terraform.
1. Run `terraform apply` to provision your alerting resources.

## Before you begin

- Ensure you have the grafana/grafana [Terraform provider](https://registry.terraform.io/providers/grafana/grafana/1.28.0) 1.27.0 or higher.

- Ensure you are using Grafana 9.1 or higher.

## Create an API key for provisioning

You can [create a normal Grafana API key]({{< relref "../../../../administration/api-keys" >}}) to authenticate Terraform with Grafana. Most existing tooling using API keys should automatically work with the new Grafana Alerting support.

There are also dedicated RBAC roles for alerting provisioning. This lets you easily authenticate as a [service account]({{< relref "../../../../administration/service-accounts" >}}) with the minimum permissions needed to provision your Alerting infrastructure.

To create an API key for provisioning, complete the following steps.

1. Create a new service account for your CI pipeline.
1. Assign the role “Access the alert rules Provisioning API.”
1. Create a new service account token.
1. Name and save the token for use in Terraform.

Alternatively, you can use basic authentication. To view all the supported authentication formats, see [here](https://registry.terraform.io/providers/grafana/grafana/latest/docs#authentication).

## Configure the Terraform provider

Grafana Alerting support is included as part of the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

The following is an example you can use to configure the Terraform provider.

```terraform
terraform {
    required_providers {
        grafana = {
            source = "grafana/grafana"
            version = ">= 1.28.2"
        }
    }
}

provider "grafana" {
    url = <YOUR_GRAFANA_URL>
    auth = <YOUR_GRAFANA_API_KEY>
}
```

## Provision contact points and templates

Contact points connect an alerting stack to the outside world. They tell Grafana how to connect to your external systems and where to deliver notifications. There are over fifteen different [integrations](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/contact_point#optional) to choose from.

To provision contact points and templates, complete the following steps.

1. Copy this code block into a .tf file on your local machine.

This example creates a contact point that sends alert notifications to Slack.

```terraform
resource "grafana_contact_point" "my_slack_contact_point" {
    name = "Send to My Slack Channel"

    slack {
        url = <YOUR_SLACK_WEBHOOK_URL>
        text = <<EOT
{{ len .Alerts.Firing }} alerts are firing!

Alert summaries:
{{ range .Alerts.Firing }}
{{ template "Alert Instance Template" . }}
{{ end }}
EOT
    }
}
```

2. Enter text for your notification in the text field.

The `text` field supports [Go-style templating](https://pkg.go.dev/text/template). This enables you to manage your Grafana Alerting notification templates directly in Terraform.

3. Run the command ‘terraform apply’.

4. Go to the Grafana UI and check the details of your contact point.

You cannot edit resources provisioned via Terraform from the UI. This ensures that your alerting stack always stays in sync with your code.

5. Click **Test** to verify that the contact point works correctly.

**Note:**

You can re-use the same templates across many contact points. In the example above, a shared template ie embedded using the statement `{{ template “Alert Instance Template” . }}`

This fragment can then be managed separately in Terraform:

```terraform
resource "grafana_message_template" "my_alert_template" {
    name = "Alert Instance Template"

    template = <<EOT
{{ define "Alert Instance Template" }}
Firing: {{ .Labels.alertname }}
Silence: {{ .SilenceURL }}
{{ end }}
EOT
}
```

## Provision notification policies and routing

Notification policies tell Grafana how to route alert instances, as opposed to where. They connect firing alerts to your previously defined contact points using a system of labels and matchers.

To provision notification policies and routing, complete the following steps.

1. Copy this code block into a .tf file on your local machine.

In this example, the alerts are grouped by `alertname`, which means that any notifications coming from alerts which share the same name, are grouped into the same Slack message.

If you want to route specific notifications differently, you can add sub-policies. Sub-policies allow you to apply routing to different alerts based on label matching. In this example, we apply a mute timing to all alerts with the label a=b.

```terraform
resource "grafana_notification_policy" "my_policy" {
    group_by = ["alertname"]
    contact_point = grafana_contact_point.my_slack_contact_point.name

    group_wait = "45s"
    group_interval = "6m"
    repeat_interval = "3h"

    policy {
        matcher {
            label = "a"
            match = "="
            value = "b"
        }
        group_by = ["..."]
        contact_point = grafana_contact_point.a_different_contact_point.name
        mute_timings = [grafana_mute_timing.my_mute_timing.name]

        policy {
            matcher {
                label = "sublabel"
                match = "="
                value = "subvalue"
            }
            contact_point = grafana_contact_point.a_third_contact_point.name
            group_by = ["..."]
        }
    }
}
```

2. In the mute_timings field, link a mute timing to your notification policy.

3. Run the command ‘terraform apply’.

4. Go to the Grafana UI and check the details of your notification policy.

**Note:**

You cannot edit resources provisioned from Terraform from the UI. This ensures that your alerting stack always stays in sync with your code.

5. Click **Test** to verify that the notification point is working correctly.

## Provision mute timings

Mute timings provide the ability to mute alert notifications for defined time periods.

To provision mute timings, complete the following steps.

1. Copy this code block into a .tf file on your local machine.

In this example, alert notifications are muted on weekends.

```terraform
resource "grafana_mute_timing" "my_mute_timing" {
    name = "My Mute Timing"

    intervals {
        times {
          start = "04:56"
          end = "14:17"
        }
        weekdays = ["saturday", "sunday", "tuesday:thursday"]
        months = ["january:march", "12"]
        years = ["2025:2027"]
    }
}
```

2. Run the command ‘terraform apply’.
3. Go to the Grafana UI and check the details of your mute timing.
4. Reference your newly created mute timing in a notification policy using the `mute_timings` field.
   This will apply your mute timing to some or all of your notifications.

**Note:**

You cannot edit resources provisioned from Terraform from the UI. This ensures that your alerting stack always stays in sync with your code.

5. Click **Test** to verify that the mute timing is working correctly.

## Provision alert rules

[Alert rules]({{< relref "../../../alerting-rules" >}}) enable you to alert against any Grafana data source. This can be a data source that you already have configured, or you can [define your data sources in Terraform](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source) alongside your alert rules.

To provision alert rules, complete the following steps.

1. Create a data source to query and a folder to store your rules in.

In this example, the [TestData]({{< relref "../../../../datasources/testdata" >}}) data source is used.

Alerts can be defined against any backend datasource in Grafana.

```terraform
resource "grafana_data_source" "testdata_datasource" {
    name = "TestData"
    type = "testdata"
}

resource "grafana_folder" "rule_folder" {
    title = "My Rule Folder"
}
```

2. Define an alert rule.

For more information on alert rules, refer to [how to create Grafana-managed alerts](/blog/2022/08/01/grafana-alerting-video-how-to-create-alerts-in-grafana-9/).

3. Create a rule group containing one or more rules.

In this example, the `grafana_rule_group` resource group is used.

```terraform
resource "grafana_rule_group" "my_rule_group" {
    name = "My Alert Rules"
    folder_uid = grafana_folder.rule_folder.uid
    interval_seconds = 60
    org_id = 1

    rule {
        name = "My Random Walk Alert"
        condition = "C"
        for = "0s"

        // Query the datasource.
        data {
            ref_id = "A"
            relative_time_range {
                from = 600
                to = 0
            }
            datasource_uid = grafana_data_source.testdata_datasource.uid
            // `model` is a JSON blob that sends datasource-specific data.
            // It's different for every datasource. The alert's query is defined here.
            model = jsonencode({
                intervalMs = 1000
                maxDataPoints = 43200
                refId = "A"
            })
        }

        // The query was configured to obtain data from the last 60 seconds. Let's alert on the average value of that series using a Reduce stage.
        data {
            datasource_uid = "__expr__"
            // You can also create a rule in the UI, then GET that rule to obtain the JSON.
            // This can be helpful when using more complex reduce expressions.
            model = <<EOT
{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"params":[],"type":"last"},"type":"avg"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","hide":false,"intervalMs":1000,"maxDataPoints":43200,"reducer":"last","refId":"B","type":"reduce"}
EOT
            ref_id = "B"
            relative_time_range {
                from = 0
                to = 0
            }
        }

        // Now, let's use a math expression as our threshold.
        // We want to alert when the value of stage "B" above exceeds 70.
        data {
            datasource_uid = "__expr__"
            ref_id = "C"
            relative_time_range {
                from = 0
                to = 0
            }
            model = jsonencode({
                expression = "$B > 70"
                type = "math"
                refId = "C"
            })
        }
    }
}
```

4. Go to the Grafana UI and check your alert rule.

You can see whether or not the alert rule is firing. You can also see a visualization of each of the alert rule’s query stages

When the alert fires, Grafana routes a notification through the policy you defined.

For example, if you chose Slack as a contact point, Grafana’s embedded [Alertmanager](https://github.com/prometheus/alertmanager) automatically posts a message to Slack.
