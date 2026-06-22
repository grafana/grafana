---
description: Update, save, and modify provisioned resources in Grafana using Git Sync.
keywords:
  - dashboards
  - provisioned files
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
title: Work with provisioned dashboards in Git Sync
menuTitle: Work with provisioned dashboards
weight: 550
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/provisioned-dashboards/
aliases:
  - ../../../observability-as-code/provision-resources/provisioned-dashboards/ # /docs/grafana/next/observability-as-code/provision-resources/provisioned-dashboards/
  - ../provision-resources/provisioned-dashboards/
---

# Work with provisioned dashboards in Git Sync

{{< admonition type="note" >}}

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) to understand usage limits for the different tiers.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

Using provisioning, you can choose to store your dashboard JSON files in either Git repositories using Git Sync or a local path, and manage them through the Grafana interface. Dashboards and folders synchronized using Git Sync or a local path are referred to as _provisioned_ resources. **Git Sync is the recommended method for provisioning your dashboards**.

## Manage dashboards provisioned with Git Sync

Using Git Sync, you can manage your dashboards in the UI and synchronize them with your configured Git repository. If you push a change in the repository, those changes are mirrored in your Grafana instance.

- Dashboards saved in your repository or local folder configured with Git Sync appear in a provisioned folder in Grafana.
- Any dashboard folders saved with Git Sync have a **Provisioned** label in the UI.
- To save any changes to provisioned resources, open a pull request or commit directly to an existing branch, such as the `main` branch.
  - Use pull requests to review changes to dashboards.
  - Preview the changes before merging.

Refer to [Key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts) for more details.

## Create a new dashboard

{{< admonition type="note" >}}

If you want to add an existing dashboard to your provisioned resources, refer to [Export non-provisioned resources from Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/export-resources/).

{{< /admonition >}}

You have the following options to add new dashboards in your Git Sync connection:

- Create them directly within Git Sync-managed folders in the Grafana UI
- Add them by committing JSON files to your Git repository

### Add a new dashboard from the Grafana UI

To add a new dashboard from the Grafana UI:

1. On the **Dashboards** tab, click on **New** on the top right corner and chose one of these options:
   - **New dashboard**. When you create a new dashboard in a provisioned folder associated with a Git repository, you follow the same process you use for any new dashboard. Refer to [Create a dashboard](http://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/) for more information.
   - **Import dashboard**. Refer to [Add a dashboard using Import dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/export-resources##add-a-dashboard-using-import-dashboards) for more details.
   - **Use template**. Create a dashboard using a Grafana template.

After you create the dashboard, follow these steps:

1. Click **Save dashboard**.
1. On the **Provisioned dashboard** panel, choose the options you want to use:
   - **Title**: The title of the dashboard.
   - **Description**: Description of the dashboard.
   - **Target folder**: The folder where you want to store the new dashboard.
   - **Branch**: Specify the branch name in your Git provider (for example, main).
   - **Repository folder**: The folder inside the repository. Leave empty for the repository root.
   - **Filename**: The name of the dashboard file.
   - **Comment**: Add a comment describing your changes for you commit.
1. Optional: Select the **Changes** tab to view the differences between the updates you made and the original resource.
1. Select **Save**, and the updated dashboard will load.
1. On the prompt, select **Open a pull request in GitHub** to open a new PR to your repository.
1. Follow your usual Git workflow to save and merge the PR to your repository.

## Edit dashboards

When you edit a provisioned resource, you're prompted to save or discard those changes. Saving changes requires opening a pull request in your Git repository.

To save dashboard changes:

1. Select **Edit** to update a provisioned dashboard.
1. Make your desired changes, and click **Save dashboard**.
1. On the **Provisioned dashboard** panel, choose the options you want to use:
   - **Branch**: Specify the branch name in your Git provider (for example, main).
   - **Repository folder**: The folder inside the repository. Leave empty for the repository root.
   - **Filename**: The name of the dashboard file.
   - **Comment**: Add a comment describing your changes for your commit.
1. Optional: Select the **Changes** tab to view the differences between the updates you made and the original resource.
1. Select **Save**, and the updated dashboard will load.
1. On the prompt, select **Open a pull request in GitHub** to open a new PR to your repository.
1. Follow your usual Git workflow to save and merge the PR to your repository.

## Remove dashboards

You can remove a provisioned dashboard by deleting the dashboard from the repository. The Grafana UI updates when the changes from the Git repository sync.

To restore a deleted dashboard, raise a PR directly in your Git repository. Restoring resources from the UI isn't possible at the moment.

## Document folders with a README

You can document the contents or any other relevant piece of information of your provisioned folder in a `README.md` file stored alongside its resources in the repository. Grafana renders the README inline on the folder page, below the list of dashboards, so your team can see what's in the folder, how it's organized, and where to find the right dashboard without leaving Grafana.

- When the folder contains a `README.md` file, Grafana renders its Markdown content. Relative links and images in the README resolve against the host repository.
- If the folder has no `README.md`, or if the folder is empty, you'll be prompted to action with a **Add README** button.
- You can edit the README any time. Select the edit pencil in the README header to open the file in your Git provider's editor and commit changes through your usual workflow.

## Best practices

Follow these recommendations when working with provisioned dashboards:

- **Use GitHub pull requests for changes**: Maintain review processes for dashboard modifications.
- **Provide clear commit messages**: Describe your changes to help with tracking and collaboration.
- **Regularly sync your repository**: Keep Grafana up to date with the latest changes.
- **Review the Events tab**: Monitor sync status to ensure changes are applied correctly.
- **Add a folder README**: Document each folder's contents with a `README.md` so your teammates can find the right dashboard quickly.

Refer to [Work with provisioned repositories](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/use-git-sync) for general guidance about using Git Sync.
