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
  configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#filters
---

# Reporting settings

You can configure organization-wide report settings and branding options in **Dashboards > Reporting > Settings**. Settings are applied to all the reports for the current organization.

## Attachment settings

The options in this section control the branding and theming of the report attachments.

### PDF

- **Company logo** - Company logo displayed in the report PDF. It can be configured by specifying a URL, or by uploading a file. The maximum file size is 16 MB. Defaults to the Grafana logo.

- **Theme** - Theme of the PDF attached to the report. Defaults to **Light**. The selected theme is also applied to the PDFs generated when you click **Preview PDF** during report creation or select the **Export as PDF** option on a dashboard. If **Current** is selected, the PDF in the report will be in the instance theme of the Admin, but the preview and exported PDFs will be in the user's instance theme.

### Embedded Image

- **Theme** - Theme of the dashboard image embedded in the email. Defaults to **Dark**.

<!-- vale Grafana.WordList = NO -->

## Email branding

<!-- vale Grafana.WordList = YES -->

- **Company logo** - Company logo displayed in the report email. It can be configured by specifying a URL, or by uploading a file. The maximum file size is 16 MB. Defaults to the Grafana logo.
- **Email footer** - Toggle to enable the report email footer. Select **Sent by** or **None**.
- **Footer link text** - Text of the link in the report email footer. Defaults to `Grafana`.
- **Footer link URL** - Link of the report email footer.

Currently, the API does not allow for the simultaneous upload of files with identical names for both the email logo and report logo. You can still upload the same file for each logo separately in two distinct steps.
