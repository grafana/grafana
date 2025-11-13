---
description: Learn how to manage Grafana Cloud Provider Observability resources in Grafana Cloud using Terraform
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Terraform
  - Cloud Provider Observability
title: Manage Cloud Provider Observability in Grafana Cloud using Terraform
weight: 210
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-cloud-provider-o11y/
---

# Manage Cloud Provider Observability in Grafana Cloud using Terraform

Manage Cloud Provider Observability, including Amazon CloudWatch and Microsoft Azure resources, in Grafana Cloud using Terraform.
For more information on Cloud Provider Observability, refer to the [Cloud Provider Observability](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/) documentation.

## Before you begin

Before you begin, you should have the following available:

- A Grafana Cloud account
  - For more information on setting up a Grafana Cloud account, refer to [Get started](/docs/grafana-cloud/get-started/).
- Terraform installed on your machine
  - For more information on how to install Terraform, refer to the [Terraform install documentation](https://developer.hashicorp.com/terraform/install).
- Administrator permissions in your Grafana instance
  - For more information on assigning Grafana RBAC roles, refer to [Assign RBAC roles](/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-control/assign-rbac-roles/).

{{< admonition type="note" >}}
Save all of the following Terraform configuration files in the same directory.
{{< /admonition >}}

## Configure authentication for the Grafana Provider

The Grafana Provider is a logical abstraction of an upstream API that you can use to interact with Grafana Cloud resources.
You must configure it with the following information:

- A Grafana Cloud access policy token that includes the permissions the provider needs to access the Grafana Cloud Provider API.
- A regional cloud provider API endpoint to establish which Grafana Cloud stack you are accessing.

To configure authentication for the Grafana Provider:

1. Create a Grafana Cloud access policy and token.
   - To create an access policy for your organization, refer to the [Create an access policy for a stack steps](/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/create-access-policies/#create-an-access-policy-for-a-stack) and use the following scopes listed for the supported Amazon CloudWatch or Microsoft Azure resources:
     - Amazon CloudWatch
       - Metrics scrape or resource metadata scrape
         - `integration-management:read`
         - `integration-management:write`
         - `stacks:read`
       - Metric streams
         - `metrics:write`
       - ALB access logs, logs with Lambda, or logs with Amazon Data Firehose
         - `logs:write`
   - Microsoft Azure
     - Serverless metrics
       - `integration-management:read`
       - `integration-management:write`
       - `stacks:read`
     - Logs with Azure functions
       - `logs:write`

1. Obtain the regional Cloud Provider API endpoint.
   - To obtain the regional Cloud provider API endpoint, use your access policy token and the following command to return a list of all of the Grafana stacks you own, along with their respective Cloud Provider API hostnames:
   ```bash
   curl -sH "Authorization: Bearer <Access Token from previous step>" "https://grafana.com/api/instances" | \
   jq '[.items[]|{stackName: .slug, clusterName:.clusterSlug, cloudProviderAPIURL: "https://cloud-provider-api-\(.clusterSlug).grafana.net"}]'
   ```
1. Create a file named `cloud-provider.tf` and add the following code block:

   ```tf
   terraform {
       required_providers {
       grafana = {
           source  = "grafana/grafana"
       }
     }
   }

   provider "grafana" {
       cloud_api_url      = "<CLOUD_PROVIDER_API_URL>"
       cloud_access_policy_token     = "<CLOUD_ACCESS_POLICY_TOKEN>"
   }
   ```

1. Create a `variables.tf` file and paste the `<CLOUD_ACCESS_POLICY_TOKEN>` and `<CLOUD_PROVIDER_API_URL` variables with your values.
1. Run the following Terraform command:
   ```tf
   terraform apply -var-file="variables.tf"
   ```

## Configure your resources

To find instructions for configuring specific Amazon CloudWatch and Microsoft Azure resources in Cloud Provider Observability using Terraform, refer to the following documents:

- Amazon CloudWatch
  - [Metrics scrape](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/cloudwatch-metrics/config-cw-metric-scrape/): Pull CloudWatch metrics from multiple regions for your AWS account, without needing to install Grafana Alloy.
  - [Metric streams](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/cloudwatch-metrics/config-cw-metric-streams/#configure-metric-streams-with-terraform): Push metrics with CloudWatch metric streams using Amazon Data Firehose, providing real-time insights and scalability while simplifying configuration and reducing cost and manual effort.
  - [ALB access logs](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/logs/cloudwatch-logs/config-alb-access-logs-lambda/#configure-with-terraform): Send application load balancer access logs from AWS to Grafana Cloud using a Lambda function.
  - [Logs with Lambda](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/logs/cloudwatch-logs/config-cw-logs-lambda/#configure-with-terraform): Send logs to Grafana Cloud from multiple AWS services using a lambda-promtail function.
  - [Logs with Amazon Data Firehose](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/aws/logs/firehose-logs/config-firehose-logs/#configure-with-terraform): Send logs from AWS to Grafana Cloud with Amazon Data Firehose and minimal infrastructure.
- Microsoft Azure
  - [Serverless metrics](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/azure/collect-azure-serverless/config-azure-metrics-serverless/): Monitor your Azure resources without the need to configure or deploy a collector by using Cloud Provider Observability.
  - [Logs with Azure functions](/docs/grafana-cloud/monitor-infrastructure/monitor-cloud-provider/azure/config-azure-logs-azure-function/): Send Azure event logs to a Loki endpoint using an Azure function that subscribes to an Azure event hub.

## Grafana cloud provider resources

You can define the following Cloud Provider Observability resources and data sources using Terraform:

| Resource name                                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grafana_cloud_provider_aws_account`                      | Represents an AWS IAM role that authorizes Grafana Cloud to pull Amazon CloudWatch metrics for a set of regions. Usually, there's one of these resources per configured AWS account. For a full reference of this resource, refer to [the Terraform Grafana Provider reference documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_provider_aws_account).                                       |
| `grafana_cloud_provider_aws_cloudwatch_scrape_job`        | Represents a Grafana AWS scrape job. This configures Grafana to fetch a list of metrics/statistics for one or many AWS services, and for a given `grafana_cloud_provider_aws_account`. For a full reference of this resource, refer to [the Terraform Grafana Provider reference documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_provider_aws_cloudwatch_scrape_job)                        |
| `grafana_cloud_provider_aws_resource_metadata_scrape_job` | Represents a Grafana AWS Resource Metadata scrape job. This resource configures Grafana to fetch resource metadata for one or multiple AWS services, for a given `grafana_cloud_provider_aws_account`. For a full reference of this resource, refer to [the Terraform Grafana Provider reference documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_provider_aws_resource_metadata_scrape_job) |
| `grafana_cloud_provider_azure_credential`                 | A resource representing an Azure Service Principal credential used by Grafana Cloud to pull Azure Monitor metrics from one or more subscriptions. For a full reference of this resource, refer to [the Terraform Grafana Provider resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/cloud_provider_azure_credential).                                                                      |
