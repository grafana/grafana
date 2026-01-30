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
    - cloud
title: Work with provisioned repositories in Git Sync
menuTitle: Work with provisioned repositories
weight: 400
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/use-git-sync/
aliases:
  - ../../../observability-as-code/provision-resources/use-git-sync/ # /docs/grafana/next/observability-as-code/provision-resources/use-git-sync/
  - ../provision-resources/use-git-sync/
---

# Work with provisioned repositories in Git Sync

{{< admonition type="caution" >}}

TBC

{{< /admonition >}}

After you have synced your resources, Git Sync creates a dashboard that provides a summary of resources, health, pull status, webhook, sync jobs, resources, and files. To access it, follow these steps:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning** in the left-side menu to access the Git Sync configuration screen. 
1. Go to the **Repositories** tab, and locate the repository you want to work with. You can either view the current status of the sync, carry out pulls, or update your settings.

## View the current status of synchronization

Use the **View** section to see detailed information about the current status of your sync and [troubleshoot](#troubleshoot-synchronization) possible issues:

- The **Overview** tab contains information about the health of your repository's connection with Grafana, configuration options such as webhooks, or information on Git processes.

- The **Resources** tab lists the provisioned resources of the connection.

### Troubleshoot synchronization

{{< admonition type="caution" >}}

Before you proceed to troubleshoot, understand the [known limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync#known-limitations/).

{{< /admonition >}}

Monitor the **View** status page for synchronization issues and status updates. Common events include:

- Sync started
- Sync completed
- Sync failed (with error details)
- Sync issues

#### Dashboard sync errors

- If dashboards are not syncing, check if the repository URL is correct and accessible from the Grafana instance.
- Ensure that the configured repository branch exists and is correctly referenced.
- Check for conflicts in the repository that may prevent syncing.

#### Dashboard import errors

- Validate the JSON format of the dashboard files before importing.
- If the import fails, check Grafana logs for error messages and troubleshoot accordingly.

## Synchronize changes

To sync resources between the provisioned repositories and your Grafana instance, click **Pull** under the repository you want to sync, and wait for the synchronization process to complete.

Existing dashboards with the same `uid` are overwritten.

## Update or delete your settings

To update or delete your repository configuration after you've completed setup:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning**.
1. Go to the **Repositories** tab, and locate the repository you want to modify.
1. Select **Settings** to access the **Configure repository** screen:

- To modify your configuration, update any of the settings and select **Save**.
- To delete the repository, click **Delete**. You can either keep the synced resources or delete them.

Refer to [Work with provisioned dashboards](../provisioned-dashboards) for information on removing provisioned files.