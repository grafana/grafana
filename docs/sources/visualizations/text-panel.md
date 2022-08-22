---
aliases:
  - /docs/grafana/latest/features/panels/text/
  - /docs/grafana/latest/panels/visualizations/text-panel/
  - /docs/grafana/latest/reference/alertlist/
  - /docs/grafana/latest/visualizations/text-panel/
keywords:
  - grafana
  - text
  - documentation
  - panel
title: Text
weight: 1100
---

# Text

The text panel enables you to directly include text or HTML in your dashboards. This can be used to add contextual information and descriptions or embed complex HTML.

## Mode

The **Mode**, select how the embedded content should be displayed

### Markdown

The content is formatted as [markdown](https://en.wikipedia.org/wiki/Markdown)

### HTML

This setting renders the content as [sanitized](https://github.com/grafana/grafana/blob/code-in-text-panel/packages/grafana-data/src/text/sanitize.ts) HTML. If you require more direct control over the output, you can set the 
[disable_sanitize_html]({{< relref "../setup-grafana/configure-grafana/#disable_sanitize_html" >}}) flag which enables you to directly enter HTML.

### Code

This option renders content inside a read-only code editor. The selected language will provide proper syntax highlighting

you want to use markdown or HTML to style your text, then enter content in the box below. Grafana includes a title and paragraph to help you get started, or you can paste content in from another editor.

## Variables

[Variables]({{< relref "../variables/syntax/" >}}) in the content will be expanded for display.
