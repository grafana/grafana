---
description: Learn how to configure Terraform to manage Knowledge Graph resources
menuTitle: Get started
title: Get started with Terraform for Knowledge Graph
weight: 100
keywords:
  - Terraform
  - Knowledge Graph
  - Provider Setup
  - Getting Started
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/terraform/terraform-knowledge-graph/getting-started/
---

# Get started with Terraform for Knowledge Graph

Learn how to configure Terraform to manage [Grafana Cloud Knowledge Graph](/docs/grafana-cloud/knowledge-graph/) resources. This guide walks you through setting up the Grafana Terraform provider and preparing your environment.

## Before you begin

Before you begin, ensure you have the following:

- A Grafana Cloud account, as shown in [Get started](/docs/grafana-cloud/get-started/)
- [Terraform](https://www.terraform.io/downloads) installed on your machine
- Administrator permissions in your Grafana instance
- [Knowledge Graph enabled](/docs/grafana-cloud/knowledge-graph/get-started/) in your Grafana Cloud stack

{{< admonition type="note" >}}
All Terraform configuration files should be saved in the same directory.
{{< /admonition >}}

## Configure the Grafana provider

This Terraform configuration sets up the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) to provide necessary authentication when managing knowledge graph resources.

You can reuse a similar setup to the one described in [Creating and managing a Grafana Cloud stack using Terraform](/docs/grafana-cloud/as-code/infrastructure-as-code/terraform/terraform-cloud-stack/) to set up a service account and a token.

### Steps

1. Create a Service account and token in Grafana.

   To create a new one, refer to [Service account tokens](/docs/grafana/latest/administration/service-accounts/#service-account-tokens).

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
     alias = "asserts"

     url      = "<Stack-URL>"
     auth     = "<Service-account-token>"
     stack_id = "<Stack-ID>"
   }
   ```

1. Replace the following field values:
   - `<Stack-URL>` with the URL of your Grafana stack (for example, `https://my-stack.grafana.net/`)
   - `<Service-account-token>` with the service account token that you created
   - `<Stack-ID>` with your Grafana Cloud stack ID

{{< admonition type="note" >}}
The `stack_id` parameter is required for Knowledge Graph resources to identify the stack where the resources belong.
{{< /admonition >}}

## Apply Terraform configurations

After creating your Terraform configuration files, apply them using the following commands:

1. Initialize a working directory containing Terraform configuration files:

   ```shell
   terraform init
   ```

1. Preview the changes that Terraform makes:

   ```shell
   terraform plan
   ```

1. Apply the configuration files:

   ```shell
   terraform apply
   ```

## Verify your setup

After applying the configuration, verify your setup by checking that:

- Terraform can authenticate with your Grafana Cloud stack
- The provider is properly configured with the correct stack ID
- No errors appear in the Terraform output

## Best practices

When managing Knowledge Graph resources with Terraform, consider the following best practices:

### Name conventions

- Use descriptive names that clearly indicate the purpose of each resource
- Follow a consistent naming pattern across your organization
- Include environment or team identifiers in names when appropriate

### Version control

- Store your Terraform configurations in version control (Git)
- Use separate directories or workspaces for different environments
- Document changes in commit messages

### State management

- Use remote state backends for team collaboration
- Enable state locking to prevent concurrent modifications
- Regularly back up your Terraform state files

### Security

- Never commit service account tokens or sensitive data to version control
- Use environment variables or secret management tools for credentials
- Rotate service account tokens regularly

## Next steps

Now that you have configured the Terraform provider, you can start managing knowledge graph resources:

- [Configure notification alerts](../notification-alerts/)
- [Define suppressed assertions](../suppressed-assertions/)
- [Create custom model rules](../custom-model-rules/)
- [Set up log configurations](../log-configurations/)
- [Configure thresholds](../thresholds/)
- [Configure knowledge graph SLOs](../knowledge-graph-slo/)
