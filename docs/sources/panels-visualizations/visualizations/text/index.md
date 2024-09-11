---
aliases:
  - ../../features/panels/text/
  - ../../panels/visualizations/text-panel/
  - ../../reference/alertlist/
  - ../../visualizations/text-panel/
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
  disable_sanitize_html:
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

Text visualizations enable you to directly include text or HTML in your dashboards. This can be used to add contextual information and descriptions or embed complex HTML.

For example, if you want to display important links to your dashboard, you can use a text visualization to add these links:

{{< figure src="/static/img/docs/text-panel/text-panel.png" max-width="1025px" alt="A text panel showing important links" >}}

{{< docs/play title="Text Panel" url="https://play.grafana.org/d/adl33bxy1ih34b/" >}}

Use a text visualization when you need to:

- Add important links or useful annotations.
- Provide instructions or guidance on how to interpret different panels, configure settings, or take specific actions based on the displayed data.
- Announce any scheduled maintenance or downtime that might impact your dashboards.

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Text options

Use the following options to refine your text visualization.

### Mode

**Mode** determines how embedded content appears.

{{< admonition type="note" >}}
To allow embedding of iframes and other websites, you need set `allow_embedding = true` in your Grafana `config.ini` or environment variables (depending on your employment).
{{< /admonition >}}

### Markdown

This option formats the content as [markdown](https://en.wikipedia.org/wiki/Markdown).

### HTML

This setting renders the content as [sanitized](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/text/sanitize.ts) HTML. If you require more direct control over the output, you can set the
[disable_sanitize_html](ref:disable_sanitize_html) flag which enables you to directly enter HTML.

### Code

This setting renders content inside a read-only code editor. Select an appropriate language to apply syntax highlighting
to the embedded text.

## Variables

[Variables](ref:variables) in the content will be expanded for display.
