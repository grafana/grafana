---
aliases:
  - ../../panels/add-panels-dynamically/ # /docs/grafana/next/panels/add-panels-dynamically/
  - ../../panels/configure-panel-options/ # /docs/grafana/next/panels/configure-panel-options/
  - ../../panels/repeat-panels-or-rows/ # /docs/grafana/next/panels/repeat-panels-or-rows/
  - ../../panels/working-with-panels/add-title-and-description/ # /docs/grafana/next/panels/working-with-panels/add-title-and-description/
  - ../../panels/working-with-panels/view-json-model/ # /docs/grafana/next/panels/working-with-panels/view-json-model/
  - ../../panels-visualizations/configure-panel-options/ # /docs/grafana/next/panels-visualizations/configure-panel-options/
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
description: Add titles, Markdown descriptions, repeating rows, and panel links
weight: 50
---

# Configure panel options

There are settings common to all visualizations, which you set in the **Panel options** section of the panel editor pane. The following sections describe these options as well as how to set them.

## Panel options

Set the following options to provide basic information about a panel and define basic display elements:

<!-- prettier-ignore-start -->

| Option                                       | Description                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Title                                        | Text entered in this field appears at the top of your panel in the panel editor and in the dashboard. You can use [variables you have defined](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/) or [global variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#global-variables). |
| [Description](#description-field-formatting) | Text entered in this field appears in a tooltip in the upper-left corner of the panel. Add a description to a panel to share with users any important information about it, such as its purpose. You can use [variables you have defined](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/) or dashboard-scoped [global variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#global-variables) (such as `$__from`, `$__to`, `$__dashboard`, `$__org`, and `$__user`). Query-scoped global variables (such as `$__interval` and `$__interval_ms`) are not available in this field. |
| Transparent background                       | Toggle this switch on and off to control whether or not the panel has the same background color as the dashboard. | 
| Panel links | Add [links to the panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/#panel-links) to create shortcuts to other dashboards, panels, and external websites. Access panel links by clicking the icon next to the panel title. |
| Repeat options                               | Set whether to repeat the panel for each value in the selected variable. For more information, refer to [Configure repeating panels](#configure-repeating-panels).|

<!-- prettier-ignore-end -->

You can use generative AI to populate the **Title** and **Description** fields with the [Grafana LLM plugin](https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/configure/llm-plugin/), which is currently in public preview.
To enable this, refer to [Set up generative AI features for dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards).

### Description field formatting

Grafana renders the **Description** field as [GitHub Flavored Markdown](https://github.github.com/gfm/) (GFM). You can use common Markdown and GFM features, including:

- **Emphasis:** `**bold**`, `_italic_`, and `~~strikethrough~~`
- **Structure:** headings, paragraphs, blockquotes, horizontal rules, bulleted and numbered lists
- **Code:** `` `inline code` `` and fenced code blocks
- **Links and media:** `[link text](https://example.com)` and images `![alt](https://example.com/image.png)`
- **Tables:** GFM-style pipe tables

The description appears in a tooltip, so short copy and basic formatting work best.
To break text into separate paragraphs, use an empty line between them, or use a list.

Grafana sanitizes the rendered HTML to reduce security risk and strips out or restricts arbitrary HTML, scripts, and many embedded elements, similar to Markdown in the [Text](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/text/) visualization.

## Configure repeating panels

You can configure Grafana to dynamically add panels to a dashboard.
A dynamic panel is a panel that the system creates based on the value of a multi-value variable.
Variables dynamically change your queries across all panels in a dashboard.

To see an example of repeating panels, refer to [this dashboard with repeating panels](https://play.grafana.org/d/testdata-repeating/testdata-repeating-panels?orgId=1).

For information about repeating rows and tabs, refer to [Configure repeat options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#configure-repeat-options).

**Before you begin:**

- Ensure that the query includes a multi-value variable.

To configure repeating panels, follow these steps:

{{< docs/list >}}

1. Go to the dashboard you want to update and navigate to the panel you want to repeat.

   If the dashboard is large, open the **Content outline** and use it to navigate to the part of the dashboard you want to update.

1. Click **Edit**.
1. Click the panel to open the sidebar.

{{% shared-snippet path="/docs/grafana/latest/visualizations/dashboards/build-dashboards/create-dashboard/_index.md" id="configure-repeat" %}}

1. To propagate changes to all panels, reload the dashboard.

{{< /docs/list >}}

You can stop a panel from repeating by selecting **Disable repeating** in the **Repeat by variable** drop-down list.
