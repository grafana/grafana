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
weight: 500
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

{{< admonition type="note" >}}

Git Sync functionalities are constantly evolving. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

After you sync your resources, Git Sync creates a dashboard that provides a summary of resources, health, pull status, webhook, sync jobs, resources, and files. To access it, follow these steps:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration > General > Provisioning** in the left-side menu to access the Git Sync configuration screen.
1. Go to the **Repositories** tab, and locate the repository you want to work with. You can view the current status of the sync, run pulls, or update your settings.

Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/provisioned-dashboards) for more information about working with provisioned files.

## View the current status of your synchronized repository

Use the **View** section to see detailed information about the current status of your sync and [troubleshoot](#troubleshoot-synchronization) possible issues:

- The **Overview** tab contains information about the health of your repository's connection with Grafana, configuration options such as webhooks, or information on Git processes.

- The **Resources** tab lists the provisioned resources of the connection.

### Troubleshoot synchronization

{{< admonition type="note" >}}

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

{{< admonition type="note" >}}

It may take a few minutes for your changes to reflect on your screen. If they don't, refresh the UI manually.

{{< /admonition >}}

## Manage folder permissions

By default, users keep their roles in folders provisioned with Git Sync.

| Grafana Role | Folder Permission |
| ------------ | ----------------- |
| Admin        | Admin             |
| Editor       | Editor            |
| Viewer       | Viewer            |

Refer to [Git Sync permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana) to understand and set up permissions in Git Sync.

### Modify folder permissions

{{< admonition type="note" >}}
To modify permissions, each provisioned folder must include the `_folder.json` metadata file, which gives the folder a stable UID. Without it, the folder's permissions are lost if you move or rename that folder in the Git repository. Refer to [The Git Sync folder metadata file](#the-git-sync-folder-metadata-file) for details about this file and why it exists.
{{< /admonition >}}

Folder permissions attach to the folder's UID (stored in `_folder.json`), not to its repository path, so you can only set them after Git Sync has created the folder. To add or modify folder permissions:

- From the UI, select **Folder actions > Manage permissions** on the top right corner.
- Using the API, refer to [Dashboard Permissions API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard_permissions/).
- As code with Terraform, using the folder UID from `_folder.json`. Refer to [Modify folder-level permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana/#modify-folder-level-permissions) for manual and Terraform examples.

### The Git Sync folder metadata file

Each provisioned folder in a synced repository contains a `_folder.json` metadata file at its root. This file is the folder's manifest: it stores the folder's stable UID and its display name, so both survive changes to the repository layout.

The file exists because a directory path isn't a stable identity. Without `_folder.json`, Grafana derives the folder UID from a hash of the directory path in the repository. If you move or rename that directory in Git, the hash changes and Grafana treats it as a different folder: everything attached to the old UID, such as custom folder permissions, bookmarks, and API references, is lost. With `_folder.json`, the UID travels with the directory, so you can reorganize your repository without breaking permissions or references.

The file also separates the folder's display name from the directory name. The directory keeps a filesystem-friendly name, for example `team-platform`, while the `spec.title` field holds the name shown in the Grafana UI, for example `Team Platform`.

Grafana manages this file for you:

- When you create a provisioned folder from the Grafana UI, Git Sync commits the `_folder.json` file together with the folder.
- When you rename a folder in Grafana, Git Sync updates the `spec.title` field in the file.
- If a folder is missing the file, for example because you created the directory directly in Git, Grafana falls back to the hash-derived UID and shows a warning in the UI with instructions on how to add the missing metadata.

The file has the following format:

```json
{
  "apiVersion": "<API_VERSION>",
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

- `<API_VERSION>` is the version of the folders API. For example, `folder.grafana.app/v1`.
- `<FOLDER_UID>` is the stable folder UID that Grafana uses for permissions, bookmarks, and API references. Treat this value as immutable: Grafana rejects folder UID changes, and changing it directly in Git breaks the link between the directory and the existing Grafana folder, with the same consequences as having no metadata file.
- `<FOLDER_UI_NAME>` is the display name shown in the Grafana UI. This field is optional. If it's not set, Grafana uses the directory name instead.
