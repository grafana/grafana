---
aliases:
  - ../features/dashboard/dashboards/
  - ../panels/working-with-panels/organize-dashboard/
  - ../reference/dashboard_folders/
  - dashboard-folders/
  - dashboard-manage/
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
description: Learn about dashboard folder management and generative AI features for dashboards
weight: 8
---

# Manage dashboards

This topic includes techniques you can use to manage your Grafana dashboards, including:

- [Browsing](#browse-dashboards) and [creating](#create-a-dashboard-folder) dashboard folders
- [Folder permissions](#folder-permissions)
- [Adding generative AI features to dashboards](#set-up-generative-ai-features-for-dashboards)

For more information about creating dashboards, refer to [Build dashboards][].

## Browse dashboards

On the **Dashboards** page, you can browse and manage folders and dashboards. This includes the options to:

- Create folders and dashboards.
- Move dashboards between folders.
- Delete multiple dashboards and folders.
- Navigate to a folder.
- Manage folder permissions. For more information, refer to [Dashboard permissions][].

{{% admonition type="note" %}}
As of Grafana 10.2, there is no longer a special **General** folder. Dashboards without a folder are now shown at the top level alongside folders.
{{% /admonition %}}

## Create a dashboard folder

Folders help you organize and group dashboards, which is useful when you have many dashboards or multiple teams using the same Grafana instance.

> **Before you begin:** Ensure you have Editor permissions or greater to create folders. For more information about dashboard permissions, refer to [Dashboard permissions][].

**To create a dashboard folder:**

1. Click **Dashboards** in the primary] menu.
1. On the **Dashboards** page, click **New** and select **New folder** in the drop-down.
1. Enter a unique name and click **Create**.

When you save a dashboard, you can either select a folder for the dashboard to be saved in or create a new folder.

{{% admonition type="note" %}}
Alerts can't be placed in folders with slashes (\ /) in the name. If you wish to place alerts in the folder, don't use slashes in the folder name.
{{% /admonition %}}

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

For more information about dashboard permissions, refer to [Dashboard permissions][].

## Set up generative AI features for dashboards

{{< docs/public-preview product="Generative AI in dashboards" featureFlag="`dashgpt`" >}}

You can use generative AI to help you with the following tasks:

- **Generate panel and dashboard titles and descriptions**: Generate a title and description based on the data you’ve added for your panel or dashboard. This is useful when you want to visualize your data quickly and don’t want to spend time coming up with a title or description.
- **Generate dashboard save changes summary**: Generate a summary of the changes you’ve made to a dashboard when you save it. This is great for easily tracking the history of a dashboard.

To access these features, enable the `dashgpt` feature toggle. Then install and configure Grafana’s Large Language Model (LLM) app plugin. For more information, refer to the [Grafana LLM plugin documentation][].

When enabled, the **✨ Auto generate** option displays next to the **Title** and **Description** fields in your panels and dashboards, or when you press the **Save** button.

{{% docs/reference %}}
[Dashboard permissions]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#dashboard-permissions"
[Dashboard permissions]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#dashboard-permissions"

[Grafana LLM plugin documentation]: "/docs/grafana/ -> /docs/grafana-cloud/alerting-and-irm/machine-learning/configure/llm-plugin"
[Grafana LLM plugin documentation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/machine-learning/configure/llm-plugin"

[Build dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards"
[Build dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards"
{{% /docs/reference %}}
