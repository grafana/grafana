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
title: Text
weight: 100
---

# Text

The text panel enables you to directly include text or HTML in your dashboards. This can be used to add contextual information and descriptions or embed complex HTML.

## Mode

**Mode** determines how embedded content appears.

### Markdown

This option formats the content as [markdown](https://en.wikipedia.org/wiki/Markdown).

### HTML

This setting renders the content as [sanitized](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/text/sanitize.ts) HTML. If you require more direct control over the output, you can set the
[disable_sanitize_html][] flag which enables you to directly enter HTML.

### Code

This setting renders content inside a read-only code editor. Select an appropriate language to apply syntax highlighting
to the embedded text.

## Variables

[Variables][] in the content will be expanded for display.

{{% docs/reference %}}
[disable_sanitize_html]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#disable_sanitize_html"
[disable_sanitize_html]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#disable_sanitize_html"

[Variables]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/variable-syntax"
[Variables]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/variable-syntax"
{{% /docs/reference %}}
