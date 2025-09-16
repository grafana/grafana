---
aliases:
  - ../panels/add-panels-dynamically/
  - ../panels/configure-panel-options/
  - ../panels/repeat-panels-or-rows/
  - ../panels/working-with-panels/add-title-and-description/
  - ../panels/working-with-panels/view-json-model/
keywords:
  - panel
  - dynamic
  - add
  - title
  - description
  - JSON model
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure panel options
title: Configure panel options
description: Add titles, descriptions, repeating rows and panel links
weight: 50
refs:
  global-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#global-variables
  links-to-the-panel:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links/#panel-links
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-dashboard-links/#panel-links
  configure-repeating-rows:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows
  set-up-generative-ai-features-for-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
  variables-you-have-defined:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  grafana-llm-plugin:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/alerting-and-irm/machine-learning/configure/llm-plugin/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/machine-learning/configure/llm-plugin/
---

# Configure panel options

There are settings common to all visualizations, which you set in the **Panel options** section of the panel editor pane. The following sections describe these options as well as how to set them.

## Panel options

Set the following options to provide basic information about a panel and define basic display elements:

| Option                 | Description                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                  | Text entered in this field appears at the top of your panel in the panel editor and in the dashboard. You can use [variables you have defined](ref:variables-you-have-defined) in the **Title** field, but not [global variables](ref:global-variables).                                                                                                  |
| Description            | Text entered in this field appears in a tooltip in the upper-left corner of the panel. Add a description to a panel to share with users any important information about it, such as its purpose. You can use [variables you have defined](ref:variables-you-have-defined) in the **Description** field, but not [global variables](ref:global-variables). |
| Transparent background | Toggle this switch on and off to control whether or not the panel has the same background color as the dashboard.                                                                                                                                                                                                                                         |
| Panel links            | Add [links to the panel](ref:links-to-the-panel) to create shortcuts to other dashboards, panels, and external websites. Access panel links by clicking the icon next to the panel title.                                                                                                                                                                 |
| Repeat options         | Set whether to repeat the panel for each value in the selected variable. For more information, refer to [Configure repeating panels](#configure-repeating-panels).                                                                                                                                                                                        |

You can use generative AI to populate the **Title** and **Description** fields with the [Grafana LLM plugin](ref:grafana-llm-plugin), which is currently in public preview. To enable this, refer to [Set up generative AI features for dashboards](ref:set-up-generative-ai-features-for-dashboards).

## Configure repeating panels

You can configure Grafana to dynamically add panels or rows to a dashboard. A dynamic panel is a panel that the system creates based on the value of a variable. Variables dynamically change your queries across all panels in a dashboard. For more information about repeating rows, refer to [Configure repeating rows](ref:configure-repeating-rows).

To see an example of repeating panels, refer to [this dashboard with repeating panels](https://play.grafana.org/d/testdata-repeating/testdata-repeating-panels?orgId=1).

**Before you begin:**

- Ensure that the query includes a multi-value variable.

To configure repeating panels, follow these steps:

1. Navigate to the panel you want to update.
1. Hover over any part of the panel to display the menu on the top right corner.
1. Click the menu and select **Edit**.
1. Open the **Panel options** section of the panel editor pane.
1. Under **Repeat options**, select a variable in the **Repeat by variable** drop-down list.
1. Under **Repeat direction**, choose one of the following:
   - **Horizontal** - Arrange panels side-by-side. Grafana adjusts the width of a repeated panel. You can't mix other panels on a row with a repeated panel.
   - **Vertical** - Arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

1. If you selected **Horizontal** in the previous step, select a value in the **Max per row** drop-down list to control the maximum number of panels that can be in a row.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.
1. To propagate changes to all panels, reload the dashboard.

You can stop a panel from repeating by selecting **Disable repeating** in the **Repeat by variable** drop-down list.
