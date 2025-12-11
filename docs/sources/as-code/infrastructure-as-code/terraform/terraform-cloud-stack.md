---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
title: Creating and managing a Grafana Cloud stack using Terraform
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-cloud-stack/
---

# Creating and managing a Grafana Cloud stack using Terraform

Learn how to add a data source, a dashboard, and a folder to a Grafana Cloud stack using Terraform.

## Prerequisites

Before you begin, you should have the following available:

- A Grafana Cloud account, as shown in [Get started](/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine

{{< admonition type="note" >}}
All of the following Terraform configuration files should be saved in the same directory.
{{< /admonition >}}

## Create a Cloud stack

1. Create a Terraform configuration file.

   This Terraform configuration will create a Grafana Cloud stack and a second token needed for your Grafana instance.

   Create a file named `cloud-stack.tf` and add the following:

   ```terraform
   terraform {
     required_providers {
       grafana = {
         source  = "grafana/grafana"
         version = ">= 2.9.0"
       }
     }
   }
   // Step 1: Create a stack
   provider "grafana" {
     alias = "cloud"
     cloud_access_policy_token = "<cloud-access-token>"
   }


   resource "grafana_cloud_stack" "my_stack" {
     provider = grafana.cloud

     name               = "<stack-name>"
     slug               = "<stack-name>"
     region_slug        = "<region>" # Example "us","eu" etc
     delete_protection  = true
   }

   // Step 2: Create a service account and key for the stack
   resource "grafana_cloud_stack_service_account" "cloud_sa" {
     provider   = grafana.cloud
     stack_slug = grafana_cloud_stack.my_stack.slug

     name        = "<service-account-name>"
     role        = "Admin"
     is_disabled = false
   }

   resource "grafana_cloud_stack_service_account_token" "cloud_sa" {
     provider   = grafana.cloud
     stack_slug = grafana_cloud_stack.my_stack.slug

     name               = "terraform serviceaccount key"
     service_account_id = grafana_cloud_stack_service_account.cloud_sa.id
   }

   // Step 3: Create resources within the stack
   provider "grafana" {
     alias = "my_stack"

     url  = grafana_cloud_stack.my_stack.url
     auth = grafana_cloud_stack_service_account_token.cloud_sa.key
   }
   resource "grafana_folder" "my_folder" {
     provider = grafana.my_stack

     title = "Test Folder"
   }
   ```

1. Replace the following field values:
   - `<cloud-access-token>` with your Grafana Cloud Access Policy Token.
     To create a new one, refer [Grafana Cloud Access Policies](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/)
     Add all stacks to the realms list.
     The scopes needed for the example are:
     - dashboards:read
     - orgs:read
     - stack-dashboards:read
     - stacks:read
     - dashboards:write
     - orgs:write
     - stack-dashboards:write
     - stacks:write
     - stack-service-accounts:write
     - dashboards:delete
     - stack-dashboards:delete
     - stacks:delete
   - `<stack-name>` with the name of your stack.
   - `<region>` with the region in which you want to create the stack. For example `us`, `eu`.
   - `<service-account-name>` with a name for the serviceaccount that will be created to use for operations within the stack/instance.

The first provider block, `grafana.cloud`, uses the Cloud Access Policy Token from the Cloud Portal and is referenced as a parameter when creating the Cloud stack and the token in the Grafana instance to provide the necessary authentication.

The second provider block, `grafana.my_stack`, is referenced as a parameter when creating resources inside the Grafana instance.

## Add a data source

This guide uses the InfluxDB data source. The required arguments for [grafana_data_source (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source) vary depending on the type of data source you select.

1. Create a file named `datasource.tf` and add the following:

   ```terraform
   resource "grafana_data_source" "<data-source-name>" {
     provider = grafana.my_stack

     type          = "influxdb"
     name          = "<data-source-name>"
     url           = "<data-source-url>"
     username      = "<username>"
     password      = "<password>"
     database_name = "<db-name>"
   }
   ```

1. Replace the following field values:
   - `<data-source-name>` with the name of the data source to be added in Grafana.
   - `<data-source-url>` with URL of your data source.
   - `<username>` with the username for authenticating with your data source.
   - `<password>` with password for authenticating with your data source.
   - `<db-name>` with name of your database.

## Add a folder

This Terraform configuration creates a folder in your Grafana instance using [grafana_folder (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/folder).

1. Create a file named `folder.tf` and add the following:

   ```terraform
   resource "grafana_folder" "<folder-name>" {
     provider = grafana.my_stack

     title = "<folder-name>"
   }
   ```

1. Replace the following field value:
   - `<folder-name>` with a name for the folder.

## Add a dashboard to the folder

This Terraform configuration creates a dashboard inside the folder created above in your Grafana instance using [grafana_dashboard (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/dashboard).

1. Create a file named `dashboard.tf` and add the following:

   ```terraform
   # Using a JSON file
   resource "grafana_dashboard" "dashboard" {
     provider = grafana.my_stack

     config_json = file("<file-name>.json")
     folder = grafana_folder.<folder-name>.id
   }
   ```

1. Replace the following field value:
   - `<file-name>` with the name of the JSON file that has the source code for the dashboard.

   The dashboard is represented by its JSON source code and referenced in the `config_json` parameter.

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

Once you apply the changes in the Terraform configurations, you should be able to verify the following:

- The new Grafana stack is created and visible in the Cloud Portal

  ![Cloud Portal](/static/img/docs/grafana-cloud/terraform/cloud_portal_tf.png)

- A service account key token is added in your Grafana instance. In the following image, the service account key token named "terraform serviceaccount key" was added by the [grafana_cloud_stack_service_account_token (Resource)](#create-a-cloud-stack).

  ![API Key](/media/docs/grafana-cloud/screenshot-api_key_tf.png)

- A new data source (InfluxDB in this example) is visible in the grafana instance.

  ![InfluxDB data source](/media/docs/grafana-cloud/screenshot-influxdb_datasource_tf.png)

- A new folder in Grafana. In the following image, a folder named "Demos" was added by the [grafana_folder (Resource)](./#add-a-folder).

  ![Folder](/media/docs/grafana-cloud/screenshot-folder_tf.png)

- A new dashboard in the Grafana instance. In the following image a dashboard named "InfluxDB Cloud Demos" was created inside the "Demos" folder.

  ![InfluxDB dashboard](/static/img/docs/grafana-cloud/terraform/influxdb_dashboard_tf.png)

## Conclusion

In this guide, you created a Grafana Cloud stack along with a data source, folder, and dashboard imported from a JSON file using Terraform.

To learn more about managing Grafana Cloud using Terraform, see [Grafana provider's documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
