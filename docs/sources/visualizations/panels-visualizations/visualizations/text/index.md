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
refs:
  disable-sanitize-html:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#disable_sanitize_html
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#disable_sanitize_html
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/
---

# Text

{{< docs/public-preview product="New text panel" featureFlag="`grafana.newTextPanel` and `text.newFeatures" >}}

<!-- use what's new to make intro more robust -->

Text visualizations let you include text or HTML in your dashboards.
This can be used to add contextual information and descriptions or embed complex HTML.

For example, if you want to display important links on your dashboard, you can use a text visualization to add these links:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-text-visualization-v11.6.png" max-width="750px" alt="A text panel showing important links" >}}

{{< docs/play title="Text Panel" url="https://play.grafana.org/d/adl33bxy1ih34b/" >}}

Use a text visualization when you need to:

- Add important links or useful annotations.
- Provide instructions or guidance on how to interpret different panels, configure settings, or take specific actions based on the displayed data.
- Announce any scheduled maintenance or downtime that might impact your dashboards.

## Text visualization editor

The text visualization has an editor separate from the other configuration options.
This is where you enter and preview the content of the visualization.
It's also where you set text modes, like Markdown, HTML, or a specific coding language.

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

Dashboard variables are interpolated in the content.

The options displayed in the formatting toolbar depend on the mode you select.

### Text modes

This mode determines how embedded content appears.
Choose from:

- **Markdown**: Formats the content as [Markdown](https://en.wikipedia.org/wiki/Markdown).
- **HTML**: Renders the content as [sanitized](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/text/sanitize.ts) HTML. If you require more direct control over the output, you can set the [`disable_sanitize_html`](ref:disable-sanitize-html) flag which enables you to directly enter HTML.
- **Code**: Renders content inside a read-only code editor. [Variables](ref:variables) in the content are expanded for display. The code options are: Go, HTML, JSON, Markdown, Plain text, SQL, TypeScript, XML, YAML.

The editor provides syntax highlighting in the authoring block.

{{< admonition type="note" >}}
To allow embedding of iframes and other websites, you need set `allow_embedding = true` in your Grafana `config.ini` or environment variables, depending on your deployment.
{{< /admonition>}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data options

Use the following options to control how data is rendered in the text visualization.

#### Render mode

Blah blah

- **Once**:
- **Per row**:

#### Page size

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

<!-- Show line numbers: Displays line numbers in the panel preview when you choose **Code** as your text mode. -->
