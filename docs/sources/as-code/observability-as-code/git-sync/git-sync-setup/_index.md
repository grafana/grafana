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
weight: 120
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/
aliases:
  - ../../../observability-as-code/provision-resources/git-sync-setup/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
  - ../provision-resources/git-sync-setup/
  - ./git-sync-setup/ 
---

# Set up Git Sync 

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

Git Sync is under continuous development. [Report any issues](https://grafana.com/help/) you encounter to help us improve Git Sync.

{{< /admonition >}}

To set up Git Sync and synchronize your Grafana dashboards and folders with a GitHub repository, follow these steps:

1. Read [Before you begin](#before-you-begin) carefully
1. Set up Git Sync [using the UI](#set-up-git-sync-using-grafana-ui) or [as code](./set-up-code.md)
1. After setup, [verify your dashboards](#verify-your-dashboards-in-grafana)
1. Optionally, you can also [extend Git Sync with webhooks and image rendering](#extend-git-sync-for-real-time-notification-and-image-rendering)

{{< admonition type="note" >}}

You can configure a local file system instead of using GitHub. Refer to [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/file-path-setup/) for more information.

{{< /admonition >}}

## Before you begin

Before you begin, ensure you have the following:

- A Grafana instance (Cloud, OSS, or Enterprise).
- If you're [using webhooks or image rendering](#extend-git-sync-for-real-time-notification-and-image-rendering), a public instance with external access
- Administration rights in your Grafana organization
- A [GitHub private access token](#create-a-github-access-token)
- A GitHub repository to store your dashboards in
- Optional: The [Image Renderer service](https://github.com/grafana/grafana-image-renderer) to save image previews with your PRs

Get acquainted with the following topics:

- [Known limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync#known-limitations) 
- [Supported resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync#supported-resources) 

For further details refer to [key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts)

### Enable required feature toggles

To activate Git Sync in Grafana you need to set the `provisioning` and `kubernetesDashboards` feature toggles to `true`. To enable them:

- In Grafana Cloud, open a support ticket.

- In Grafana OSS/Enterprise: 

  1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`. 
  1. Add this value:

     ```ini
     [feature_toggles]
     provisioning = true
     kubernetesDashboards = true ; use k8s from browser
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

## Set up Git Sync using the UI

To set up Git Sync from the Grafana UI, follow these steps:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning** in the left-side menu to access the Git Sync configuration screen.
1. Select **Configure with GitHub**.
1. [Choose the connection type](#choose-the-connection-type): Personal Access Token or GitHub App
1. [Choose what content to sync with Grafana](#choose-what-to-synchronize)
1. [Synchronize with external storage](#synchronize-with-external-storage)
1. [Choose additional settings](#choose-additional-settings)

### Choose the connection type

On this screen you will configure your Git Sync connection, either using a Personal Access Token or with GitHub App.

#### Connect with a Personal Access Token

1. Paste your GitHub personal access token into **Enter your access token**. Refer to [Create a GitHub access token](#create-a-github-access-token) for instructions.
1. Paste the **Repository URL** for your GitHub repository into the text box.
1. Enter a branch to use for provisioning. The default value is `main`.
1. Optionally, you can add a **Path** to a subdirectory where your dashboards are stored. The default value is `grafana/`. If your dashboards are stored in the root of your repository, then remove the directory name.

Select **Choose what to synchronize** to have the connection to your repository verified and continue setup.

#### Connect with GitHub App

TBD

### Choose what to synchronize

On this screen, you will sync your selected external resources with Grafana. These provisioned resources will be stored in a new folder in Grafana without affecting the rest of your instance.

To set up synchronization:

1. Select which resources you want to sync.
1. Enter a **Display name** for the repository connection. Resources stored in this connection appear under the chosen display name in the Grafana UI.
1. Click **Synchronize** to continue.
1. You can repeat this process for up to 10 connections.

{{< admonition type="note" >}}

Optionally, you can export any unmanaged resources into the provisioned folder. See how in [Synchronize with external storage](#synchronize-with-external-storage).

{{< /admonition >}}

Select **Choose additional settings** to continue setup.

#### Full instance sync

Full instance sync is not available in Grafana Cloud and is experimental and unsupported in Grafana OSS/Enterprise. To have access to this option you must enable experimental instance sync.

### Synchronize with external storage

Check the **Migrate existing resources** box to migrate your unmanaged dashboards to the provisioned folder. If you select this option, all future updates are automatically saved to the synced Git repository and provisioned back to the instance.

### Choose additional settings

You can configure the following additional settings:

- **Sync interval (seconds)**. Enter how often you want your Grafana instance to pull updates from GitHub. The default value is 60 seconds.

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

| Capability             | Benefit             | Requires                  |
| ------------------ | ---------------------------- | -------------------------- |
| A table summarizing changes to your pull request | A convenient way to save changes back to GitHub                       | Webhooks configured                    |
| A dashboard preview image to a PR                 | A snapshot of dashboard changes to a pull request outside Grafana | Image renderer and webhooks configured |

### Set up webhooks for real-time notification and pull request integration

Git Sync uses webhooks to enable real-time updates from GitHub public repositories, or to enable pull request integrations. Without webhooks the polling interval is set during configuration, and is 60 seconds by default. You can set up webhooks with whichever service or tooling you prefer: Cloudflare Tunnels with a Cloudflare-managed domain, port-forwarding and DNS options, or a tool such as `ngrok`.

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

Set up image rendering to add visual previews of dashboard updates directly in pull requests. Image rendering also requires webhooks.

To enable this capability, install the Grafana Image Renderer in your Grafana instance. For more information and installation instructions, refer to the [Image Renderer service](https://github.com/grafana/grafana-image-renderer).

## Update or delete your Git Sync configuration  

To update or delete your repository configuration after you've completed setup:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning**.
1. Select **Settings** for the repository you wish to modify to access the **Configure repository** screen.
1. To modify your configuration, update any of the settings and select **Save**.
1. To delete the repository, click **Delete**.

## Next steps

You've successfully set up Git Sync to manage your Grafana dashboards through version control. Your dashboards are now synchronized with a GitHub repository, enabling collaborative development and change tracking.

To learn more about using Git Sync:

- [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/)
- [Manage provisioned repositories with Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/use-git-sync/)
- [Git Sync deployment scenarios](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/git-sync-deployment-scenarios)
- [Export resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/export-resources/)
- [grafanactl documentation](https://grafana.github.io/grafanactl/)
