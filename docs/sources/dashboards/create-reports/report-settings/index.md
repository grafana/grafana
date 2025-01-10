---
keywords:
  - grafana
  - reporting
  - settings
labels:
  products:
    - cloud
    - enterprise
menuTitle: Settings
title: Reporting settings
description: Manage organizational Reporting settings
weight: 700
refs:
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
---

# Reporting settings

You can configure organization-wide report settings in the **Settings** under **Dashboards > Reporting**. Settings are applied to all the reports for current organization.

You can customize the branding options.

## Attachment settings

### PDF

- **Company logo:** Company logo displayed in the report PDF. It can be configured by specifying a URL, or by uploading a file. The maximum file size is 16 MB. Defaults to the Grafana logo.

- **Theme:** Theme of the PDF attached to the report. Defaults to **Light**. The selected theme is also applied to the PDFs generated when you click **Preview PDF** during report creation or select the **Export as PDF** option on a dashboard. If **Current** is selected, the PDF in the report will be in the Admin's instance theme, but the preview and exported PDFs will be in the user's instance theme.

### Embedded Image

- **Theme:** Theme of the dashboard image embedded in the email. Defaults to **Dark**.

## Email branding

- **Company logo:** Company logo displayed in the report email. It can be configured by specifying a URL, or by uploading a file. The maximum file size is 16 MB. Defaults to the Grafana logo.
- **Email footer:** Toggle to enable the report email footer. Select **Sent by** or **None**.
- **Footer link text:** Text of the link in the report email footer. Defaults to `Grafana`.
- **Footer link URL:** Link of the report email footer.

Currently, the API does not allow for the simultaneous upload of files with identical names for both the email logo and report logo. You can still upload the same file for each logo separately in two distinct steps.

## Rendering configuration

When generating reports, each panel renders separately before being collected in a PDF. You can configure the per-panel rendering timeout and number of concurrently rendered panels.

To make a panel more legible, you can set a scale factor for the rendered images. However, a higher scale factor increases the file size of the generated PDF.

You can also specify custom fonts that support different Unicode scripts. The DejaVu font is the default used for PDF rendering.

These options are available in the [configuration](ref:configuration) file.

```ini
[reporting]
# Use this option to enable or disable the reporting feature. When disabled, no reports are generated, and the UI is hidden. By default, reporting is enabled.
enabled = true
# Set timeout for each panel rendering request
rendering_timeout = 10s
# Set maximum number of concurrent calls to the rendering service
concurrent_render_limit = 4
# Set the scale factor for rendering images. 2 is enough for monitor resolutions
# 4 would be better for printed material. Setting a higher value affects performance and memory
image_scale_factor = 2
# Set the maximum file size in megabytes for the report email attachments
max_attachment_size_mb = 10
# Path to the directory containing font files
fonts_path =
# Name of the TrueType font file with regular style
font_regular = DejaVuSansCondensed.ttf
# Name of the TrueType font file with bold style
font_bold = DejaVuSansCondensed-Bold.ttf
# Name of the TrueType font file with italic style
font_italic = DejaVuSansCondensed-Oblique.ttf
# Maximum number of panel rendering request retries before returning an error. To disable the retry feature, enter `0`. This is available in public preview and requires the `reportingRetries` feature toggle.
max_retries_per_panel = 3
# Allowed domains to receive reports. Use an asterisk (`*`) to allow all domains. Use a comma-separated list to allow multiple domains. Example: allowed_domains = grafana.com, example.org
allowed_domains = *
```

## Troubleshoot reporting

To troubleshoot and get more log information, enable debug logging in the configuration file. Refer to [Configuration](ref:configuration) for more information.

```bash
[log]
filters = report:debug
```
