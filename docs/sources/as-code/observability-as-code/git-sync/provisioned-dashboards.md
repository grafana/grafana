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
weight: 450
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/provisioned-dashboards/
aliases:
  - ../../../observability-as-code/provision-resources/provisioned-dashboards/ # /docs/grafana/next/observability-as-code/provision-resources/provisioned-dashboards/
  - ../provision-resources/provisioned-dashboards/
---

# Work with provisioned dashboards in Git Sync

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

Using provisioning, you can choose to store your dashboard JSON files in either GitHub repositories using Git Sync or a local path, and manage them through the Grafana interface. Dashboards and folders synchronized using Git Sync or a local path are referred to as _provisioned_ resources. For more information, refer to the [Dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/) documentation.

**Git Sync** is the recommended method for provisioning your dashboards. You can synchronize any new dashboards and changes to existing dashboards to your configured GitHub repository. If you push a change in the repository, those changes are mirrored in your Grafana instance. Refer to [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/file-path-setup) to learn more about the version of local file provisioning in Grafana 12.

## Manage dashboards provisioned with Git Sync

Using Git Sync, you can manage your dashboards in the UI and synchronize them with a GitHub repository. Refer to [How it works](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/#how-it-works) for more details.

- Dashboards saved in your repository or local folder configured with Git Sync appear in a provisioned folder in Grafana.
- Any dashboard folders saved with Git Sync have a **Provisioned** label in the UI.
- To save any changes to provisioned resources, open a pull request or commit directly to an existing branch, such as the `main` branch.
  - Use pull requests to review changes to dashboards.
  - Preview the changes before merging.

To learn more about Git, refer to [Getting Started - About Version Control](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control) of the [Pro Git book](https://git-scm.com/book/en/v2) in the official Git documentation.

### Create a new dashboard

{{< admonition type="note" >}}

If you want to add an existing dashboard to your provisioned resources, refer to [Export non-provisioned resources from Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/export-resources/).

{{< /admonition >}}

You have two options for creating **new** dashboards or folders in Git Sync:

- Create them directly within Git Sync-managed folders in the Grafana UI
- Add them by committing JSON files to your Git repository

When you create a new dashboard in a provisioned folder associated with a GitHub repository, you follow the same process you use for any new dashboard. Refer to [Create a dashboard](http://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/) for more information.

After you create the dashboard, follow these steps:

1. Select **Save** to preserve the new dashboard.
1. Enter a title for the dashboard and a description.
1. Select the provisioned folder from the **Folder** drop-down list.
1. In **Path**, provide the path for your repository, ending in a JSON or YAML file.
1. For **Workflow**, select **Push to main** to make a Git commit directly to the repository or **Push to a new branch** to create a pull request.
   - **Branch**: Specify the branch name in GitHub (for example, main). This option only appears if you select **Push to a new branch**.
1. Select **Save**.

### Edit dashboards

When you edit a provisioned resource, you're prompted to save or discard those changes. Saving changes requires opening a pull request in your GitHub repository.

To save dashboard changes:

1. Select **Edit** to update a provisioned dashboard. Make your desired changes.

1. Click **Save dashboard**.

1. On the **Provisioned dashboard** panel, choose the options you want to use:
   - **Update default refresh value**: Check this box to make the current refresh the new default
   - **Update default variable values**: Check this box to make the current values the new default
   - **Path**: Provide the path for your repository, ending in a JSON or YAML file
   - **Workflow:** Select **Push to main** to make a Git commit directly to the repository or **Push to a new branch** to create a pull request
   - **Branch**: Specify the branch name in GitHub (for example, main). This option only appears if you select **Push to a new branch**
   - **Comment**: Add a comment describing your changes

1. Optional: Select the **Changes** tab to view the differences between the updates you made and the original resource.

1. Select **Save**.

1. If you chose **Push to a new branch**, select **Open a pull request in GitHub** to open a new PR to your repository. GitHub opens with your dashboard's code as the contents of the PR.

1. Follow your usual GitHub workflow to save and merge the PR to your repository.

### Remove dashboards

You can remove a provisioned dashboard by deleting the dashboard from the repository. The Grafana UI updates when the changes from the GitHub repository sync.

To restore a deleted dashboard, raise a PR directly in your GitHub repository. Restoring resources from the UI isn't possible at the moment.

## Best practices

Follow these recommendations when working with provisioned dashboards:

- **Use GitHub pull requests for changes**: Maintain review processes for dashboard modifications
- **Provide clear commit messages**: Describe your changes to help with tracking and collaboration
- **Regularly sync your repository**: Keep Grafana up to date with the latest changes
- **Review the Events tab**: Monitor sync status to ensure changes are applied correctly
