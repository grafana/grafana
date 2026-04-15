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
refs:
  roles-and-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/
---

# Work with provisioned repositories in Git Sync

{{< admonition type="caution" >}}

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) to understand usage limits for the different tiers.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

After you sync your resources, Git Sync creates a dashboard that provides a summary of resources, health, pull status, webhook, sync jobs, resources, and files. To access it, follow these steps:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning** in the left-side menu to access the Git Sync configuration screen.
1. Go to the **Repositories** tab, and locate the repository you want to work with. You can view the current status of the sync, run pulls, or update your settings.

Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/provisioned-dashboards) for more information about working with provisioned files.

## View the current status of synchronization

Use the **View** section to see detailed information about the current status of your sync and [troubleshoot](#troubleshoot-synchronization) possible issues:

- The **Overview** tab contains information about the health of your repository's connection with Grafana, configuration options such as webhooks, or information on Git processes.

- The **Resources** tab lists the provisioned resources of the connection.

### Troubleshoot synchronization

{{< admonition type="caution" >}}

Before you proceed to troubleshoot, understand the [Usage and performance known limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits/).

{{< /admonition >}}

Monitor the **View** status page for synchronization issues and status updates. The status page displays the following events:

- **Sync started:** The synchronization process has begun.
- **Sync completed:** The synchronization process finished successfully.
- **Sync failed:** The synchronization process failed. Refer to the error details for troubleshooting.
- **Sync issues:** The synchronization process encountered issues.

**Dashboard sync errors**

- **Repository URL:** If dashboards don't sync, verify that the repository URL is correct and accessible from the Grafana instance.
- **Repository branch:** Verify that the configured repository branch exists and is correctly referenced.
- **Conflicts:** Check for conflicts in the repository that may prevent syncing.

**Dashboard import errors**

- Validate the JSON format of the dashboard files before importing.
- If the import fails, check Grafana logs for error messages and troubleshoot accordingly.

## Synchronize changes

To sync resources between the provisioned repositories and your Grafana instance, click **Pull** under the repository you want to sync. The synchronization process runs and completes.

Grafana overwrites existing dashboards with the same `uid`.

## Update or delete your settings

To update or delete your repository configuration after you complete setup:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning**.
1. Go to the **Repositories** tab, and locate the repository you want to modify.
1. Select **Settings** to access the **Configure repository** screen:

- To modify your configuration, update any of the settings and select **Save**.
- To delete the repository, click **Delete**. You can either keep the synced resources or delete them.

## Manage folder permissions

{{< admonition type="caution" >}}
To modify permissions, each provisioned folder must include the `_folder.json` metadata file with the folder's UID, which defines a stable folder ID used to set folder permissions. Without it, the folder's permissions will be lost if you move that folder to a different path in the Git repository.

For new provisioned folders managed with Git Sync, the metadata file is added automatically if you created the folder from the Grafana UI. If your folder is missing the metadata file, you'll see a warning in the UI with instructions on how to add the missing metadata.
{{< /admonition >}}

By default, folders provisioned with Git Sync have these roles with its associated permissions:

- Admin = Admin
- Editor = Editor
- Viewer = Viewer.

Refer to [Roles and permissions](ref:roles-and-permissions) for more information on what each role implies.

To modify folder permissions:

- From the UI, refer to [Manage dashboard permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/user-management/manage-dashboard-permissions/).
- Using the API, refer to [Dashboard Permissions API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard_permissions/).

### The folder's JSON metadata file

Each folder in a synced repository contains a `.folder.json` file at its root:

```json
{
  "apiVersion": "folder.grafana.app/v1beta1",
  "kind": "Folder",
  "metadata": {
    "name": "<FOLDER_UID>"
  },
  "spec": {
    "title": "<FOLDER_UI_NAME>"
  }
}
```

Where:

- `<FOLDER_UID>` is the stable folder UID that Grafana uses for permissions, bookmarks, and API references.
- `<FOLDER_UI_NAME>` is the display name shown in the Grafana UI. This parameter is optional. If not used, the folder name will be passed instead.
