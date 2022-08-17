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

The text panel allows you to directly include text/html in your dashboards. This can be used to add contextual information and descriptions, or embed complex HTML.

### Mode

The **Mode**, select how the embedded content should be displayed

#### Markdown

The content is formatted as [markdown](https://en.wikipedia.org/wiki/Markdown)

#### HTML

The content is rendered as raw HTML. NOTE: unless [disable_sanitize_html](setup-grafana/configure-grafana/#disable_sanitize_html) is set
in the system configuration, the HTML included in the dashboards will be [sanitized](https://github.com/grafana/grafana/blob/code-in-text-panel/packages/grafana-data/src/text/sanitize.ts) to avoid potential XSS attacks.

To use iframes or other techniques that load remote content, the disable_sanitize_html will need to be enabled.

#### Code

Content is rendered inside a read only code editor. The selected language will provide proper syntax highlighting

you want to use markdown or HTML to style your text, then enter content in the box below. Grafana includes a title and paragraph to help you get started, or you can paste content in from another editor.
