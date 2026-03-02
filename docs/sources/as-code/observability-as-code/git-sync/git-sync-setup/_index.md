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

1. Read [Before you begin](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-before/) carefully
1. Set up Git Sync [using the UI](#set-up-git-sync-using-the-ui) or [as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-code/)
1. After setup, [verify your dashboards](#verify-your-dashboards-in-grafana)
1. Optionally, you can also [extend Git Sync with webhooks and image rendering](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-extend/)

## Set up Git Sync using the UI

To set up Git Sync from the Grafana UI, follow these steps:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning** in the left-side menu to access the Git Sync configuration screen. If you already have an active Git Sync connection, go to the **Get started** tab.
1. [Select your provider](#select-your-provider) to start a new Git Sync setup: GitHub, GitLab, Bitbucket, or Pure Git.
1. [Configure the provisioning repository](#configure-the-provisioning-repository).
1. [Choose what content to sync with Grafana](#choose-what-to-synchronize).
1. [Synchronize with external storage](#synchronize-with-external-storage).
1. [Choose additional settings](#choose-additional-settings).

## Select your provider

Git Sync is available for any Git provider through a Pure Git repository type, and has specific enhanced integrations for GitHub, GitLab and Bitbucket. Refer to [Compatible providers](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits#compatible-providers) for more details.

Alternatively, on-prem file provisioning in Grafana lets you include resources, including folders and dashboard JSON files, that are stored in a local file system. Refer to [Provision resources on-prem](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/) for more details.

Select any of the following options to proceed:

### Configure with GitHub

If you want to configure Git Sync for GitHub, you can connect using a **Personal Access Token** or with **GitHub App**.

#### Connect with a GitHub Personal Access Token

If you want to configure Git Sync for GitHub and authenticate with a Personal Access Token, sign in to GitHub and [create a new fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with these permissions:

- **Contents**: Read and write permission
- **Metadata**: Read-only permission
- **Pull requests**: Read and write permission
- **Webhooks**: Read and write permission

Refer to [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for instructions.

Return to Grafana and fill in the following fields:

1. Paste your GitHub personal access token into **Enter your access token**.
1. Paste the **Repository URL** for your GitHub repository into the text box.

Select **Configure repository** to set up your provisioning folder.

#### Connect with GitHub App

{{< admonition type="note" >}}

Refer to [Create a GitHub App](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/set-up-before#create-a-github-app) for instructions on how to create a GitHub App.

{{< /admonition >}}

If you want to configure Git Sync for GitHub and authenticate with GitHub App:

- If you already have an existing GitHub App connected:
  1. Select **Choose an existing app**.
  1. Click on the existing connection you want to use, and click on **Configure repository** to proceed.
  1. Paste the **Repository URL** for your GitHub repository into the text box.

- If you want to connect using a new GitHub App:
  1. Select **Connect to a new app**.
  1. Type in the following fields:
     - The ID of the GitHub App you want to use
     - The GitHub Installation ID
     - The Private Key
  1. Click on **Configure repository** to proceed.
  1. Paste the **Repository URL** for your GitHub repository into the text box.

Note that your GitHub App must have the following permissions:

- **Contents**: Read and write permission
- **Metadata**: Read-only permission
- **Pull requests**: Read and write permission
- **Webhooks**: Read and write permission

Select **Configure repository** to set up your provisioning folder.

### Configure with GitLab

If you want to configure Git Sync for GitLab, you need a GitLab Personal Access Token. To create one, [sign in to GitLab](https://gitlab.com/users/sign_in) and create a token with these permissions:

- **Repository**: Read and write permission
- **User**: Read only permission
- **API**: Read and write permission

Return to Grafana and fill in the following fields:

1. Paste the token into the **Project Access Token** text box.
1. Paste the **Repository URL** for your GitLab repository into the text box.

Select **Configure repository** to set up your provisioning folder.

### Configure with Bitbucket

If you want to configure Git Sync for Bitbucket, you need a Bitbucket API token with scopes. To create one, [sign in to Bitbucket](https://id.atlassian.com/login?application=bitbucket) and create an API token with these permissions:

- **Repositories**: Read and write permission
- **Pull requests**: Read and write permission
- **Webhooks**: Read and write permission

Return to Grafana and fill in the following fields:

1. Paste the token into the **API Token** text box.
1. Paste the **Repository URL** for your GitLab repository into the text box.

Select **Configure repository** to set up your provisioning folder.

### Configure with Pure Git

If you're using another Git provider, you need to use the Pure Git option to configure your connection with a Personal Access Token:

1. Paste the access token or password of the Git repository you want to sync in **Access Token**.
1. Enter a **Username**. Git Sync will use this name to access the Git repository.
1. Paste the **Repository URL** of your Git repository into the text box.

Select **Configure repository** to set up your provisioning folder.

## Configure the provisioning repository

After configuring your connection authentication, continue to enter the details of the repository you want to use for provisioning:

1. Enter a **Branch** to use for provisioning. The default value is `main`.
1. Optionally, you can add a **Path** to a subdirectory where your dashboards are stored.

Select **Choose what to synchronize** to have the connection to your repository verified and continue setup.

## Choose what to synchronize

On this screen, you will sync the external resources you specified in the previous step with your Grafana instance. These provisioned resources will be stored in a new folder in Grafana without affecting the rest of your instance.

To set up synchronization:

1. Select the external storage you want to sync with your Grafana instance. The UI provides information about the available resources you can sync.
1. Enter a **Display name** for your repository connection. All the synced resources from this Git Sync connection will appear under the this name in the Grafana UI.
1. Click **Synchronize with external storage** to continue.
1. You can repeat this process for up to 10 connections.

{{< admonition type="note" >}}

Optionally, you can export any unmanaged resources into the provisioned folder. See how in [Synchronize with external storage](#synchronize-with-external-storage).

{{< /admonition >}}

Select **Choose additional settings** to continue setup.

## Synchronize with external storage

In this screen:

1. Review the known limitations before proceeding.
1. Check the **Migrate existing resources** box to migrate your unmanaged dashboards to the provisioned folder. If you select this option, all future updates are automatically saved to the synced Git repository and provisioned back to the instance.
1. Click **Begin synchronization** to create the Git Sync connection.

After the process is completed, you will see a summary of the synced resources.

Click **Choose additional settings** for the final configuration steps.

## Choose additional settings

In this last step, you can configure the **Sync interval (seconds)** to indicate how often you want your Grafana instance to pull updates from GitHub. The default value is 300 seconds in Grafana Cloud, and 60 seconds in Grafana OSS/Enterprise.

You can also select these optional settings:

- Check **Read only** to ensure resources can't be modified in Grafana.
- Check **Enable pull request option when saving** to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.
- Check **Enable push to configured branch** to allow direct commits to the configured branch.

Select **Finish** to complete the setup.

## Verify your dashboards in Grafana

To verify that your dashboards are available at the location that you specified, go to **Dashboards**. The name of the dashboard is listed in the **Name** column.

Now that your dashboards have been synced from a repository, you can customize the name, change the branch, and create a pull request (PR) for it. Refer to [Manage provisioned repositories with Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/use-git-sync/) for more information.

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

- [Set up instantaneous pulling and dashboard previews in Pull Requests](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-extend)
- [Work with provisioned repositories with Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/use-git-sync/)
- [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/)
- [Git Sync deployment scenarios](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/git-sync-deployment-scenarios)
- [Export resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/export-resources/)
- [`grafanactl` documentation](https://grafana.github.io/grafanactl/)
