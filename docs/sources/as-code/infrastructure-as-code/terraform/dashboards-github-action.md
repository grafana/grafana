---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - GitHub Actions
title: Creating and managing dashboards using Terraform and GitHub Actions
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/dashboards-github-action/
---

# Creating and managing dashboards using Terraform and GitHub Actions

Learn how to create and manage multiple dashboards represented as JSON source code for Grafana using [Terraform](https://www.terraform.io/) and [GitHub Actions](https://github.com/features/actions).

## Prerequisites

Before you begin, you should have the following available:

- A Grafana Cloud account, as shown in [Get started](/docs/grafana-cloud/get-started/)
- A [GitHub](https://github.com/) repository

## Add Dashboards to a GitHub repository

For this guide, we are adding dashboards for ElasticSearch, InfluxDB, and AWS EC2. You can use different dashboards according to your configured data sources.

1. In your GitHub repository, create a folder named `dashboards` in the root directory.

1. In the `dashboards` folder create three sub-folders. For this guide, we will create three sub-folders named `elasticsearch`, `influxdb`, and `aws`.

1. Add dashboard JSON source code to each of the three sub-folders.

## Terraform configuration for Grafana provider

This Terraform configuration configures the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide necessary authentication when creating folders and dashboards in the Grafana instance.

1. Create a service account and token in the Grafana instance by following these steps:
   1. [Create a service account in Grafana](/docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/#create-a-service-account-in-grafana)
   1. [Add a token to a service account](/docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/#add-a-token-to-a-service-account-in-grafana)

1. Create a file named `main.tf` in the Git root directory and add the following code block:

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
      alias = "cloud"

      url   = "<Grafana-instance-url>"
      auth  = "<Grafana-Service-Account-token>"
   }
   ```

1. Replace the following field values:
   - `<Grafana-instance-url>` with the URL of your Grafana instance, for example `"https://my-stack.grafana.net/"`.
   - `<Grafana-Service-Account-token>` with a Service Account token from the Grafana instance.

## Terraform configuration for folders

This Terraform configuration creates three folders named `ElasticSearch`, `InfluxDB` and `AWS` in the Grafana instance using [grafana_folder (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/folder).

Create a file named `folders.tf` in the Git root directory and add the following code block:

```terraform
resource "grafana_folder" "ElasticSearch" {
  provider = grafana.cloud

  title = "ElasticSearch"
}

resource "grafana_folder" "InfluxDB" {
  provider = grafana.cloud

  title = "InfluxDB"
}

resource "grafana_folder" "AWS" {
  provider = grafana.cloud

  title = "AWS"
}
```

## Terraform configuration for dashboards

This Terraform configuration iterates through the Json files in the three folders (`elasticsearch`, `influxdb` and `aws`) you created in the GitHub repository and adds them to the respective folders in the Grafana instance using [grafana_dashboard (Resource)](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/dashboard).

For example, the dashboard represented as JSON source code in the `elasticsearch` folder in the GitHub repository will be created in the `ElasticSearch` folder in the Grafana instance.

Create a file named `dashboards.tf` in the Git root directory and add the following code block:

```terraform
resource "grafana_dashboard" "elasticsearch" {
  provider = grafana.cloud

  for_each    = fileset("${path.module}/dashboards/elasticsearch", "*.json")
  config_json = file("${path.module}/dashboards/elasticsearch/${each.key}")
  folder      = grafana_folder.ElasticSearch.id
}

resource "grafana_dashboard" "influxdb" {
  provider = grafana.cloud

  for_each    = fileset("${path.module}/dashboards/influxdb", "*.json")
  config_json = file("${path.module}/dashboards/influxdb/${each.key}")
  folder      = grafana_folder.InfluxDB.id
}

resource "grafana_dashboard" "aws" {
  provider = grafana.cloud

  for_each    = fileset("${path.module}/dashboards/aws", "*.json")
  config_json = file("${path.module}/dashboards/aws/${each.key}")
  folder      = grafana_folder.AWS.id
}
```

## GitHub workflow for managing dashboards using Terraform

This GitHub workflow consists of the following steps:

- Using the [actions/checkout@v3](https://github.com/actions/checkout) action, The GitHub repository is checked out so that the GitHub workflow can access it.
- The Terraform CLI is installed on the GitHub runner using the [hashicorp/setup-terraform@v1](https://github.com/hashicorp/setup-terraform) action.
- `terraform init` is run as a bash command in the GitHub runner to initialize a working directory containing Terraform configuration files.
- `terraform fmt -check` is run as a bash command in the GitHub runner to check if the Terraform configuration files are properly formatted. If the Terraform configuration files are not properly formatted, the workflow will fail at this step.
- `terraform plan` is run as a bash command in the GitHub runner to preview the changes that Terraform will make.
- Using [mshick/add-pr-comment@v1](https://github.com/mshick/add-pr-comment) action, the preview from Terraform plan is posted as a comment on the pull request. This helps in reviewing the changes that Terraform will make before the pull request is merged.
- `terraform appy -auto-approve` is run as a bash command in the GitHub runner to apply the Terraform configuration files. `-auto-approve` flag is added to the command to skip interactive approval of plan before applying and make the workflow automated.
  This step is run only when changes are committed to `main` branch. When a pull request is merged, the merge action creates a commit to the `main` branch which triggers the `terraform apply -auto-approve` step to execute.

1. In your GitHub repository, create a folder named `.github` in the root directory .

1. In the `.github` folder create a sub-folder named `workflows`.

1. To add the GitHub workflow to your GitHub repository, create a file named `terraform.yml` in the `workflows` directory and add the following code block:

   ````yaml
   name: Terraform

   on:
     push:
       branches:
         - 'main'
     pull_request:

   jobs:
     terraform:
       runs-on: ubuntu-latest

       steps:
         # Checkout the repository to the GitHub Actions runner
         - name: Checkout
           uses: actions/checkout@v3

         # Install the latest version of Terraform CLI
         - name: Setup Terraform
           uses: hashicorp/setup-terraform@v1

         # Initialize a new or existing Terraform working directory by creating initial files, loading any remote state, downloading modules, etc.
         - name: Terraform Init
           run: terraform init

         # Checks that all Terraform configuration files adhere to a canonical format
         - name: Terraform Format
           run: terraform fmt -check

         # Previews the changes that Terraform will make
         - name: Plan Terraform
           id: plan
           continue-on-error: true
           run: terraform plan -input=false -no-color

         # Post the preview (terraform plan) from the previous step as a GitHub pull request comment
         - name: Post Plan to GitHub PR
           if: github.ref != 'refs/heads/main'
           uses: mshick/add-pr-comment@v1
           with:
             repo-token: ${{ secrets.GITHUB_TOKEN }}
             repo-token-user-login: 'github-actions[bot]'
             message: |
               Applying:

               ```
               ${{ steps.plan.outputs.stdout }}
               ```

         # Applies the terraform configuration files when the branch is `main`
         - name: Apply Terraform
           if: github.ref == 'refs/heads/main'
           id: apply
           continue-on-error: true
           run: |
             terraform apply -auto-approve
   ````

1. Commit the changes made to the `terraform.yml` in the previous step to the `main` branch in your GitHub repository. Once the changes are committed, The GitHub workflow you created should start to run automatically as the workflow we defined in the previous step runs when a pull request is created or when changes are committed to `main` branch.

## Managing the Terraform state

If you are not using a [Terraform backend](https://www.terraform.io/language/settings/backends/configuration) to store the `.tfstate` file, add the following code block to the end of the GitHub workflow file to make sure the Terraform state file is stored in Git.

```yaml
- name: commit the terraform state
  if: github.ref == 'refs/heads/main'
  uses: stefanzweifel/git-auto-commit-action@v4
  with:
    commit_message: Updating Terraform state
    file_pattern: terraform.tfstate
```

When you run `terraform apply`,Terraform automatically manages and updates the `terraform.tfstate` file to store state about your infrastructure and configuration.
This step uses the [stefanzweifel/git-auto-commit-action@v4](https://github.com/stefanzweifel/git-auto-commit-action) action to auto-commit the `terraform.tfstate` file for changes made by the running the `terraform apply` step.

{{< admonition type="note" >}}
The Terraform state file (terraform.tfstate) should not be stored in Git to avoid leakage of sensitive data. Instead, store Terraform state file using a remote backend like AWS S3 with proper RBAC. For more information, see [Terraform state](https://www.terraform.io/language/state).
{{< /admonition >}}

## Validation

Once the GitHub workflow run is successful, you should be able to verify the following:

- `ElasticSearch`, `InfluxDB` and `AWS` folders are created in the Grafana instance.

  ![Folders in Dashboards](/media/docs/grafana-cloud/screenshot-folders-github-action-tf.png)

- Dashboard represented as JSON source code from `elasticsearch` folder in GitHub are added under the `ElasticSearch` folder in the Grafana instance.

  ![ElasticSearch Folder](/media/docs/grafana-cloud/screenshot-elastic-folder-github-action-tf.png)

- Dashboard source code from the `influxdb` folder in GitHub is added under the `InfluxDB` folder in the Grafana instance.

  ![InfluxDB Folder](/media/docs/grafana-cloud/screenshot-influxdb-folder-github-action-tf.png)

- Dashboards from `aws` folder in GitHub are added under the `AWS` folder in the Grafana instance.

  ![AWS EC2 Folder](/media/docs/grafana-cloud/screenshots-aws-folder-github-action-tf.png)

## Conclusion

In this guide, you created a GitHub workflow using Terraform to manage dashboard source code. Using this workflow, the dashboards in the Grafana instance will always be synchronized with the JSON source code files for dashboards in GitHub.

To learn more about managing Grafana Cloud using Terraform, see [Grafana provider's documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs).
