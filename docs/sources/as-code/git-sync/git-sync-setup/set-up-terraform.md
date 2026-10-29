---
description: Instructions for setting up Git Sync as code, so you can provision Git repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - terraform
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync with Terraform
weight: 210
canonical: https://grafana.com/docs/grafana/latest/as-code/git-sync/git-sync-setup/set-up-terraform
aliases:
  - ../../observability-as-code/git-sync/git-sync-setup/set-up-terraform/
---

# Set up Git Sync with Terraform

You can also configure Git Sync via the Grafana provisioning app platform using Terraform.

## Before you begin

Before you begin, make sure to have the following:

- A Grafana Cloud account or an on-prem Grafana instance.
- Administrator permissions in your Grafana stack/instance.
- Terraform 1.11 or later installed on your machine. Refer to the [Terraform install documentation](https://developer.hashicorp.com/terraform/install) to learn more.

{{< admonition type="note" >}}
Save all of the following Terraform configuration files in the same directory.
{{< /admonition >}}

## Configure the Grafana provider

Use this Terraform configuration to configure the [Grafana provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) with the authentication required to set up Git Sync.

1. Create a service account and token in Grafana. For more information refer to [Service account tokens](https://grafana.com/docs/grafana/latest/administration/service-accounts/#service-account-tokens) or [Create and manage a Grafana Cloud stack using Terraform](https://grafana.com/docs/grafana-cloud/as-code/terraform/terraform-cloud-stack/).

1. Make sure that the token has the Admin or the `Provisioning:Repositories` writer permission.

1. Create a file named `main.tf` and add the following:

   ```terraform
      terraform {
        required_providers {
          grafana = {
            source  = "grafana/grafana"
            version = ">= 4.28.1"
          }
        }
      }

      provider "grafana" {
        url = "https://<STACK-URL>.grafana.net/"
        auth = <YOUR-SERVICE-ACCOUNT-TOKEN>
        stack_id = <YOUR-STACK-ID>
      }
   ```

Replace the following field values:

- `<STACK-URL>` with the URL of your Grafana stack. For example, `https://my-stack.grafana.net/`.
- `<YOUR-SERVICE-ACCOUNT-TOKEN>` with the service account token that you created, or `<USERNAME>:<PASSWORD>` for basic auth.
- `<YOUR-STACK-ID>` with the Grafana stack ID, if you are using a Grafana Cloud stack.

{{< admonition type="caution" >}}

The Git Sync Terraform resources are App Platform resources and talk directly to the Grafana stack's API.

**Do not use Grafana Cloud provider settings in this configuration**. Configure the provider with `url` and `auth` (not `cloud_api_url` and `cloud_access_policy_token`). If you're using Grafana Cloud, set `stack_id` to your stack ID.

{{< /admonition >}}

## Create the resources to use Git Sync

You need two resources for configure and manage Git Sync:

- The [connection resource](#configure-the-connection-resource) configures your Git provider credentials. 
- The [repository resource](#configure-the-repository-resource) configures the Git repository to sync Grafana resources with. 


For better understanding of the required resources, refer to [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts).

### Configure the Connection resource

The Connection resource manages the Git Sync connections used by repositories for provider authentication.

```terraform
resource "grafana_apps_provisioning_connection_v0alpha1" "example" {
  metadata {
    uid = "my-connection"
  }

  spec {
    title       = "My Connection"
    description = "Connection used by a folder-scoped Git Sync repository"
    type        = "<CONNECTION-TYPE>"
    url         = "https://connection.com"
  }

  secure {
    private_key = {
      create = filebase64("${path.module}/private-key.pem")
    }
  }
  secure_version = 1
}
```

Replace the following field values:

- `<CONNECTION-TYPE>` with the connection provider type. For example, GitHub, GitLab or BitBucket.

For more details, optional fields, and examples, refer to [Connection resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_provisioning_connection_v0alpha1) in the Terraform registry.

### Configure the Repository resource

The Repository resource manages your Git Sync repositories for provisioning dashboards and related resources.

For example, for a GitHub repository with token authentication:

```terraform
resource "grafana_apps_provisioning_repository_v0alpha1" "example" {
  metadata {
    uid = "my-github-folder-repo"
  }

  spec {
    title       = "My GitHub Folder Repository"
    description = "Folder-scoped GitHub repository authenticated directly with a token"
    type        = "github"

    workflows = ["write", "branch"]

    sync {
      enabled          = true
      target           = "folder"
      interval_seconds = 60
    }

    github {
      url    = "https://github.com/example/grafana-dashboards"
      branch = "main"
      path   = "grafanatftest"
    }

    webhook {
      base_url = "https://grafana.example.com"
    }
  }

  secure {
    token = {
      create = "replace-me"
    }
  }
  secure_version = 1
}
```

Replace the following field values:

- `<CONNECTION-TYPE>

For more details and examples such as a GitHub repository via GitHub App Connection or a GitLab/Bitbucket repository with a token authentication, refer to [Repository resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_provisioning_repository_v0alpha1) in the Terraform registry.

