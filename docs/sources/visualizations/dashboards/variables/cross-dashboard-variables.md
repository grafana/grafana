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
description: Add variables that can you can use across dashboards, globally or per folder.
weight: 250
---

In addition to adding variables to specific dashboards, you can create _cross-dashboard variables_ that can be used across multiple dashboards, either globally or per folder.
This ensures that you're use of variables across your organization is consistent and removes the necessity of creating the same variable over and over.

Cross-dashboard variables are listed per folder on the Variables page:

<!-- TODO: screenshot here -->

## How are these applied??

Are they automagically added to new dashboards upon creation?

## Add cross-dashboard variables

To add cross-dashboard variables, follow the these steps:

1. Navigate to Dashboards > Variables.
1. Click + New variable.
1. Set the following properties:

   | Option | Description |
   | ------ | ----------- |
   | Folder | Set the scope of the variable. To allow the variable to be used in all of the organization's dashboards, select Dashboards. |
   | Variable type | Choose a variable type. |
   | Name | Enter a name for the variable. |
   | Label | (Optional) Enter the display name for the variable drop-down list. If you leave this empty, then the variable name is used. |
   | Description | <p>(Optional) Enter a description of the variable. When you add a description, an info icon appears next to the variable name on the dashboard. Hover your cursor over the icon to display the description.</p><p>Descriptions support links. You can use Markdown-style links (`[link text](https://example.com)`) or paste bare URLs (`https://example.com`). Only `http` and `https` URLs are rendered as clickable links—other protocols are displayed as plain text.</p> |
   | Display | Choose where the variable is displayed:<ul><li>**Above dashboard** - The variable drop-down list displays above the dashboard with the variable **Name** or **Label** value. This is the default.</li><li>**Above dashboard, label hidden** - The variable drop-down list displays above the dashboard, but without showing the name of the variable.</li><li>**Controls menu** - The variable is displayed in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.</li><li>**Hidden** - No variable drop-down list is displayed on the dashboard.</li><ul> |

1. Click one of the following links to complete the steps for adding your selected variable type:
   - [Query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-query-variable)
   - [Custom](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-custom-variable)
   - [Textbox](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-text-box-variable)
   - [Constant](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-constant-variable)
   - [Data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-data-source-variable)
   - [Interval](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-an-interval-variable)
   - [Switch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-a-switch-variable)  
