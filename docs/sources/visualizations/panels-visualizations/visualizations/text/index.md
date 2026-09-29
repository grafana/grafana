---
aliases:
  - ../../../features/panels/text/ # /docs/grafana/next/features/panels/text/
  - ../../../panels-visualizations/visualizations/text/ # /docs/grafana/next/panels-visualizations/visualizations/text/
  - ../../../panels/visualizations/text-panel/ # /docs/grafana/next/panels/visualizations/text-panel/
  - ../../../reference/alertlist/ # /docs/grafana/next/reference/alertlist/
  - ../../../visualizations/text-panel/ # /docs/grafana/next/visualizations/text-panel/
keywords:
  - grafana
  - text
  - documentation
  - panel
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's text visualization
title: Text
weight: 100
---

# Text

{{< admonition type="note" >}}
The new text panel is currently in public preview.
Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

To use this feature, enable the `grafana.newTextPanel` and `text.newFeatures` feature toggles in your Grafana configuration file or contact Support.
{{< /admonition >}}

Text visualizations let you include text, HTML, code blocks, or Mermaid diagrams in your dashboards.
You can use them to add contextual information and descriptions or to embed complex HTML.
With text visualizations, you can build lightweight data-driven tables, cards, lists, and status summaries.

<!-- Update this example 

For example, if you want to display important links on your dashboard, you can use a text visualization to add these links: -->

{{< docs/play title="Text Panel" url="https://play.grafana.org/d/adl33bxy1ih34b/" >}}

Use a text visualization when you need to:

- Add important links or useful annotations.
- Provide instructions or guidance on how to interpret different panels, configure settings, or take specific actions based on the displayed data.
- Announce any scheduled maintenance or downtime that might impact your dashboards.

## Text visualization editor

The editor is where you enter and preview the content of a text visualization.
It's where you set text modes, like Markdown, HTML, or a specific coding language.
Additionally, it provides formatting options and syntax highlighting, as well as variable and diagram support.

To learn more, click the following links:

- [Editor views](#editor-views)
- [Formatting toolbar](#formatting-toolbar)
- [Text modes](#text-modes)

### Editor views

The editor provides three views:

- **Preview**: See only the preview block.
- **Split**: See the authoring and preview blocks at the same time.
- **Write**: See only the authoring block.

### Formatting toolbar

The toolbar provides formatting options for common Markdown and HTML operations, like bold or italic text and lists.
You can also insert:

- Tables
- Mermaid diagrams
- Dashboard variables

Dashboard variables autocomplete as you enter them, and they're interpolated in the content.

The options displayed in the formatting toolbar depend on the mode you select.

### Text modes

The visualization mode determines how embedded content appears.
Choose from:

- **Markdown**: Formats the content as [Markdown](https://en.wikipedia.org/wiki/Markdown).
- **HTML**: Renders the content as [sanitized](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/text/sanitize.ts) HTML. If you require more direct control over the output, you can set the [`disable_sanitize_html`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#disable_sanitize_html) flag which enables you to directly enter HTML.
- **Code**: Renders content inside a read-only code editor. [Variables](/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/variable-syntax/) in the content are expanded for display. The code options are: Go, HTML, JSON, Markdown, Plain text, SQL, TypeScript, XML, YAML.

The editor provides syntax highlighting in the authoring block.

{{< admonition type="note" >}}
To allow embedding of iframes and other websites, you need set `allow_embedding = true` in your Grafana `config.ini` or environment variables, depending on your deployment.
{{< /admonition>}}

## Render query results as text with Handlebars templates

Use `${__value}`, `${__field}`, `${__series}`, and `${__data}` macros to reference query results in the visualization content, and [Handlebars templating](https://handlebarsjs.com/guide/) for more control.
Choose what data to display, repeat content for each row with `{{#each}}`, and add if/then logic with `{{#if}}` helpers.

![Text visualization with Handlebars support](/media/docs/grafana/panels-visualizations/screenshot-text-handlebars-v13.3.png)

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data options

Use the following options to control how data is rendered in the text visualization.

#### Render mode

If you've used [Handlebars templates](#render-query-results-as-text-with-handlebars-templates), select a render mode to control how your template is applied:

- **Once**: Render the whole result.
- **Per row**: Each row in the data gets its own repeated block of content.

You can also select which data frame to display.

![Text visualization with Render mode set to per row](/media/docs/grafana/panels-visualizations/screenshot-text-render-mode-2-v13.3.png)

#### Page size

When a query returns many rows, pagination lets you move through the full result instead of showing only a limited number of rows.
Grafana automatically adjusts the number of rows on each page to fit the panel or you can set a range from 1-1000 rows.

This option only displays when you set **Render mode** to **Per row**.

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

<!-- Show line numbers: Displays line numbers in the panel preview when you choose **Code** as your text mode. -->
