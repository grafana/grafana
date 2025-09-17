---
aliases:
  - ../panels/working-with-panels/organize-dashboard/
  - ../reference/dashboard_folders/
  - dashboard-folders/
  - dashboard-manage/
canonical: https://grafana.com/docs/grafana/latest/dashboards/manage-dashboards/
keywords:
  - grafana
  - dashboard
  - dashboard folders
  - folder
  - folders
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Manage dashboards
title: Manage dashboards
description: Learn about dashboard management and generative AI features for dashboards
weight: 300
refs:
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/
  dashboard-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#dashboard-permissions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#dashboard-permissions
  grafana-llm-plugin-documentation:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/alerting-and-irm/machine-learning/configure/llm-plugin/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/machine-learning/configure/llm-plugin/
---

# Manage dashboards

On the **Dashboards** page, you can perform dashboard management tasks such as:

- [Browsing](#browse-dashboards) and [creating](#create-a-dashboard-folder) dashboard folders
- [Managing folder permissions](#folder-permissions)
- [Adding generative AI features to dashboards](#set-up-generative-ai-features-for-dashboards)

For more information about creating dashboards, refer to [Build dashboards](ref:build-dashboards).

## Browse dashboards

On the **Dashboards** page, you can browse and manage folders and dashboards. This includes the options to:

- Create folders and dashboards.
- Move dashboards between folders.
- Delete multiple dashboards and folders.
- Navigate to a folder.
- Manage folder permissions. For more information, refer to [Dashboard permissions](ref:dashboard-permissions).

The page lists all the dashboards to which you have access, grouped into folders. Dashboards without a folder are displayed at the top level alongside folders.

### Shared with me

The **Shared with me** section displays folders and dashboards that are directly shared with you. These folders and dashboards aren't shown in the main list because you don't have access to one or more of their parent folders.

If you have permission to view all folders, you won't see a **Shared with me**.

## Create a dashboard folder

Folders help you organize and group dashboards, which is useful when you have many dashboards or multiple teams using the same Grafana instance.

> **Before you begin:** Ensure you have organization Editor permissions or greater to create root level folders or Edit or Admin access to a parent folder to create subfolders. For more information about dashboard permissions, refer to [Dashboard permissions](ref:dashboard-permissions).

**To create a dashboard folder:**

1. Click **Dashboards** in the primary menu.
1. Do one of the following:
   - On the **Dashboards** page, click **New** and select **New folder** in the drop-down.
   - Click an existing folder and on the folder’s page, click **New** and select **New folder** in the drop-down.

1. Enter a unique name.

   Folder names can't include underscores (\_) or percentage signs (%), as it interferes with the search functionality.

   Also, alerts can't be placed in folders with slashes (\ /) in the name. If you want to place alerts in the folder, don't use slashes in the folder name.

1. Click **Create**

When you nest folders, you can do so up to four levels deep.

When you save a dashboard, you can optionally select a folder to save the dashboard in.

**To edit the name of a folder:**

1. Click **Dashboards** in the primary menu.
1. Navigate to the folder by selecting it in the list, or searching for it.
1. Click the **Edit title** icon (pencil) in the header and update the name of the folder.

The new folder name is automatically saved.

### Folder permissions

You can assign permissions to a folder. Dashboards in the folder inherit any permissions that you've assigned to the folder. You can assign permissions to organization roles, teams, and users.

**To modify permissions for a folder:**

1. Click **Dashboards** in the primary menu.
1. Navigate to the folder by selecting it in the list, or searching for it.
1. On the folder's page, click **Folder actions** and select **Manage permissions** in the drop-down.
1. Update the permissions as desired.

Changes are saved automatically.

For more information about dashboard permissions, refer to [Dashboard permissions](ref:dashboard-permissions).

## Set up generative AI features for dashboards

You can use generative AI to help you with the following tasks:

- **Generate panel and dashboard titles and descriptions**: Generate a title and description based on the data you’ve added for your panel or dashboard. This is useful when you want to visualize your data quickly and don’t want to spend time coming up with a title or description.
- **Generate dashboard save changes summary**: Generate a summary of the changes you’ve made to a dashboard when you save it. This is great for easily tracking the history of a dashboard.

To access these features, install and configure Grafana’s Large Language Model (LLM) app plugin. For more information, refer to the [Grafana LLM plugin documentation](ref:grafana-llm-plugin-documentation).

When enabled, the **✨ Auto generate** option displays next to the **Title** and **Description** fields in your panels and dashboards, or when you press the **Save** button.
