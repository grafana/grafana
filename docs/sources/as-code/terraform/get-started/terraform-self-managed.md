---
description: Learn how to configure the Grafana Terraform provider for a self-managed Grafana instance and add a data source, a folder, and a dashboard to it.
keywords:
  - Infrastructure as Code
  - Quickstart
  - Terraform
  - Self-managed
labels:
  products:
    - enterprise
    - oss
menuTitle: Manage a self-managed Grafana instance
title: Manage a self-managed Grafana instance using Terraform
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/terraform/get-started/terraform-self-managed/
---

# Manage a self-managed Grafana instance using Terraform

Learn how to configure the Grafana Terraform provider for a self-managed Grafana OSS or Grafana Enterprise instance, and add a data source, a folder, and a dashboard to it.

{{< admonition type="note" >}}
The Grafana Terraform provider is updated frequently. For the latest provider version and the complete reference for every resource and data source, refer to the [Grafana provider in the Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
{{< /admonition >}}

## Before you begin

Before you begin, ensure you have the following:

- A running Grafana OSS or Grafana Enterprise instance, and a user with the Admin organization role in it.
- [Terraform](https://developer.hashicorp.com/terraform/install) installed on your machine.
- The JSON model of a dashboard that you want to provision. To export one from Grafana, refer to [Export a dashboard as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/#export-a-dashboard-as-code).

{{< admonition type="note" >}}
Save all of the following Terraform configuration files in the same directory.
{{< /admonition >}}

## Create a service account token

Terraform authenticates to Grafana with a service account token. To create one, complete the following steps:

1. [Create a service account](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/#create-a-service-account-in-grafana).
1. Assign the service account the Admin role, so that it can create data sources, folders, and dashboards.

   For production use, assign only the roles that the resources you manage need. Refer to [Roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).

1. [Add a token to the service account](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/#add-a-token-to-a-service-account-in-grafana), and save the token for the next step.

## Configure the provider

Create a file named `provider.tf` and add the following:

```terraform
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 4.0"
    }
  }
}

# Reads credentials from the GRAFANA_URL and GRAFANA_AUTH environment variables
provider "grafana" {}
```

To keep your token out of source control, set the credentials as environment variables instead of adding them to the configuration:

```sh
export GRAFANA_URL="<GRAFANA_URL>"
export GRAFANA_AUTH="<SERVICE_ACCOUNT_TOKEN>"
```

Replace the following placeholders:

- _`<GRAFANA_URL>`_: The base URL of your Grafana instance, for example `http://localhost:3000`.
- _`<SERVICE_ACCOUNT_TOKEN>`_: The service account token you created.

For other authentication options, refer to the [provider authentication documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs#authentication).

## Add a data source

This guide uses the Prometheus data source. The required arguments for [`grafana_data_source`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source) vary depending on the type of data source.

Create a file named `datasource.tf` and add the following:

```terraform
resource "grafana_data_source" "prometheus" {
  type = "prometheus"
  name = "<DATA_SOURCE_NAME>"
  url  = "<PROMETHEUS_URL>"
}
```

Replace the following placeholders:

- _`<DATA_SOURCE_NAME>`_: The name of the data source in Grafana.
- _`<PROMETHEUS_URL>`_: The URL of your Prometheus server, for example `http://prometheus:9090`.

## Add a folder

Create a file named `folder.tf` and add the following [`grafana_folder`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/folder) resource:

```terraform
resource "grafana_folder" "my_folder" {
  title = "<FOLDER_TITLE>"
}
```

Replace _`<FOLDER_TITLE>`_ with a name for the folder.

## Add a dashboard to the folder

Create a file named `dashboard.tf` and add the following [`grafana_dashboard`](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/dashboard) resource:

```terraform
resource "grafana_dashboard" "my_dashboard" {
  config_json = file("<DASHBOARD_FILE>.json")
  folder      = grafana_folder.my_folder.uid
}
```

Replace _`<DASHBOARD_FILE>`_ with the name of the JSON file that contains the dashboard model.

## Apply the Terraform configuration

In a terminal, run the following commands from the directory that contains the configuration files.

1. Initialize the working directory and install the Grafana provider:

   ```sh
   terraform init
   ```

1. Preview the changes that Terraform makes:

   ```sh
   terraform plan
   ```

1. Apply the configuration:

   ```sh
   terraform apply
   ```

## Verify the resources

After Terraform applies the configuration, check the following in Grafana:

- The data source appears in **Connections** > **Data sources**.
- The folder appears in **Dashboards**.
- The dashboard appears inside the folder.

## Next steps

You created a data source, a folder, and a dashboard in a self-managed Grafana instance using Terraform. To continue:

- Manage dashboards from a Git repository with CI/CD. Refer to [Create and manage dashboards using Terraform and GitHub Actions](../../grafana-resources/dashboards-github-action/).
- Provision alerting resources. Refer to [Use Terraform to provision alerting resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/).
- Explore all available resources in the [Grafana provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
