---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/terraform-provisioning/
description: Create and manage alerting resources using Terraform
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
  - Terraform
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Use Terraform to provision
title: Use Terraform to provision alerting resources
weight: 200
---

# Use Terraform to provision alerting resources

Use Terraform’s Grafana Provider to manage your alerting resources and provision them into your Grafana system. Terraform provider support for Grafana Alerting makes it easy to create, manage, and maintain your entire Grafana Alerting stack as code.

This guide outlines the steps and references to provision alerting resources with Terraform. For a practical demo, you can clone and try this [example using Grafana OSS and Docker Compose](https://github.com/grafana/provisioning-alerting-examples/tree/main/terraform).

To create and manage your alerting resources using Terraform, you have to complete the following tasks.

1. Create an API key to configure the Terraform provider.
1. Create your alerting resources in Terraform format by
   - [exporting configured alerting resources][alerting_export]
   - or writing the [Terraform Alerting schemas](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
     > By default, you cannot edit provisioned resources. Enable [`disable_provenance` in the Terraform resource](#enable-editing-resources-in-the-grafana-ui) to allow changes in the Grafana UI.
1. Run `terraform apply` to provision your alerting resources.

Before you begin, you should have available a Grafana instance and [Terraform installed](https://www.terraform.io/downloads) on your machine.

## Create an API key and configure the Terraform provider

You can create a [service account token][service-accounts] to authenticate Terraform with Grafana. To create an API key for provisioning alerting resources, complete the following steps.

1. Create a new service account.
1. Assign the role or permission to access the [Alerting provisioning API][alerting_http_provisioning].
1. Create a new service account token.
1. Name and save the token for use in Terraform.

You can now move to the working directory for your Terraform configurations, and create a file named `main.tf` like:

```main.tf
terraform {
    required_providers {
        grafana = {
            source = "grafana/grafana"
            version = ">= 2.9.0"
        }
    }
}

provider "grafana" {
    url = <grafana-url>
    auth = <api-key>
}
```

Replace the following values:

- `<grafana-url>` with the URL of the Grafana instance.
- `<api-key>` with the API token previously created.

This Terraform configuration installs the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) and authenticates against your Grafana instance using an API token. For other authentication alternatives including basic authentication, refer to the [`auth` option documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs#authentication).

For Grafana Cloud, refer to the [instructions to manage a Grafana Cloud stack with Terraform][provision-cloud-with-terraform]. For role-based access control, refer to [Provisioning RBAC with Terraform][rbac-terraform-provisioning] and the [alerting provisioning roles (`fixed:alerting.provisioning.*`)][rbac-role-definitions].

## Create Terraform configurations for alerting resources

[Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) enables you to manage the following alerting resources.

| Alerting resource                               | Terraform resource                                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Alert rules][alerting-rules]                   | [grafana_rule_group](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/rule_group)                   |
| [Contact points][contact-points]                | [grafana_contact_point](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/contact_point)             |
| [Notification templates][notification-template] | [grafana_message_template](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/message_template)       |
| [Notification policy tree][notification-policy] | [grafana_notification_policy](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/notification_policy) |
| [Mute timings][mute-timings]                    | [grafana_mute_timing](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/mute_timing)                 |

In this section, we'll create Terraform configurations for each alerting resource and demonstrate how to link them together.

### Add alert rules

[Alert rules][alerting-rules] enable you to receive alerts by querying any backend Grafana data sources.

1. First, create a data source to query and a folder to store your rules in.

   In this example, the [TestData][testdata] data source is used.

   ```terraform
   resource "grafana_data_source" "<terraform_data_source_name>" {
       name = "TestData"
       type = "testdata"
   }

   resource "grafana_folder" "<terraform_folder_name>" {
       title = "My Rule Folder"
   }
   ```

   Replace the following field values:

   - `<terraform_data_source_name>` with the terraform name of the data source.
   - `<terraform_folder_name>` with the terraform name of the folder.

1. Create or find an alert rule you want to import in Grafana.

1. [Export][alerting_export] the alert rule group in Terraform format. This exports the alert rule group as [`grafana_rule_group` Terraform resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/rule_group).

   You can edit the exported resource, or alternatively, consider creating the resource from scratch.

   ```terraform
   resource "grafana_rule_group" "<terraform_rule_group_name>" {
       name = "My Alert Rules"
       folder_uid = grafana_folder.<terraform_folder_name>.uid
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
               datasource_uid = grafana_data_source.<terraform_data_source_name>.uid
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

   Replace the following field values:

   - `<terraform_rule_group_name>` with the name of the alert rule group.

   Note that the distinct Grafana resources are connected through `uid` values in their Terraform configurations. The `uid` value will be randomly generated when provisioning.

   To link the alert rule group with its respective data source and folder in this example, replace the following field values:

   - `<terraform_data_source_name>` with the terraform name of the previously defined data source.
   - `<terraform_folder_name>` with the terraform name of the the previously defined folder.

1. Continue to add more Grafana resources or [use the Terraform CLI for provisioning](#provision-grafana-resources-with-terraform).

### Add contact points

[Contact points][contact-points] are the receivers of alert notifications.

1. Create or find the contact points you want to import in Grafana. Alternatively, consider writing the resource in code as demonstrated in the example below.

1. [Export][alerting_export] the contact point in Terraform format. This exports the contact point as [`grafana_contact_point` Terraform resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/contact_point)—edit it if necessary.

1. In this example, notifications are muted on weekends.

   ```terraform
    resource "grafana_contact_point" "<terraform_contact_point_name>" {
        name = "My contact point email"

        email {
            addresses               = ["<email_address>"]
        }
    }
   ```

   Replace the following field values:

   - `<terraform_contact_point_name>` with the terraform name of the contact point. It will be used to reference the contact point in other Terraform resources.
   - `<email_address>` with the email to receive alert notifications.

1. Continue to add more Grafana resources or [use the Terraform CLI for provisioning](#provision-grafana-resources-with-terraform).

### Add and enable templates

[Notification templates][notification-template] allow customization of alert notifications across multiple contact points.

1. Create or find the notification template you want to import in Grafana. Alternatively, consider writing the resource in code as demonstrated in the example below.

1. [Export][alerting_export] the template as [`grafana_message_template` Terraform resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/message_template).

   This example is a simple demo template defined as `custom_email.message`.

   ```terraform
    resource "grafana_message_template" "<terraform_message_template_name>" {
        name = "custom_email.message"

        template = <<EOT
    {{ define "custom_email.message" }}
    Lorem ipsum - Custom alert!
    {{ end }}
    EOT
    }
   ```

1. In the previous contact point, enable the template by setting the `email.message` property as follows.

   ```terraform
    resource "grafana_contact_point" "<terraform_contact_point_name>" {
        name = "My contact point email"

        email {
            addresses               = ["<email_address>"]
            message                 = "{{ template \"custom_email.message\" .}}"
        }
    }
   ```

1. Continue to add more Grafana resources or [use the Terraform CLI for provisioning](#provision-grafana-resources-with-terraform).

### Add mute timings

[Mute timings][mute-timings] pause alert notifications during predetermined intervals.

1. Create or find the mute timings you want to import in Grafana. Alternatively, consider writing the resource in code as demonstrated in the example below.

1. [Export][alerting_export] the mute timing in Terraform format. This exports the mute timing as [`grafana_mute_timing` Terraform resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/mute_timing)—edit it if necessary.

1. This example turns off notifications on weekends.

   ```terraform
    resource "grafana_mute_timing" "<terraform_mute_timing_name>" {
        name = "No weekends"

        intervals {
            weekdays = ["saturday", "sunday"]
        }
    }
   ```

   Replace the following field values:

   - `<terraform_mute_timing_name>` with the name of the Terraform resource. It will be used to reference the mute timing in the Terraform notification policy tree.

1. Continue to add more Grafana resources or [use the Terraform CLI for provisioning](#provision-grafana-resources-with-terraform).

### Add the notification policy tree

[Notification policies][notification-policy] defines how to route alert instances to your contact points.

{{% admonition type="warning" %}}

Since the policy tree is a single resource, provisioning the `grafana_notification_policy` resource will overwrite a policy tree created through any other means.

{{< /admonition >}}

1. Find the default notification policy tree. Alternatively, consider writing the resource in code as demonstrated in the example below.

1. [Export][alerting_export] the notification policy tree in Terraform format. This exports it as [`grafana_notification_policy` Terraform resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/notification_policy)—edit it if necessary.

   ```terraform
   resource "grafana_notification_policy" "my_policy_tree" {
   contact_point = grafana_contact_point.<terraform_contact_point_name>.name
   ...

   policy {
       contact_point = grafana_contact_point.<terraform_contact_point_name>.name

       matcher {...}

       mute_timings = [grafana_mute_timing.<terraform_mute_timing_name>.name]
   }
   }
   ```

   To configure the mute timing and contact point previously created in the notification policy tree, replace the following field values:

   - `<terraform_data_source_name>` with the terraform name of the previously defined contact point.
   - `<terraform_folder_name>` with the terraform name of the the previously defined mute timing.

1. Continue to add more Grafana resources or [use the Terraform CLI for provisioning](#provision-grafana-resources-with-terraform).

### Enable editing resources in the Grafana UI

By default, you cannot edit resources provisioned via Terraform in Grafana. This ensures that your alerting stack always stays in sync with your Terraform code.

To make provisioned resources editable in the Grafana UI, enable the `disable_provenance` attribute on alerting resources.

```terraform
resource "grafana_contact_point" "my_contact_point" {
  name = "My Contact Point"

  disable_provenance = true
}

resource "grafana_message_template" "my_template" {
  name     = "My Reusable Template"
  template = "{{define \"My Reusable Template\" }}\n template content\n{{ end }}"

  disable_provenance = true
}
...
```

Note that `disable_provenance` is not supported for [grafana_mute_timing](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/mute_timing).

## Provision Grafana resources with Terraform

To create the previous alerting resources in Grafana with the Terraform CLI, complete the following steps.

1. Initialize the working directory containing the Terraform configuration files.

   ```shell
   terraform init
   ```

   This command initializes the Terraform directory, installing the Grafana Terraform provider configured in the `main.tf` file.

1. Apply the Terraform configuration files to provision the resources.

   ```shell
   terraform apply
   ```

   Before applying any changes to Grafana, Terraform displays the execution plan and requests your approval.

   ```shell
    Plan: 4 to add, 0 to change, 0 to destroy.

    Do you want to perform these actions?
    Terraform will perform the actions described above.
    Only 'yes' will be accepted to approve.

    Enter a value:
   ```

   Once you have confirmed to proceed with the changes, Terraform will create the provisioned resources in Grafana!

   ```shell
   Apply complete! Resources: 4 added, 0 changed, 0 destroyed.
   ```

You can now access Grafana to verify the creation of the distinct resources.

## More examples

For more examples on the concept of this guide:

- Try the demo [provisioning alerting resources in Grafana OSS using Terraform and Docker Compose](https://github.com/grafana/provisioning-alerting-examples/tree/main/terraform).
- Review all the available options and examples of the Terraform Alerting schemas in the [Grafana Terraform Provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
- Review the [tutorial to manage a Grafana Cloud stack using Terraform][provision-cloud-with-terraform].

{{% docs/reference %}}

[alerting-rules]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules"
[alerting-rules]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules"

[contact-points]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points"
[contact-points]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points"

[mute-timings]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings"
[mute-timings]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings"

[notification-policy]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy"
[notification-policy]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-notification-policy"

[notification-template]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications"
[notification-template]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications"

[alerting_export]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources"
[alerting_export]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources"

[alerting_http_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning"
[alerting_http_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning"

[service-accounts]: "/docs/ -> /docs/grafana/<GRAFANA_VERSION>/administration/service-accounts"

[testdata]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/datasources/testdata"
[testdata]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/connect-externally-hosted/data-sources/testdata"

[provision-cloud-with-terraform]: "/docs/ -> /docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/terraform-cloud-stack"

[rbac-role-definitions]: "/docs/ -> /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions"

[rbac-terraform-provisioning]: "/docs/ -> /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-terraform-provisioning"

{{% /docs/reference %}}
