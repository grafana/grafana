---
description: Instructions for setting up Git Sync, so you can provision GitHub repositories for use with Grafana.
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
title: Set up Git Sync
weight: 120
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-before/
aliases:
---

# Before you begin 

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

Before you begin to set up Git Sync, ensure you have the following:

- A Grafana instance (Cloud, OSS, or Enterprise)
- If you're [using webhooks or image rendering](#extend-git-sync-for-real-time-notification-and-image-rendering), a public instance with external access
- Administration rights in your Grafana organization
- A Git provider
- A GitHub repository to store your dashboards in
- Optional: The [Image Renderer service](https://github.com/grafana/grafana-image-renderer) to save image previews with your PRs

Get acquainted with the following topics:

- [Supported resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync#supported-resources)
- [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits)

For further details on how Git Sync operates refer to [key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts).

## Enable required feature toggles

In Grafana Cloud, Git Sync is being rolled out gradually. For more details refer to [Rolling release channels for Grafana Cloud](https://grafana.com/docs/rolling-release/).

To activate Git Sync in Grafana OSS/Enterprise, set the `provisioning` feature toggle to `true`:

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`.
1. Add this value:

   ```ini
   [feature_toggles]
   provisioning = true
   ```

1. Save the changes to the file and restart Grafana.

For more information about feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#experimental-feature-toggles).

### GitHub

### Create a GitHub access token

If you chose to authenticate with a GitHub Personal Access Token, create one with the repository permissions described below, and add it to your Git Sync configuration to enable read and write permissions between Grafana and GitHub repository.

To create a GitHub access token:

1. [Create a new fine-grained personal access token](https://github.com/settings/personal-access-tokens/new). Refer to [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for instructions.
1. Under **Permissions**, click **Select permissions** and select the following:
   - **Contents**: Read and write permission
   - **Metadata**: Read-only permission
   - **Pull requests**: Read and write permission
   - **Webhooks**: Read and write permission
1. Select any additional options and then press **Generate token**.
1. Copy the access token. Leave the browser window available with the token until you've completed configuration.

### Create a GitHub App

GitHub Apps are tools that extend GitHub functionality. They use fine-grained permissions and short-lived tokens, giving you more control over which repositories are being accessed. Find out more in the [GitHub Apps official documentation](https://docs.github.com/en/apps/overview).

If you chose to authenticate with a newly created GitHub App, you'll need the following parameters:

- GitHub App ID
- GitHub App Private Key
- GitHub App Installation ID

There are many ways to create a GitHub App. The following instructions are orientative, always refer to official GitHub documentation for more details.

To create the GitHub App, follow these steps:

1. Go to https://github.com/settings/apps and click on **New Github App**, or navigate directly to https://github.com/settings/apps/new
1. Fill in the following fields:
   - Name: Must be unique
   - Homepage URL: For example, your Grafana Cloud instance URL
1. Scroll down to the **Webhook** section and uncheck the **Active** box
1. In the **Permissions** section, go to **Repository permissions** and set these parameters:
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

