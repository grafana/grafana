---
keywords:
  - variables
  - cross-dashboard
  - standard
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Cross-dashboard variables
description: Add variables that can you can use across dashboards, globally or by folder.
weight: 150
---

{{< docs/public-preview product="Cross-dashboard variables" featureFlag="`grafana.dashboardGlobalVariables`" >}}

Unlike variables that are specific to the dashboard in which you build them, you can create _cross-dashboard variables_ for use across multiple dashboards.
These variables help ensure consistent naming across your organization and eliminate the need to re-create the same variables every time you add a new dashboard.

You can scope cross-dashboard variables in two ways:

- **Globally**: Available to all dashboards in the organization.
- **By folder**: Available only to the dashboards in the same folder as the variable.

The **Dashboards > Cross-dashboard variables** page lists cross-dashboard variables, showing which ones are available globally or by folder.
In the following image, there are variables in "Core metrics" and "Grafana Cloud" folders and then a number of variables that aren't in any folders; these ones are global:

![Cross-dashboard variables page](/media/docs/grafana/dashboards/screenshot-x-dash-variables-v13.3.png)

When you add cross-dashboard variables to a dashboard, only the ones that share the same scope as your dashboard are available for you to select.

For example, in the preceding image, there was a variable in the "Core metrics" folder.
The following image shows a dashboard in the "Core metrics" folder.
As a result, the variable in the "Core metrics" folder is available to that dashboard, as well as all the global variables:

![Available cross-dashboard variables in dashboard sidebar](/media/docs/grafana/dashboards/screenshot-xdash-variables-sidebar-v13.3.png)

Variables in other folders aren't available to that dashboard.

## Create cross-dashboard variables

To create cross-dashboard variables, follow the these steps:

1. Navigate to **Dashboards > Cross-dashboard variables**.
1. Click **+ New variable**.
1. Set the following general variable properties:

   | Option        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
   | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Folder        | Set the availability of the variable. To allow the variable to be used in all of the organization's dashboards, select **Dashboards**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
   | Variable type | Choose a variable type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
   | Name          | Enter a name for the variable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
   | Label         | (Optional) Enter the display name for the variable drop-down list. If you leave this empty, then the variable name is used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
   | Description   | <p>(Optional) Enter a description of the variable. When you add a description, an info icon appears next to the variable name on the dashboard. Hover your cursor over the icon to display the description.</p><p>Descriptions support links. You can use Markdown-style links like `[link text](https://example.com)`, or paste bare URLs like `https://example.com`. Only `http` and `https` URLs render as clickable links—other protocols display as plain text.</p>                                                                                                                                                     |
   | Display       | Choose where the variable displays:<ul><li>**Above dashboard**: The variable drop-down list displays above the dashboard with the variable **Name** or **Label** value. This is the default.</li><li>**Above dashboard, label hidden**: The variable drop-down list displays above the dashboard, but without showing the name of the variable.</li><li>**Controls menu**: The variable displays in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.</li><li>**Hidden**: No variable drop-down list displays on the dashboard.</li><ul> |

1. Click one of the following links to complete the steps for adding your selected variable type:
   - [Query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-query-variable)
   - [Custom](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-custom-variable)
   - [Textbox](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-text-box-variable)
   - [Constant](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-constant-variable)
   - [Data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-data-source-variable)
   - [Interval](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-an-interval-variable)
   - [Switch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-switch-variable)

## Add cross-dashboard variables to a dashboard

You can choose which cross-dashboard variables to add dashboards you create.
Only variables that share the same scope as your dashboard are available for you to select.

To add cross-dashboard variables to a dashboard, follow these steps:

1. Navigate to the dashboard you want to use the variables in or create a new dashboard.
1. Click **Edit**.
1. Click the cross-dashboard variables icon in the sidebar:

   ![Add cross-dashboard variables icon](/media/docs/grafana/dashboards/screenshot-xdash-variables-icon-v13.3.png)

1. Select the variables you want to add to the dashboard:

   ![Cross-dashboard variable selected and added above dashboard](/media/docs/grafana/dashboards/screenshot-xdash-variable-selected-v13.3.png)

   To add every global variable available, select **All global** and to add every folder variable available, select **All folder**.

1. Update variable values as needed.
1. Click **Save**.
1. Enter an optional description of your changes and click **Save**.
1. Click **Exit edit**.

You can't edit the settings of these variables on the dashboard like other variables.
You can only update their values or remove them from the dashboard in the **Cross-dashboard variables** section of the sidebar.
