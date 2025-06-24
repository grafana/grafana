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
  change-ui-theme:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/organization-preferences/#change-grafana-ui-theme
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/organization-preferences/#change-grafana-ui-theme
---

# Reporting settings

You can configure organization-wide report settings and branding options in **Dashboards > Reporting**.
These settings are applied to all the reports for the current organization.

To access the settings, go to **Dashboards > Reporting** and click the **Report settings** button.
This opens the **Report template settings** drawer, where you can make changes.

{{< admonition type="note" >}}

The redesigned reporting feature, including the report settings drawer, is currently in public preview. Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available. To use this feature, enable the `newShareReportDrawer` feature toggle in your Grafana configuration file or, for Grafana Cloud, contact Support.

{{< /admonition >}}

You can also navigate these settings from the **Schedule report** drawer that opens when you create a report directly from a dashboard.

## Attachment settings

The options in this section control the branding and theming of the report attachments.

### PDF

- **Company logo** - Company logo displayed in the report PDF.
  Configure it by specifying a URL or uploading a file.
  The maximum file size is 16 MB.
  Defaults to the Grafana logo.

- **Theme** - Theme of the PDF attached to the report.
  The selected theme is also applied to the PDFs generated when you click **Preview PDF** during report creation or select the **Export as PDF** option on a dashboard.

  If **Current** is selected, the PDF in the report is in the instance theme of the report creator, but the preview and exported PDFs are in the user's instance theme.
  Defaults to **Light**.

### Embedded Image

- **Theme** - Theme of the dashboard image embedded in the email.
  If **Current** is selected, the image in the report is in the instance theme of the report creator. If the report creator doesn't have a theme set, then the team, organization, or server theme is used. For more information refer to [Change Grafana UI theme](ref:change-ui-theme).
  Defaults to **Dark**.

<!-- vale Grafana.WordList = NO -->

## Email branding

<!-- vale Grafana.WordList = YES -->

- **Company logo** - Company logo displayed in the report email. Configure it by specifying a URL or uploading a file. The maximum file size is 16 MB. Defaults to the Grafana logo.
- **Email footer** - Toggle to enable the report email footer. Select **Sent by** or **None**.
- **Footer link text** - Text of the link in the report email footer. Defaults to `Grafana`.
- **Footer link URL** - Link of the report email footer.

Currently, the API does not allow for the simultaneous upload of files with identical names for both the email logo and report logo.
You can still upload the same file for each logo separately in two distinct steps.
