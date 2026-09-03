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

There are two different things you might want to do with existing, non-provisioned resources, and they behave differently:

- [Cherry-pick individual dashboards](#cherry-pick-individual-dashboards): Add a copy of a selected dashboard to a provisioned folder. Grafana creates a **new** dashboard with a **new UID**; the original is left untouched and existing links keep pointing to it. This is the simplest option and doesn't require deleting anything.
- [Migrate existing dashboards](#migrate-existing-dashboards-to-git-sync): Move existing dashboards under Git Sync while **keeping their UID**, so existing links and references keep working. This option requires additional care since it adopts the resource in place and requires deleting the original resource.

{{< admonition type="note" >}}

Git Sync only manages dashboards and folders. Alerts, data sources, and library panels are **not** supported yet. Keep this in mind when migrating. Refer to [Before you begin](#before-you-begin) for details.

{{< /admonition >}}

## Cherry-pick individual dashboards

Use these methods to add a copy of one or more dashboards to a provisioned folder. Each copy is created with a new UID, so the original dashboards stay exactly as they are and nothing needs to be deleted. Existing links continue to point to the original dashboards, not the copies.

- [Add a dashboard using Import dashboards](#add-a-dashboard-using-import-dashboards)
- [Copy an existing dashboard from the Grafana UI](#copy-an-existing-dashboard-from-the-grafana-ui)

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

- Importing an ordinary dashboard JSON creates a new dashboard with a new UID. To preserve the original UID instead (for a migration), provide a UID in the wizard or import a resource file that already sets `metadata.name`. Refer to [Migrate existing dashboards](#migrate-existing-dashboards-to-git-sync).
- UIDs are globally unique per org. Two repositories with dashboards sharing a UID will conflict.
- Two dashboards can share a title as long as they live at different paths in the repository. If a file with the same name already exists at the target path, the import is stopped before it overwrites anything.

For more information refer to [Import dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/import-dashboards/) in the Data Visualization documentation.

{{< admonition type="note" >}}

It may take a few minutes for your changes to reflect on your screen. If they don't, refresh the UI manually.

{{< /admonition >}}

### Copy an existing dashboard from the Grafana UI

You can also save a copy of dashboard directly from the Grafana UI to your provisioned folder. This creates a new dashboard with a new UID and leaves the original in place.

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

## Migrate existing dashboards to Git Sync

The migrating option moves your existing dashboards under Git Sync while keeping their UIDs, so existing links, references, and bookmarks keep working. Because the UID is preserved, Git Sync adopts the resource in place, and you must delete the original resource so Git Sync can take over its UID.

The migration follows these steps:

1. [Before you begin](#before-you-begin): Back up your instance and understand what Git Sync manages.
1. [Step 1: Export the resources to your repository](#step-1-export-the-resources-to-your-repository): Export with UIDs preserved and commit.
1. [Step 2: Delete the original dashboards](#step-2-delete-the-original-dashboards): Required so Git Sync can adopt each dashboard by UID.
1. [Step 3: Validate the migration](#step-3-validate-the-migration): Confirm the resources are synced before moving on.

### Before you begin

Git Sync only manages dashboards and folders. Alerts, data sources, library panels, and other resources are **not** supported yet, and Git Sync will not recreate them. Because migrating involves deleting resources, plan carefully before you start.

Git Sync creates its own folders when it syncs with your existing repository. It derives each folder's UID from the folder's **path in the repository**, so the folders it creates are **new folders**, independent from your existing ones, even if they share the same name. As a result:

- You **don't** need to delete your original folders to migrate the dashboards inside them.
- **Do not** delete a folder that contains alerts or library panels. Git Sync doesn't manage those, and deleting the folder deletes them permanently.

{{< admonition type="caution" >}}

**Deleting a folder deletes everything it contains, including unsupported resources such as alert rules and library panels.** Git Sync recreates dashboards and folders, but it does not recreate alerts or library panels. Deleting or recreating a folder to match your repository structure permanently deletes any alert rules and library panels it holds, and they are not restored.

With a folder or folderless sync, only delete the individual dashboards you're migrating, never the folders. Full-instance migrations have different cleanup behavior and can delete unmanaged folders, so follow the full-instance migration guidance instead.

{{< /admonition >}}

To migrate safely, keep in mind the following:

- **Back up your instance first.** Export or snapshot your dashboards, folders, alert rules, and library panels before you delete anything. Deleted resources can't be restored from the Grafana UI.
- **Migrate folder by folder.** Start with a single folder, complete the full migration for it, and validate the result before moving to the next one. This limits the impact if something goes wrong and lets you get comfortable with the process.
- **Keep your original folders, and set them apart.** After a migration you'll have your original folder (holding any alerts and library panels) alongside the new Git Sync folder of the same name. To avoid confusion, rename your original folders or move them under a single top-level **Alerts & Library Panels** folder. This keeps the unsupported resources intact and clearly separated from the provisioned dashboards. If you instead need links to your original folders to keep working, refer to [Preserve links to the original folders](#preserve-links-to-the-original-folders).

### Step 1: Export the resources to your repository

Export the dashboards you want to migrate so that each file keeps the dashboard's original UID (`metadata.name`), then commit the files to your Git repository. You can use either of the following:

- [Export with the Grafana CLI](#export-with-the-grafana-cli)
- [Export as a JSON resource file](#export-as-a-json-resource-file)

#### Export with the Grafana CLI

You can export existing dashboards from the terminal or from agentic coding tools using the CLI `gcx`. With `gcx` you can download the resources you want to sync from Grafana, and then commit and push those files to your provisioned Git repository. Git Sync will then detect the commit, and synchronize with Grafana.

{{< admonition type="note" >}}

For more information refer to the [`gcx` documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/gcx/).

{{< /admonition >}}

To export dashboards with `gcx`, follow these steps:

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

After you commit the resources, continue to [Step 2](#step-2-delete-the-original-dashboards).

#### Export as a JSON resource file

To export a dashboard as a JSON resource file, you need to:

1. Export the dashboard as JSON.
1. Convert it to the Custom Resource Definition (CRD) format required by the Grafana App Platform.
1. Commit the converted file to your Git repository.

After you commit the file, continue to [Step 2](#step-2-delete-the-original-dashboards).

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
- `metadata`: Contains the dashboard identifier `name`, which must match the original dashboard UID so Git Sync can adopt it. You can find the identifier in the dashboard's URL or in the exported JSON.
- `spec`: Wraps your original dashboard JSON.

### Step 2: Delete the original dashboards

Because the exported files keep the original UID, Git Sync will not adopt a dashboard while an unmanaged dashboard with the same UID (`metadata.name`) still exists in Grafana. Delete each original dashboard you're migrating so Git Sync can take over its UID.

{{< admonition type="caution" >}}

Delete only the individual dashboards you're migrating. Folders don't need to be deleted, as Git Sync creates its own folders with new, path-derived UIDs. **Don't delete or recreate folders that contain alert rules or library panels**, since those resources are deleted permanently and Git Sync does not recreate them. See [Before you begin](#before-you-begin) for how to keep and set apart your original folders.

{{< /admonition >}}

When you delete a dashboard, keep in mind the following:

- You cannot restore deleted resources from the UI.
- Dashboard version history does not carry over.
- You need to reapply custom folder permissions. Refer to [Git Sync permissions and access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana) for more details.

### Step 3: Validate the migration

1. Trigger a new pull to complete the sync. The dashboards are recreated as provisioned, with their original UIDs, so existing links keep working.
1. Confirm each dashboard appears in the provisioned folder and opens correctly. It may take a few minutes for changes to appear; if they don't, refresh the UI manually.
1. Confirm that the alert rules and library panels in your original folders are still present and working.

After you've validated one folder, repeat the process for the next one until the migration is complete.

### Preserve links to the original folders

By default, Git Sync gives each synced folder a new UID derived from its path in the repository. This means links and URLs that point to your original folders keep pointing to the original folders, not the new provisioned ones.

If you need existing folder links and URLs to resolve to the provisioned folders instead, you can pin a folder's UID with a folder metadata file so Git Sync reuses the original folder's UID.

{{< admonition type="note" >}}

Folder metadata requires the `provisioningFolderMetadata` feature, which is enabled by default. If your administrator has disabled it, `metadata.name` is ignored and folders always get a path-derived UID.

{{< /admonition >}}

To reuse an original folder's UID, add a `_folder.json` file to that folder's directory in the repository:

```json
{
  "apiVersion": "folder.grafana.app/v1beta1",
  "kind": "Folder",
  "metadata": { "name": "<ORIGINAL_FOLDER_UID>" },
  "spec": { "title": "<FOLDER_TITLE>" }
}
```

Where `<ORIGINAL_FOLDER_UID>` is the UID of your existing folder. You can find it in the folder's URL.

Because this option reuses the original folder's UID, the synced folder collides with your existing unmanaged folder, and Git Sync can't take over a UID that still belongs to an unmanaged folder, with the sync failing with a conflict. To avoid losing unsupported resources, complete these steps for each folder **before** you sync:

1. Create a new folder and move all alert rules, library panels, and other unsupported resources out of the original folder into it.
1. Delete the original folder. Its dashboards should already be exported to the repository from [Step 1](#step-1-export-the-resources-to-your-repository).
1. Reapply any custom permissions on the new provisioned folder — folder permissions don't carry over. Refer to [Git Sync permissions and access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana).

{{< admonition type="caution" >}}

Move alert rules and library panels out of the folder **before** you delete it. Deleting a folder deletes everything it contains, and Git Sync does not recreate alerts or library panels.

{{< /admonition >}}

## Work with Git-managed dashboards

After you've saved a dashboard in Git, it'll be synchronized automatically, and you'll be able to work with it as any other provisioned resource. Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/) for more information.
