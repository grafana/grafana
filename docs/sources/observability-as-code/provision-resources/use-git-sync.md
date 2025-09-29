---
description: Instructions for working with Git Sync to perform common tasks, such as saving dashboards to GitHub and synchronizing changes with Grafana.
keywords:
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
title: Manage provisioned repositories with Git Sync
menuTitle: Manage repositories with Git Sync
weight: 400
---

# Manage provisioned repositories with Git Sync

{{< admonition type="caution" >}}
TBC
{{< /admonition >}}

After you have set up Git Sync, you can synchronize any changes you make in your existing dashboards with your configured GitHub repository. Similarly, if you push a change in your repository, those changes are mirrored in your Grafana instance.

## Known limitations

Git Sync is under development and the following limitations apply:

- You can only authenticate using your GitHub token.
- Support for native Git and other providers, such as GitLab or Bitbucket, is scheduled.
- If you're using Git Sync in Grafana Cloud you can only sync specific folders for the moment. Git Sync will be available for your full instance soon. 
- History functionality in the UI is limited and restoring resources is currently not possible. For a workaround, restore dashboards directly in your GitHub repo by raising a PR.  

## View current status of synchronization

When you synchronize a repository, Git Sync also creates a dashboard that provides a summary of resources, health, pull status, webhook, sync jobs, resources, and files. 

Use the **View** section in **Provisioning** to see detailed information about the current status of your sync, understand the health of your repository's connection with Grafana, and [troubleshoot](#troubleshoot-synchronization) possible issues:

1. Log in to your Grafana server with an account that has the Grafana Admin or Editor flag set.
1. Select **Administration** in the left-side menu and then **Provisioning**.
1. Locate the repository you are interested in.
1. If you see a green `Up-to-date` label next to the repository name, then everything is syncing as expected.
1. Select **View** to access detailed dashboards and reports about the synchronization history of your repository.

## Synchronize changes

Synchronizing resources from provisioned repositories into your Grafana instance pulls the resources into the selected folder. Existing dashboards with the same `uid` are overwritten.

To sync changes from your Grafana dashboards with your Git repository:

1. From the left menu, select **Administration** > **Provisioning**.
1. Select **Pull** under the repository you want to sync.
1. Wait for the synchronization process to complete.

## Remove a repository

To delete a repository, follow these steps.

1. Log in to your Grafana server with an account that has the Grafana Admin or Editor flag set.
1. Select **Administration** in the left-side menu and then **Provisioning**.
1. Locate the repository you are interested in.
1. Select the trashcan icon in the right side to delete the chosen entry.
1. Select **Delete** to confirm.

Refer to [Work with provisioned dashboards](../provisioned-dashboards) for information on removing provisioned files.

## Troubleshoot synchronization

Monitor the **View** status page for synchronization issues and status updates. Common events include:

- Sync started
- Sync completed
- Sync failed (with error details)
- Sync issues

### Dashboard sync errors

- If dashboards are not syncing, check if the repository URL is correct and accessible from the Grafana instance.
- Ensure that the configured repository branch exists and is correctly referenced.
- Check for conflicts in the repository that may prevent syncing.

### Dashboard import errors

- Validate the JSON format of the dashboard files before importing.
- If the import fails, check Grafana logs for error messages and troubleshoot accordingly.
