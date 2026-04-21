---
description: Learn how to create, assign, and find team folders in Grafana.
labels:
  products:
    - cloud
    - enterprise
    - oss
keywords:
  - dashboards
  - folders
  - team folders
  - teams
menuTitle: Team folders
title: Manage team folders
weight: 350
---

# Manage team folders

![Folder detail page showing a team folder.](/media/whats-new/team-folders/0-Team-Folders-Overview.png)

Team folders help you associate folders with teams so admins and team members can find the right dashboards, library panels, and alert rules faster. They streamline setup by letting admins create and assign a dedicated folder when creating a team, establishing clear ownership from the start. A team folder is still a regular folder—the team association adds ownership metadata and team-aware navigation, but it doesn’t change or replace folder permission.

Team folders is in public preview.

Before you begin, ensure you have the following:

- The `teamFolders` and `foldersAppPlatformAPI` feature toggle enabled.
- Permission to create root-level folders, or permission to create subfolders in the parent folder you want to use.
- Permission to manage folder permissions and read teams if you want to assign or change a folder owner in the UI.

## Enable team folders

To enable team folders in Grafana OSS or Grafana Enterprise, the `teamFolders` and `foldersAppPlatformAPI` feature toggle must be enabled.

For more information about feature toggles, refer to [Configure feature toggles](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).

## Create a team folder when you create a team

When team folders are enabled, the **New team** page includes an option to create a team folder automatically.

To create a team and its folder, complete the following steps:

1. Open **Administration** and go to **Users and access** > **Teams**.
1. Click **New team**.
1. Enter the team details.
1. Under **Team folder**, select **Auto-create a team folder**.
1. Click **Create**.

Grafana creates a folder with the same name as the team and assigns that team as the folder owner. After the folder is created, review the folder permissions and update them if needed.

![New team page with the Team folder section visible and Auto-create a team folder selected.](/media/whats-new/team-folders/2-new-team-detail.png)

For more information about creating teams, refer to [Configure Grafana Teams](/docs/grafana/<GRAFANA_VERSION>/administration/team-management/configure-grafana-teams/).

## Create or assign a team folder from Dashboards

You can create a new folder for a team or assign ownership to an existing folder.

### Create a new team folder

To create a new team folder, complete the following steps:

1. Click **Dashboards** in the primary menu.
1. Click **New** and select **New folder**.
1. Enter a unique folder name.
1. Select **Assign an owner to the folder**.
1. In **Team** dropdown, select the team that should own the folder.
1. Click **Create**.

Grafana creates a regular folder and stores the selected team as the folder owner.

![New folder drawer with Assign an owner to the folder enabled and a team selected in the Team field.](/media/whats-new/team-folders/3-New-Folder-for-Team.png)

### Assign or change the owner of an existing folder

To assign or change the owner of an existing folder, complete the following steps:

1. Click **Dashboards** in the primary menu.
1. Open the folder that you want to update.
1. Click **Folder actions** and select **Manage folder owner**.
1. Select a team, or clear the current value if you want to remove the owner.
1. Click **Save owner**.

If a folder has a team owner, Grafana displays an **Owned by** label in the folder header.

![Folder page header showing the Owned by label and the Manage folder owner modal open from Folder actions.](/media/whats-new/team-folders/4-Manage-Owner-Folder.png)

## Find team folders

When team folders are enabled, Grafana surfaces them in the browse dashboards page and in team details.

### Browse dashboards

The **Dashboards** page displays a **My team folders** section near the top when you belong to teams that own folders. Expand that section to open the folders owned by your teams.

![Dashboards page with the My team folders section expanded and two team-owned folders listed.](/media/whats-new/team-folders/5-Find-you-team-folders.png)

### Save or move dashboards

When you are saving or moving dashboard the folder picker shows a **Team folders** section at the top of the folder tree. Your first teams folder will be preselected by default.

![Folder picker in a save or move flow with Team folders shown at the top of the tree and one team folder selected.](/media/whats-new/team-folders/6-Save-dashboard.png)

### Review folders owned by a team

Each team page includes a **Folders** tab that lists all the folders owned by that team.

![Team details page on the Folders tab showing the owned folders table with Name and Full path columns.](/media/whats-new/team-folders/8-Team-Folders---list-view-in-Team.png)

## Manage access for team folders

Folder ownership does not replace folder permissions. Team folders use the same permission model as any other folder.

If team members need access to the folder, configure folder permissions for the team or for the users, roles, or service accounts that should use it. For more information, refer to [Manage dashboard permissions](/docs/grafana/<GRAFANA_VERSION>/administration/user-management/manage-dashboard-permissions/).

## Limitations

Team folders currently have the following limitations:

- You can select only one team owner per folder.
- You can't assign or change a team owner for repository-managed folders.

## Next steps

- Refer to [Manage dashboards](/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/) for the rest of the dashboards management workflow.
- Refer to [Manage dashboard permissions](/docs/grafana/<GRAFANA_VERSION>/administration/user-management/manage-dashboard-permissions/) to control access to team folders.
