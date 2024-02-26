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
---

# Configure panel options

There are panel options common to all visualizations, such as a title and description.

## Panel options

Set the following options to provide basic information about a panel and define basic display elements.

- **Title** - Text entered in this field appears at the top of your panel in the panel editor and in the dashboard. You can use [variables you have defined][] in the **Title** field, but not [global variables][].
- **Description** - Text entered in this field appears in a tooltip in the upper-left corner of the panel. Add a description to a panel to share with users any important information about the visualization, such as its purpose. You can use [variables you have defined][] in the **Description** field, but not [global variables][].
- **Transparent background** - Toggle this switch on and off to control whether or not the panel has as background color different from the dashboard.
- **Panel links** - Add [links to the panel][] to create shortcuts to other dashboards, panels, and even external websites. Access panel links by clicking the icon next to the panel title.
- **Repeat options** - Set whether to repeat the panel for each value in the selected variable. For more information, refer to [Configure repeating panels](#configure-repeating-panels).

You can use generative AI to create panel titles and descriptions with the [Grafana LLM plugin][], which is currently in public preview. To enable this, refer to the [Set up generative AI features for dashboards documentation][]. Alternatively, you can take the following steps to create them yourself.

## Configure repeating panels

You can configure Grafana to dynamically add panels or rows to a dashboard. A dynamic panel is a panel that the system creates based on the value of a variable. Variables dynamically change your queries across all panels in a dashboard. For more information about repeating rows, refer to [Configure repeating rows][].

To see an example of repeating panels, refer to [this dashboard with repeating panels](https://play.grafana.org/d/testdata-repeating/testdata-repeating-panels?orgId=1).

{{% admonition type="note" %}}
Repeating panels require variables to have one or more items selected; you can't repeat a panel zero times to hide it.
{{% /admonition %}}

<!-- what does this note mean exactly-->

**Before you begin:**

- Ensure that the query includes a multi-value variable.

<!--figure out how to format the above so it doesn't look like the whole task is a before you begin -->

To configure repeating panels, follow these steps:

1. Navigate to the panel you want to update.
1. Hover over any part of the panel you want to work on to display the menu on the top right corner.
1. Click the menu and select **Edit**.
1. Open the **Panel options** section of the panel editor pane.
1. Under **Repeat options**, select a variable in the drop-down list.
1. Under **Repeat direction**, choose one of the following:

   - **Horizontal** - Arrange panels side-by-side. Grafana adjusts the width of a repeated panel. Currently, you can't mix other panels on a row with a repeated panel.
   - **Vertical** - Arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

1. If you selected **Horizontal** in the previous step, select a value in the **Max per row** drop-down list to control the maximum number of panels that can be in a row.
1. Click **Save**.
1. To propagate changes to all panels, reload the dashboard.

{{% docs/reference %}}
[variables you have defined]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables"
[variables you have defined]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables"

[global variables]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables#global-variables"
[global variables]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables#global-variables"

[Configure repeating rows]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/create-dashboard#configure-repeating-rows"
[Configure repeating rows]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/create-dashboard#configure-repeating-rows"

[Grafana LLM plugin]: "/docs/grafana/ -> /docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin"
[Grafana LLM plugin]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin"

[Set up generative AI features for dashboards documentation]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/manage-dashboards#set-up-generative-ai-features-for-dashboards"
[Set up generative AI features for dashboards documentation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/manage-dashboards#set-up-generative-ai-features-for-dashboards"

[links to the panel]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links#panel-links"
[links to the panel]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-dashboard-links#panel-links"
{{% /docs/reference %}}
