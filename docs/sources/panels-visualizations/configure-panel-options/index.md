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

A Grafana panel is a visual representation of data that you can customize by defining a data source query, transforming and formatting data, and configuring visualization settings.

A panel editor includes a query builder and a series of options that you can use to transform data and add information to your panels.

This topic describes how to:

- Open a panel for editing
- Add a panel title and description
- View a panel JSON model
- Configure repeating rows and panels

## Panel options

You can use generative AI to create panel titles and descriptions with the [Grafana LLM plugin][], which is currently in public preview. To enable this, refer to the [Set up generative AI features for dashboards documentation][]. Alternatively, you can take the following steps to create them yourself.

- **Title** - Text entered in this field appears at the top of your panel in the panel editor and in the dashboard. Add a title and description to a panel to share with users any important information about the visualization. For example, use the description to document the purpose of the visualization. You can use [variables you have defined][] in the **Title** and **Description** field, but not [global variables][].
- **Description** - Text entered in this field appears in a tooltip in the upper-left corner of the panel. Add a title and description to a panel to share with users any important information about the visualization. For example, use the description to document the purpose of the visualization. You can use [variables you have defined][] in the **Title** and **Description** field, but not [global variables][].
- **Transparent background** -
- **Panel links** -
- **Repeat options** -

## Configure repeating panels

You can configure Grafana to dynamically add panels or rows to a dashboard. A dynamic panel is a panel that the system creates based on the value of a variable. Variables dynamically change your queries across all panels in a dashboard. For more information about repeating rows, refer to [Configure repeating rows][].

{{% admonition type="note" %}}
Repeating panels require variables to have one or more items selected; you can't repeat a panel zero times to hide it.
{{% /admonition %}}

To see an example of repeating panels, refer to [this dashboard with repeating panels](https://play.grafana.org/d/testdata-repeating/testdata-repeating-panels?orgId=1).

**Before you begin:**

- Ensure that the query includes a multi-value variable.

**To configure repeating panels:**

1. [Edit the panel](#edit-a-panel) you want to repeat.

1. On the display options pane, click **Panel options > Repeat options**.

1. Select a `direction`.

   - Choose `horizontal` to arrange panels side-by-side. Grafana adjusts the width of a repeated panel. Currently, you can't mix other panels on a row with a repeated panel.
   - Choose `vertical` to arrange panels in a column. The width of repeated panels is the same as the original, repeated panel.

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
{{% /docs/reference %}}
