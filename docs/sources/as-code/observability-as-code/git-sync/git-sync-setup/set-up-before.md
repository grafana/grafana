---
description: Prerequisites for Git Sync, so you can provision GitHub repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - prerequisites
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Setup prerequisites
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-before/
aliases:
---

# Before you begin

{{< admonition type="caution" >}}

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) to understand usage limits for the different tiers.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

Before you begin to set up Git Sync, ensure you have the following:

- A Grafana instance (Cloud, OSS, or Enterprise)
- Administration rights in your Grafana organization
- A [Git provider](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits#compatible-providers)
- If you're [using webhooks or image rendering](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-extend), a public instance with external access
  - Optional: The [Image Renderer service](https://github.com/grafana/grafana-image-renderer) to save image previews with your PRs

Moreover, make sure you're not blocking any of the Grafana services IPs. For a list of IPs you need to add to your allowlist, refer to [Hosted Grafana source IPs](https://grafana.com/docs/grafana-cloud/security-and-account-management/allow-list/#hosted-grafana).

Finally, get acquainted with the following topics:

- [Git Sync supported resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/#supported-resources)
- [Git Sync usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits)
- For further details on how Git Sync operates, refer to [key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts)

## Enable required feature toggles

The `provisioning` feature toggle is enabled by default in Grafana Cloud and, starting in Grafana v13, for OSS and Enterprise as well. No manual configuration is required.

For more information about feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

### Enable Git providers

If you're using Grafana Enterprise v12.4.0 and want to set up Git Sync with pure Git, GitLab or Bitbucket, or if you're using Grafana OSS v12.4.0 and want to set up Git Sync with pure Git, add them to your configuration file:

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`.
1. Add the available providers:

   ```ini
   [provisioning]
   repository_types = "git|github|bitbucket|gitlab|local"
   ```

1. Save the changes to the file and restart Grafana.

## Create a GitHub App

GitHub Apps are tools that extend GitHub functionality. They use fine-grained permissions and short-lived tokens, giving you more control over which repositories are being accessed. Find out more in the [GitHub Apps official documentation](https://docs.github.com/en/apps/overview).

If you chose to authenticate with a newly created GitHub App, you'll need the following parameters:

- GitHub App ID
- GitHub App Private Key
- GitHub App Installation ID

There are many ways to create a GitHub App. The following instructions are informative only, always refer to official GitHub documentation for more details.

To create the GitHub App, follow these steps:

1. Go to https://github.com/settings/apps and click on **New Github App**, or navigate directly to https://github.com/settings/apps/new
1. Fill in the following fields:
   - Name: Must be unique
   - Homepage URL: For example, your Grafana Cloud instance URL
1. Scroll down to the **Webhook** section and uncheck the **Active** box
1. In the **Permissions** section, go to **Repository permissions** and set these parameters:
   - **Administration**: Read-only permission (enables validation of branch protection rules against the configured branch when users can push directly to it; may be used in the future to check other repository settings and make the setup process smoother)
   - **Contents**: Read and write permission
   - **Metadata**: Read-only permission
   - **Pull requests**: Read and write permission
   - **Webhooks**: Read and write permission
1. Finally, under **Where can this GitHub App be installed?**, select **Only on this account**
1. Click on **Create Github App** to complete the process.

On the app page:

1. Copy the **AppID** from the **About** section
1. Select the **Generate private key** from the banner or scroll down to to the **Private Keys** section to generate a key
1. A PEM file containing your private key will be downloaded to your computer

Finally, install the app:

1. At the top left of the App page, click on **Install App**
1. Choose for which user you need to install it, you’ll be redirected to the repository selection screen
1. Choose for which repositories you want to install the app
1. Click **Install**.
1. On the installation page, copy **`installationID`** from the page URL https://github.com/settings/installations/installationID

You can now proceed to [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/)!

## Folder roles and permissions

By default, folders provisioned with Git Sync have these roles:

- Admin = Admin
- Editor = Editor
- Viewer = Viewer.

To modify them, refer to [Manage folder permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/use-git-sync#manage-folder-permissions).

Refer to [Roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions) for more information about Grafana roles.
