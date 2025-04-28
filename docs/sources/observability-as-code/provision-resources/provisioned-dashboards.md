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
title: Work with provisioned dashboards
weight: 300
---

# Work with provisioned dashboards

{{< admonition type="note" >}}
Git Sync and File path provisioning an [experimental feature](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. Enable the `provisioning` and `kubernetesDashboards` feature toggles in Grafana. These features aren't available in Grafana Cloud.
{{< /admonition >}}

- [Provision resources and sync dashboards](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/)
  - [Git Sync](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync/)
  - [Set up Git Sync](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/git-sync-setup/)
  - [Set up file provisioning](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup/)
  - [Work with provisioned dashboards](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/provisioned-dashboards/)
  - [Manage provisioned repositories with Git Sync](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/use-git-sync/)

<hr />

Using Provisioning, you can choose to store your dashboard JSON files in either GitHub repositories using Git Sync or a local file path.

For more information, refer to the [Dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/) documentation.

## Provisioning methods

Dashboards and folders synchronized using Git Sync or a local file path are referred to as "provisioned" resources.

Of the two experimental options, Git Sync is the recommended method for provisioning your dashboards.
You can synchronize any new dashboards and changes to existing dashboards to your configured GitHub repository.
If you push a change in the repository, those changes are mirrored in your Grafana instance.
For more information on configuring Git Sync, refer to [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync/).

### Local path provisioning

Using the local path provisioning makes files from a specified path available within Grafana.
These provisioned resources can only be modified in the local files and not within Grafana.
Any changes made in the configured local path are updated in Grafana.

Refer to [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup) to learn more about the version of local file provisioning in Grafana 12.

{{< admonition type="note" >}}
The experimental local path provisioning using **Administration** > **Provisioning** will replace the file provisioning methods Grafana uses for referencing local file.

For production systems, use the established methods for provisioning file systems in Grafana.
Refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#provision-folders-structure-from-filesystem-to-grafana) for more information.
{{< /admonition >}}

## Manage dashboards provisioned with Git Sync

Using Git Sync, you can manage your dashboards in the UI and synchronize them with a GitHub repository.

Git Sync changes the behavior in Grafana for dashboards that are saved in Git Sync:

- Dashboards saved in your repository or local folder configured with Git Sync appear in a provisioned folder in Grafana.
- Any dashboard folders saved with Git Sync have a **Provisioned** label in the UI.
- Any changes to a provisioned resources have to be saved to the repository by opening a pull request or committing directly to the `main` branch.

You can set a single folder, or multiple folders to a different repository, with up to 10 connections.

### Git workflow with dashboards

By default, Git version control uses a branch-based workflow for changes. This means that you can:

- Commit changes to an existing branch (such as `main`) or save them to a new branch in your GitHub repository.
- Use pull requests to review changes to dashboards.
- Preview the changes before merging.

To learn more about Git, refer to [Getting Started - About Version Control](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control) of the [Pro Git book](https://git-scm.com/book/en/v2) in the official Git documentation.

### Add and save a new dashboard

When you create a new dashboard in a provisioned folder associated with a GitHub repository, you follow the same process you use for any new dashboard.
Refer to [Create a dashboard](http://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/) for more information.

After you create the dashboard, the steps are similar to [Save dashboard changes to GitHub](#save-dashboard-changes-to-github).

1. Select **Save** to preserve the new dashboard.
1. Enter a title for the dashboard and a description.
1. Select the provisioned folder from the **Folder** drop-down list.
1. In **Path**, provide the path for your repository, ending in a JSON or YAML file.
1. For **Workflow**, select **Push to main** to make a Git commit directly to the repository or **Push to a new branch** to create a pull request.
   - **Branch**: Specify the branch name in GitHub (for example, main). This option only appears if you select **Push to a new branch**.
1. Select **Save**.

### Save dashboard changes to GitHub

When you edit a provisioned resource, you are prompted to save or discard those changes.
Saving changes requires opening a pull request in your GitHub repository.

1. Select **Edit** to update a provisioned dashboard. Make your desired changes.

1. Click **Save dashboard**.

1. On the **Provisioned dashboard** panel, choose the options you want to use:

   - **Update default refresh value**: Check this box to make the current refresh the new default.
   - **Update default variable values**: Check this box to make the current values the new default.
   - **Path**: Provide the path for your repository, ending in a JSON or YAML file.
   - **Workflow:** Select **Push to main** to make a Git commit directly to the repository or **Push to a new branch** to create a pull request.
   - **Branch**: Specify the branch name in GitHub (for example, main). This option only appears if you select **Push to a new branch**.
   - **Comment**: Add a comment describing your changes.

1. Optional: Select the **Changes** tab to view the differences between the updates you made and the original resource.

1. Select **Save**.

1. If you chose **Push to a new branch**, select **Open a pull request in GitHub** to open a new PR to your repository. GitHub opens with your dashboard’s code as the contents of the PR.

1. Follow your usual GitHub workflow to save and merge the PR to your repository.

### Tips

- Use GitHub pull requests for changes to maintain review processes.
- Provide clear commit messages describing your changes.
- Regularly sync your repository to keep Grafana up to date.
- Review the **Events** tab to monitor sync status.

## Manage dashboards provisioned with file provisioning

To update any resources in the local path, you need to edit the files directly and then save them locally.
These changes are synchronized to Grafana.
However, you can't create, edit, or delete these resources using the Grafana UI.

For more information, refer to [How it works](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/).

Refer to [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup/) for configuration instructions.
