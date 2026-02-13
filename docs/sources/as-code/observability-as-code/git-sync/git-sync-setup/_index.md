---
description: Instructions for setting up Git Sync, so you can provision GitHub repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync
weight: 150
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/
aliases:
  - ../../../observability-as-code/provision-resources/git-sync-setup/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
  - ../provision-resources/git-sync-setup/
  - ./git-sync-setup/
---

# Set up Git Sync

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

To set up Git Sync and synchronize your Grafana dashboards and folders with a GitHub repository, follow these steps:

1. Read [Before you begin](#before-you-begin) carefully
1. Set up Git Sync [using the UI](#set-up-git-sync-using-the-ui) or [as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/)
1. After setup, [verify your dashboards](#verify-your-dashboards-in-grafana)
1. Optionally, you can also [extend Git Sync with webhooks and image rendering](#extend-git-sync-for-real-time-notification-and-image-rendering)

{{< admonition type="note" >}}

You can configure a local file system instead of using GitHub. Refer to [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/file-path-setup/) for more information.

{{< /admonition >}}

## Before you begin

Before you begin, ensure you have the following:

- A Grafana instance (Cloud, OSS, or Enterprise)
- If you're [using webhooks or image rendering](#extend-git-sync-for-real-time-notification-and-image-rendering), a public instance with external access
- Administration rights in your Grafana organization
- An **authentication method** for your connection: either a [GitHub private access token](#create-a-github-access-token) or a [GitHub App](#create-a-github-app)
- A GitHub repository to store your dashboards in
- Optional: The [Image Renderer service](https://github.com/grafana/grafana-image-renderer) to save image previews with your PRs

Get acquainted with the following topics:

- [Supported resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync#supported-resources)
- [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits)

For further details on how Git Sync operates refer to [key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts).

### Enable required feature toggles

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

## Set up Git Sync using the UI

To set up Git Sync from the Grafana UI, follow these steps:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning** in the left-side menu to access the Git Sync configuration screen. If you already have an active Git Sync connection, go to the **Getting Started** tab.
1. Select **Configure with GitHub**.
1. [Choose the connection type](#choose-the-connection-type). There's two methods to connect Git Sync: with a Personal Access Token or via GitHub App
1. [Configure the provisioning repository](#configure-repository)
1. [Choose what content to sync with Grafana](#choose-what-to-synchronize)
1. [Synchronize with external storage](#synchronize-with-external-storage)
1. [Choose additional settings](#choose-additional-settings)

### Choose the connection type

On this screen you will configure your Git Sync connection, either using a **Personal Access Token** or with **GitHub App**.

#### Connect with a Personal Access Token

{{< admonition type="note" >}}

Refer to [Create a GitHub access token](#create-a-github-access-token) for instructions for instructions on how to create a Personal Access Token.

{{< /admonition >}}

If you want to configure your connection with a Personal Access Token, select the option and follow these steps:

1. Paste your GitHub personal access token into **Enter your access token**.
1. Paste the **Repository URL** for your GitHub repository into the text box.

Select **Configure repository** to set up your provisioning folder.

#### Connect with GitHub App

{{< admonition type="note" >}}

Refer to [Create a GitHub App](#create-a-github-app) for instructions on how to create a GitHub App.

{{< /admonition >}}

If you already have an existing GitHub App connected:

1. Select **Choose an existing app**.
1. Click on the existing connection you want to use, and click on **Configure repository** to proceed.
1. Paste the **Repository URL** for your GitHub repository into the text box.

If you want to connect using a new GitHub App:

1. Select **Connect to a new app**.
1. Type in the following fields:
   - The ID of the GitHub App you want to use
   - The GitHub Installation ID
   - The Private Key
1. Click on **Configure repository** to proceed.
1. Paste the **Repository URL** for your GitHub repository into the text box.

Select **Configure repository** to set up your provisioning folder.

### Configure repository

Configure the repository you want to use for provisioning:

1. Enter a branch to use for provisioning. The default value is `main`.
1. Optionally, you can add a **Path** to a subdirectory where your dashboards are stored.

Select **Choose what to synchronize** to have the connection to your repository verified and continue setup.

### Choose what to synchronize

On this screen, you will sync your selected external resources with Grafana. These provisioned resources will be stored in a new folder in Grafana without affecting the rest of your instance.

To set up synchronization:

1. Select the external storage you want to sync with your Grafana instance. The UI provides information about the available resources you can sync.
1. Enter a **Display name** for your repository connection. All the synced resources from this Git Sync connection will appear under the this name in the Grafana UI.
1. Click **Synchronize with external storage** to continue.
1. You can repeat this process for up to 10 connections.

{{< admonition type="note" >}}

Optionally, you can export any unmanaged resources into the provisioned folder. See how in [Synchronize with external storage](#synchronize-with-external-storage).

{{< /admonition >}}

Select **Choose additional settings** to continue setup.

### Synchronize with external storage

In this screen:

1. Review the known limitations before proceeding.
1. Check the **Migrate existing resources** box to migrate your unmanaged dashboards to the provisioned folder. If you select this option, all future updates are automatically saved to the synced Git repository and provisioned back to the instance.
1. Click **Begin synchronization** to create the Git Sync connection.

### Choose additional settings

You connection is complete!

In this last step, you can configure the **Sync interval (seconds)** to indicate how often you want your Grafana instance to pull updates from GitHub. The default value is 300 seconds in Grafana Cloud, and 60 seconds in Grafana OSS/Enterprise.

You can also select these optional settings:

- Check **Read only** to ensure resources can't be modified in Grafana.
- Check **Enable pull request option when saving** to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.
- Check **Enable push to configured branch** to allow direct commits to the configured branch.

Select **Finish** to complete the setup.

## Verify your dashboards in Grafana

To verify that your dashboards are available at the location that you specified, go to **Dashboards**. The name of the dashboard is listed in the **Name** column.

Now that your dashboards have been synced from a repository, you can customize the name, change the branch, and create a pull request (PR) for it. Refer to [Manage provisioned repositories with Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/use-git-sync/) for more information.

## Extend Git Sync for real-time notification and image rendering

Optionally, you can extend Git Sync by enabling pull request notifications and image previews of dashboard changes.

| Capability                                       | Benefit                                                           | Requires                               |
| ------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------- |
| A table summarizing changes to your pull request | A convenient way to save changes back to GitHub                   | Webhooks configured                    |
| A dashboard preview image to a PR                | A snapshot of dashboard changes to a pull request outside Grafana | Image renderer and webhooks configured |

### Set up webhooks for real-time notification and pull request integration

Real-time notifications (or automatic pulling) is enabled and configured by default in Grafana Cloud.

In Grafana OSS/Enterprise, Git Sync uses webhooks to enable real-time updates from GitHub public repositories, or to enable pull request integrations. Without webhooks the polling interval is set during configuration, and is 60 seconds by default. You can set up webhooks with whichever service or tooling you prefer: Cloudflare Tunnels with a Cloudflare-managed domain, port-forwarding and DNS options, or a tool such as `ngrok`.

To set up webhooks:

1. Expose your Grafana instance to the public Internet.

- Use port forwarding and DNS, a tool such as `ngrok`, or any other method you prefer.
- The permissions set in your GitHub access token provide the authorization for this communication.

1. After you have the public URL, add it to your Grafana configuration file:

```ini
[server]
root_url = https://<PUBLIC_DOMAIN>
```

1. Replace _`<PUBLIC_DOMAIN>`_ with your public domain.

To check the configured webhooks, go to **Administration > General > Provisioning** and click the **View** link for your GitHub repository.

#### Expose necessary paths only

If your security setup doesn't permit publicly exposing the Grafana instance, you can either choose to allowlist the GitHub IP addresses, or expose only the necessary paths.

The necessary paths required to be exposed are, in RegExp:

- `/apis/provisioning\.grafana\.app/v0(alpha1)?/namespaces/[^/]+/repositories/[^/]+/(webhook|render/.*)$`

### Set up image rendering for dashboard previews

{{< admonition type="caution" >}}

Only available in Grafana OSS and Grafana Enterprise.

{{< /admonition >}}

Set up image rendering to add visual previews of dashboard updates directly in pull requests. Image rendering also requires webhooks.

To enable this capability, install the Grafana Image Renderer in your Grafana instance. For more information and installation instructions, refer to the [Image Renderer service](https://github.com/grafana/grafana-image-renderer).

## Update or delete your synced resources

To update or delete your repository configuration after you've completed setup:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning**.
1. Go to the **Repositories** tab, and locate the repository you want to modify.
1. Select **Settings** to access the **Configure repository** screen:

- To modify your configuration, update any of the settings and select **Save**.
- To delete the repository, click **Delete**. You can either keep the synced resources or delete them.

## Next steps

You've successfully set up Git Sync to manage your Grafana dashboards through version control. Your dashboards are now synchronized with a GitHub repository, enabling collaborative development and change tracking.

To learn more about using Git Sync refer to the following documents:

- [Manage provisioned repositories with Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/use-git-sync/)
- [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/)
- [Git Sync deployment scenarios](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/git-sync-deployment-scenarios)
- [Export resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/export-resources/)
- [`grafanactl` documentation](https://grafana.github.io/grafanactl/)
