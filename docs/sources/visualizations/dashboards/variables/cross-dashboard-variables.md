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
description: Add variables that you can use across dashboards, globally or by folder.
weight: 150
---

# Cross-dashboard variables

{{< docs/public-preview product="Cross-dashboard variables" featureFlag="`grafana.dashboardGlobalVariables`" >}}

Unlike variables that are specific to the dashboard in which you build them, you can create _cross-dashboard variables_ for use across multiple dashboards.
These variables help ensure consistent naming across your organization and eliminate the need to re-create the same variables every time you add a new dashboard.

You can scope cross-dashboard variables in two ways:

- **Globally**: Available to all dashboards in the organization.
- **By folder**: Available only to the dashboards in the same folder as the variable.

The **Dashboards > Variables** page lists cross-dashboard variables, showing which ones are available globally or by folder.
In the following image, there are variables in "Core metrics" and "Grafana Cloud" folders and then a number of variables that aren't in any folders; these ones are global:

![Cross-dashboard variables page](/media/docs/grafana/dashboards/screenshot-cross-dash-variables-v13.3.png)

When you add cross-dashboard variables to a dashboard, only the ones that share the same scope as your dashboard are available for you to select.

For example, in the preceding image, there are two variables in the "Core metrics" folder.
The following image shows a dashboard in the "Core metrics" folder.
As a result, the variables in the "Core metrics" folder are available to that dashboard, as well as all the global variables:

![Available cross-dashboard variables in dashboard sidebar](/media/docs/grafana/dashboards/screenshot-cross-dash-variables-sidebar-v13.3.1.png)

Variables in other folders aren't available to that dashboard.

## Create cross-dashboard variables

<!-- prettier-ignore-start -->

To create cross-dashboard variables, follow these steps:

1. Navigate to **Dashboards > Variables**.
1. Click **+ New variable**.
1. Set the following general variable properties:

   | Option        | Description                                                                                                                            |
   | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | Folder        | Set the availability of the variable. To allow the variable to be used in all of the organization's dashboards, select **Dashboards**. |
   | Variable type | Choose a variable type.                                                                                                                |
   | Name          | Enter a name for the variable.                                                                                                         |
   | Label         | (Optional) Enter the display name for the variable drop-down list. If you leave this empty, then the variable name is used.            |
   | Description   | <p>(Optional) Enter a description of the variable. When you add a description, an info icon appears next to the variable name on the dashboard. Hover your cursor over the icon to display the description.</p><p>Descriptions support links. You can use Markdown-style links like `[link text](https://example.com)`, or paste bare URLs like `https://example.com`. Only `http` and `https` URLs render as clickable links—other protocols display as plain text.</p>  |
   | Display       | Choose where the variable displays:<ul><li>**Above dashboard**: The variable drop-down list displays above the dashboard with the variable **Name** or **Label** value. This is the default.</li><li>**Above dashboard, label hidden**: The variable drop-down list displays above the dashboard, but without showing the name of the variable.</li><li>**Controls menu**: The variable displays in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.</li><li>**Hidden**: No variable drop-down list displays on the dashboard.</li></ul>           |

1. Click one of the following links to complete the steps for adding your selected variable type:
   - [Query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-query-variable)
   - [Custom](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-custom-variable)
   - [Textbox](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-text-box-variable)
   - [Constant](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-constant-variable)
   - [Data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-data-source-variable)
   - [Interval](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-an-interval-variable)
   - [Switch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-switch-variable)

<!-- prettier-ignore-end -->

## Add cross-dashboard variables to a dashboard

You can choose which cross-dashboard variables to add to dashboards you create.
Only variables that share the same scope as your dashboard are available for you to select.

To add cross-dashboard variables to a dashboard, follow these steps:

1. Navigate to the dashboard you want to update.
1. Select **Editing** in the dashboard mode drop-down list.
1. Click the **Add new element** icon in the sidebar and select **Variable**.

   You can also click the **Add** (plus sign) icon at the top of the dashboard and select **Variable**.

1. Select the **Global or folder variable** variable type.
1. Select the variables you want to add to the dashboard:

   ![Cross-dashboard variable selected and added above dashboard](/media/docs/grafana/dashboards/screenshot-cross-dash-variable-selected-v13.3.1.png)

   To add every global variable available, select **All global** and to add every folder variable available, select **All folder**.

1. Update variable values as needed.
1. Click **Save**.
1. Enter an optional description of your changes and click **Save**.
1. Select **Viewing** in the dashboard mode drop-down list.

After you've added cross-dashboard variables to a dashboard, you can view its settings or remove it by way of the dashboard sidebar.
To edit the variable, go to **Dashboards > Variables**.

## Find and promote shared variables

Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](https://grafana.com/docs/grafana-cloud/).

If you already have many dashboards, the same variable is often defined separately in each one.
The shared variables tool scans your dashboards, finds variables that are defined identically in more than one dashboard, and recommends promoting them to cross-dashboard variables.
When you promote a variable, the tool creates a cross-dashboard variable and updates the selected dashboards to reference it instead of their own copies.

The tool remains useful after your initial migration.
As people create new dashboards or copy variables between them, run the tool again to find new duplicates.

Before you begin, ensure you have the following:

- The Admin role.
- Cross-dashboard variables enabled with the `grafana.dashboardGlobalVariables` feature flag.

### How the tool groups variables

The tool groups dashboard variables only when they match exactly, not when they're similar.
For variables to be grouped, they must have the same name and the same definition.
For query variables, the query must be identical, including any static options defined with it.

The tool lists the 50 groups with the most impact, such as variables used in the largest number of dashboards.

### Promote shared variables

<!-- prettier-ignore-start -->

To find and promote shared variables, follow these steps:

1. Navigate to **Dashboards > Variables**.
1. Click **Find shared variables**.

   The tool scans every dashboard in your organization. On instances with many dashboards, the scan can take a few minutes.

1. Review the recommended groups.
1. For the group you want to promote, choose where to create the cross-dashboard variable:
   - **Globally**: Available to all dashboards in the organization.
   - **In a folder**: Available only to the dashboards in that folder.
1. Select the dashboards that you want to update.
1. Promote the variable.

<!-- prettier-ignore-end -->

If a matching cross-dashboard variable already exists, the tool doesn't create a duplicate.
Instead, it updates the remaining dashboards to reference the existing variable, and the group shows as partly promoted until all of its dashboards reference it.

By default, the tool skips the following dashboards:

- **Read-only dashboards:** Dashboards with the **Editable** setting set to **Read-only** in the dashboard settings.
- **Provisioned dashboards:** Dashboards managed by provisioning.

### Revert a promotion

Promoting a variable saves a new version of each updated dashboard.
If a dashboard doesn't behave as expected after a promotion, restore its previous version from the dashboard version history.
For more information, refer to [Manage dashboard version history](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-version-history/).
