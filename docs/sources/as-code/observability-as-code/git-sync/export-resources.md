---
description: Export non-provisioned resources from Grafana.
keywords:
  - dashboards
  - resources
  - git sync
  - github
  - export
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Add non-provisioned resources from Grafana
menuTitle: Add non-provisioned resources
weight: 400
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/export-resources/
aliases:
  - ../provision-resources/export-resources/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
---

# Add non-provisioned resources from Grafana

{{< admonition type="note" >}}

Git Sync functionalities are constantly evolving. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

This page walks you through migrating existing, non-provisioned dashboards and folders in Grafana so they're managed by Git Sync.

The migration follows the same three steps regardless of which method you use:

1. [Before you begin](#before-you-begin): Back up your instance and understand what Git Sync manages.
1. [Add the resources to your Git repository](#step-1-add-the-resources-to-your-git-repository): Choose one of the available methods.
1. [Delete the original unmanaged resources](#step-2-delete-the-original-unmanaged-resources): Required so Git Sync can adopt the resource under its original UID.
1. [Validate the result](#step-3-validate-the-migration): Confirm the resource is synced before moving on.

## Before you begin

Git Sync only manages dashboards and folders. Alerts, data sources, library panels, and other resources are **not** supported yet. Migrating to Git Sync involves deleting the original resources so Git Sync can adopt them, so plan the migration carefully before you start.

{{< admonition type="caution" >}}

**Deleting a folder deletes everything it contains, including unsupported resources such as alert rules and library panels.**

Git Sync recreates dashboards and folders, but it does not recreate alerts, library panels, or any other unsupported resource. If you delete or recreate a folder to match your repository structure, any alert rules or library panels stored in that folder are deleted permanently and are not restored by Git Sync.

Before deleting any folder, move its alert rules, library panels, and other unsupported resources somewhere safe.

{{< /admonition >}}

To migrate safely, we recommend that you:

- **Back up your instance first.** Export or snapshot your dashboards, folders, alert rules, and library panels before you delete anything. Deleted resources can't be restored from the Grafana UI.
- **Migrate folder by folder.** Start with a single folder, complete the full migration for it, and validate the result before moving to the next one. This limits the impact if something goes wrong and lets you get comfortable with the process.
- **Delete resources, not folders, where possible.** You only need to delete the individual dashboards you're migrating so Git Sync can adopt them by UID. Avoid deleting or recreating folders unless you're certain they contain no unsupported resources.

## Step 1: Add the resources to your Git repository

You can add dashboards to Git Sync using any of the following methods:

- [Add a dashboard using Import dashboards](#add-a-dashboard-using-import-dashboards)
- [Copy an existing dashboard from the Grafana UI](#copy-an-existing-dashboard-from-the-grafana-ui)
- [Add a dashboard with the Grafana CLI](#add-a-dashboard-with-the-grafana-cli)
- [Add a dashboard via JSON export](#add-a-dashboard-via-json-export)

The Import and Copy methods add the dashboard through the Grafana UI and don't require you to delete the original resource. The Grafana CLI and JSON export methods preserve the original UID, so they require you to delete the original resource in [Step 2](#step-2-delete-the-original-unmanaged-resources).

### Add a dashboard using Import dashboards

You can import dashboards directly into your Git Sync provisioned folders using the Grafana UI or the HTTP API.

![Import dashboard](/static/img/docs/ascode/gitsync-dashboards-import.png)

To access the Import dashboard tool from the Git Sync UI:

1. Go to the **Dashboards tab** of you connection.
1. On the top right corner, click **New**.
1. Select **Import dashboard** and you'll be redirected to the wizard.
1. Upload or paste the dashboard JSON.
1. Fill in the relevant fields, including the branch and repository folder, and press **Import**.
1. Open the pull request, follow your regular workflow, and merge. Note that it could take a few minutes until the imported dashboard appears.

Keep in mind the following:

- UIDs are globally unique per org. Two repositories with dashboards sharing a UID will conflict.
- Two dashboards can share a title as long as they live at different paths in the repo. If a file with the same name already exists at the target path, the import is stopped before it overwrites anything.

For more information refer to [Import dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/import-dashboards/) in the Data Visualization documentation.

{{< admonition type="note" >}}

It may take a few minutes for your changes to reflect on your screen. If they don't, refresh the UI manually.

{{< /admonition >}}

### Copy an existing dashboard from the Grafana UI

You can also save a copy of dashboard directly from the Grafana UI to your provisioned folder.

To do so, follow these steps:

1. Make sure the dashboard is in **Editable** mode.
1. Select **Save** or **Save as** from the top-right corner.
1. In the menu:
   - **Target folder**: Select the provisioned folder from your Grafana UI where you want to save the dashboard in.
   - **Branch**: Type in the name of the branch of the provisioned repository you want to work in, or create a new branch. Committing directly to `main` is not supported.
   - **Folder**: Type in the folder in your sync repository, if any.
   - Fill in the rest of the fields accordingly.
1. Click **Save**.
1. In your synced GitHub repository, merge the branch with the dashboard you want to sync.

### Add a dashboard with the Grafana CLI

You can also export an existing dashboard from the terminal or from agentic coding tools using the CLI `gcx`. With `gcx` you can download the resources you want to sync from Grafana, and then commit and push those files to your provisioned Git repository. Git Sync will then detect the commit, and synchronize with Grafana.

{{< admonition type="note" >}}

For more information refer to the [`gcx` documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/gcx/).

{{< /admonition >}}

To add a dashboard with `gcx`, follow these steps:

1. Set up the `gcx` context to point to your instance as documented in [Defining contexts](https://github.com/grafana/gcx/#1-authenticate).
1. Pull the resources you want to sync from the instance to your local repository:

   ```
   gcx resources pull dashboards --path <REPO_PATH>
   ```

1. Commit and push the resources to your Git repository:

   ```
   git add <DASHBOARDS_PATH>
   git commit -m "Add dashboards from Grafana"
   git push
   ```

   Where:
   - _<GIT_REPO>_: The path to the repository synced with Git Sync
   - _<DASHBOARDS_PATH>_: The path where the dashboards you want to export are located. The dashboards path must be under the repository

After you commit the resources, continue to [Step 2](#step-2-delete-the-original-unmanaged-resources) to delete the original resources so Git Sync can adopt them.

### Add a dashboard via JSON export

To add an existing dashboard to Git Sync via JSON export, you need to:

1. Export the dashboard as JSON.
1. Convert it to the Custom Resource Definition (CRD) format required by the Grafana App Platform.
1. Commit the converted file to your Git repository.

After you commit the file, continue to [Step 2](#step-2-delete-the-original-unmanaged-resources) to delete the original resources so Git Sync can adopt them.

#### Required JSON format

To export a dashboard as a JSON file it must follow this CRD structure:

```yaml
{
  'apiVersion': 'dashboard.grafana.app/v1',
  'kind': 'Dashboard',
  'metadata': { 'name': 'dcf2lve9akj8xsd' },
  'spec': { /* Original dashboard JSON goes here */ },
}
```

The structure includes:

- `apiVersion`: Specifies the API version. Both classic and `v2` JSON models are supported. For more information, refer to [Dashboard JSON model](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/view-dashboard-json-model/).
- `kind`: Identifies the resource type. For example, dashboard.
- `metadata`: Contains the dashboard identifier `uid`. You can find the identifier in the dashboard's URL or in the exported JSON.
- `spec`: Wraps your original dashboard JSON.

## Step 2: Delete the original unmanaged resources

If you added resources using the [Grafana CLI](#add-a-dashboard-with-the-grafana-cli) or [via JSON export](#add-a-dashboard-via-json-export), the resource UID is kept, so you need to manually delete the original resource in Grafana. Git Sync will not adopt a resource while an unmanaged resource with the same UID (`metadata.name`) still exists in Grafana.

{{< admonition type="caution" >}}

Delete only the individual dashboards you're migrating. **Don't delete or recreate folders to match your repository structure if they contain alert rules, library panels, or other unsupported resources** — those resources are deleted permanently and Git Sync does not recreate them. Move any unsupported resources out of the folder before deleting it.

{{< /admonition >}}

When you delete a resource, keep in mind the following:

- You cannot restore deleted resources from the UI.
- Dashboard version history does not carry over.
- You need to reapply custom folder permissions. Refer to [Git Sync permissions and access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana) for more details.
- Git Sync does not support alerts for the moment. Deleting a folder deletes its alert rules; move them out before deleting the folder.
- Git Sync does not support library panels. Deleting a folder deletes its library panels; move them out before deleting the folder.

## Step 3: Validate the migration

1. Trigger a new pull to complete the sync. The resources are recreated as provisioned, with their original UIDs, so existing links keep working.
1. Confirm the dashboard appears in the provisioned folder and opens correctly. It may take a few minutes for changes to appear; if they don't, refresh the UI manually.
1. Confirm that any alert rules, library panels, or other resources you moved out before deleting a folder are still present and working.

After you've validated one folder, repeat the process for the next one until the migration is complete.

## Work with Git-managed dashboards

After you've saved a dashboard in Git, it'll be synchronized automatically, and you'll be able to work with it as any other provisioned resource. Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/) for more information.
