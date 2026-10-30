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

You can configure Git Sync via the Grafana provisioning app platform using Terraform.

To do so, follow these steps:

1. Read [Before you begin](#before-you-begin).
1. [Configure the Grafana Terraform provider](#configure-the-grafana-terraform-provider).
1. [Create the resources for Git Sync](#create-the-resources-to-use-git-sync).

## Before you begin

Before you begin, make sure to have the following:

- A Grafana Cloud account or an on-prem Grafana instance.
- Administrator permissions in your Grafana stack/instance.
- Terraform 1.11 or later installed on your machine. Refer to the [Terraform install documentation](https://developer.hashicorp.com/terraform/install) to learn more.

You need the three files described in this document to set up Git Sync with Terraform:

- [Grafana provider configuration file](#configure-the-grafana-terraform-provider)
- [Connection resource](#configure-the-connection-resource)
- [Repository resource](#configure-the-repository-resource)

**Save all of them in the same directory.**

## Configure the Grafana Terraform provider

Configure the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs) with the authentication required to set up Git Sync.

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
        url = "https://'<STACK-URL>'.grafana.net/"
        auth = "<YOUR-SERVICE-ACCOUNT-TOKEN>"
        stack_id = "<YOUR-STACK-ID>"
      }
   ```

Replace the following field values:

- _`<STACK-URL>`_: The URL of your Grafana stack. For example, `https://my-stack.grafana.net/`.
- _`<YOUR-SERVICE-ACCOUNT-TOKEN>`_: The service account token that you created, or `<USERNAME>:<PASSWORD>` for basic auth.
- _`<YOUR-STACK-ID>`_: The Grafana stack ID, if you're using a Grafana Cloud stack.

{{< admonition type="caution" >}}

**Don't use your Grafana Cloud provider settings in this configuration**.

The Git Sync resources are App Platform resources and talk directly to the Grafana stack's API. Configure the Terraform provider with `url` and `auth`, not `cloud_api_url` nor `cloud_access_policy_token`. If you're using Grafana Cloud, set `stack_id` to your stack ID.

{{< /admonition >}}

## Create the resources to use Git Sync

You need to create two resources for configure and manage Git Sync:

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
    type        = "<CONNECTION-TYPE>" # githubOAuth, githubEnterpriseOAuth, gitlabOAuth, bitbucketOAuth, or gitOAuth
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

- _`<CONNECTION-TYPE>`_: The Git provider type. For example, `github`, `gitlab` or `bitbucket`.

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

    workflows = "<YOUR-WORKFLOW>"

    sync {
      enabled          = "<SYNC-ENABLED>"
      target           = "<YOUR-SYNC-TARGET>"
      interval_seconds = 60 # Set up TBC
    }

    github {
      url    = "<YOUR-GITHUB-REPO-URL>"
      branch = "<SYNC-BRANCH>"
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

- _`<YOUR-WORKFLOW>`_: The workflow you want Git Sync to use. Set to `write` to allow direct commits, or to `branch` to force using PRs.
- _`<SYNC-ENABLED>`_: Whether you want to enable automatic synchronization. Allowed values are `true` and `false`.
- _`<YOUR-SYNC-TARGET>`_: Where you want to place your provisioned resources. Git Sync supports two sync targets: `folder` (default) creates a folder named after the repository and places synced resources inside it, while `folderless` places synced resources at the top level without creating a wrapper folder. Refer to [Sync targets](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/#sync-targets) for details.
- _`<YOUR-GITHUB-REPO-URL>`_: The repository you want to synchronize using Git Sync. For example, `https://github.com/example/grafana-dashboards`.
- _`<SYNC-BRANCH>`_: The branch where you want to perform the sync. For example, `main`.

For more details and examples such as a GitHub repository via GitHub App Connection or a GitLab/Bitbucket repository with a token authentication, refer to [Repository resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_provisioning_repository_v0alpha1) in the Terraform registry.
