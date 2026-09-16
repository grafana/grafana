---
keywords:
  - grafana
  - reporting
  - settings
  - pdf
  - header
  - footer
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
  feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
aliases:
  - ../../../dashboards/create-reports/report-settings/ # /docs/grafana/next/dashboards/create-reports/report-settings/
---

# Reporting settings

You can configure organization-wide report settings and branding options in **Dashboards > Reporting**.
These settings are applied to all the reports for the current organization.

To access the settings, go to **Dashboards > Reporting** and click the **Report settings** button.
This opens the **Report template settings** drawer, where you can make changes.

{{< admonition type="note" >}}
The redesigned reporting experience, including the report settings drawer, is generally available in [Grafana Cloud](/docs/grafana-cloud/).

In self-managed Grafana, enable the `newShareReportDrawer` [feature toggle](ref:feature-toggles) in your Grafana configuration file.
{{< /admonition >}}

You can also navigate these settings from the **Schedule report** drawer that opens when you create a report directly from a dashboard.

## Attachment settings

The options in this section control the branding and theming of the report attachments.

### PDF

- **Company logo** - Company logo displayed in the report PDF.
  Configure it by specifying a URL or uploading a file.
  The maximum file size is 3 MB.
  If not set, defaults to the Grafana logo. If the specified URL isn't valid, the logo image appears as broken.

- **Theme** - Theme of the PDF attached to the report.
  The selected theme is also applied to the PDFs generated when you click **Preview PDF** during report creation or select the **Export as PDF** option on a dashboard.

  If **Current** is selected, the PDF in the report is in the instance theme of the report creator, but the preview and exported PDFs are in the user's instance theme.
  Defaults to **Light**.

### PDF header

{{< admonition type="note" >}}
The PDF header options are available in [Grafana Enterprise](ref:grafana-enterprise), as well as in [Grafana Cloud](/docs/grafana-cloud/).

In self-managed Grafana, enable the `reportingHeaderSettings` [feature toggle](ref:feature-toggles) in your Grafana configuration file.
{{< /admonition >}}

The PDF header repeats at the top of every page of the report PDF.
In the **PDF** section, use the following switches to choose what it contains:

- **Show header** - Displays the report name and the date the PDF was generated.
  Defaults to on.
- **Show dashboard title** - Displays the title of the dashboard that the page was rendered from.
  Defaults to on.
- **Show data time range** - Displays the absolute time range of the data in the report.
  Defaults to on.

When you turn a switch off, that item no longer appears on any page, and the panels get the space instead.
If you turn all three off, the header area is removed unless the report has **Show template variables** selected.

These switches apply to the report PDF and to the separate PDF of table data.
They also apply to the PDFs you generate with **Preview PDF** during report creation and with **Export as PDF** on a dashboard.

### PDF footer

{{< admonition type="note" >}}
The PDF footer options are available in [Grafana Enterprise](ref:grafana-enterprise), as well as in [Grafana Cloud](/docs/grafana-cloud/).

In self-managed Grafana, enable the `reportingFooterSettings` [feature toggle](ref:feature-toggles) in your Grafana configuration file.
{{< /admonition >}}

The PDF footer repeats at the bottom of every page of the report PDF.
By default, it shows the page number on the left and your company logo on the right.

In the **Footer** section, you can replace that default with your own sequence of items.
You can also style each text item individually.
For example, you can add a confidentiality label next to the page number, or center a copyright line on the page.

- **Font family** - Font for every text item in the footer.
  Select **Inter (Default)**, **Helvetica**, **Arial**, **Times New Roman**, **Georgia**, **Verdana**, **Trebuchet MS**, or **Courier New**.
  Individual items can't set a different font.

#### Footer items

Grafana prints footer items from left to right, in the order they appear in the list.
The list might already contain the default items of a page number, a flex spacer, and a logo.
Remove the ones you don't want before you add your own.
You can add up to 10 items, and you can add the same item type more than once.
If you remove every item, reports fall back to the default footer of a page number and the company logo.

<!-- prettier-ignore-start -->

| Item | Description | Options |
| ---- | ----------- | ------- |
| Page number | Prints the current page and the total page count, such as `Page 2/8`. | [Text styling](#text-styling-options) |
| Date | Prints the date that the PDF was generated. | <ul><li>Date format of `dd/MM/yyyy`, `MM/dd/yyyy`, or `MM/yyyy`, defaulting to `dd/MM/yyyy`</li><li>[Text styling](#text-styling-options)</li></ul> |
| Fixed text | Prints the text that you enter, such as a copyright notice or a document classification. The text is limited to 50 characters, and the characters `<` and `>` aren't allowed. | [Text styling](#text-styling-options) |
| Logo | Prints the logo from the **Company logo** setting in the [PDF](#pdf) section. | Size of **Small (24px)**, **Medium (36px)**, **Large (48px)**, or **Extra large (64px)**, defaulting to **Medium (36px)** |
| Flex spacer | Prints nothing and pushes the items on either side of it apart. Use spacers to align items to the left, center, and right of the page. | None |

<!-- prettier-ignore-end -->

To place a date on the left, a label in the center, and the page number on the right, arrange five items in this order:
**Date**, **Flex spacer**, **Fixed text**, **Flex spacer**, **Page number**.

#### Text styling options

Page number, date, and fixed text items each have their own styling options.
To open them, click the gear icon next to the item.

- **Size** - Font size of the item in pixels.
  Select 8, 10, 12, 14, 16, or 18.
- **Weight** - Select **Normal** or **Bold**.
- **Style** - Select **Normal** or **Italic**.
- **Color** - Select a color from the color picker or enter a hex color code, such as `#FF0000`.

Clear an option to return the item to its default styling.
The default font size scales with the **Zoom** setting of the report, so text stays readable at every zoom level.

#### Customize the PDF footer

To customize the PDF footer, follow these steps:

1. Go to **Dashboards > Reporting** and click **Report settings**.
1. Under **Attachment settings**, go to the **Footer** section.
1. Remove any items you don't want to keep by clicking the trash icon next to each one.
1. Click **+ Add footer item** and select an item type.
1. Configure the item.

   For a fixed text item, enter the text.
   For a date item, select a date format.
   For a logo item, select a size.

1. Repeat the previous two steps for each item you want in the footer.
1. Click **Save**.

While you're editing the footer, you can also:

- Style a page number, date, or fixed text item.
  Click the gear icon next to the item and set **Size**, **Weight**, **Style**, or **Color**.
- Reorder the footer.
  Use the up and down arrows next to each item.

The next report that Grafana generates uses the new footer.
To check it sooner, click **Preview PDF** during report creation.

The footer applies to the report PDF, and to the PDFs you generate with **Preview PDF** during report creation and with **Export as PDF** on a dashboard.
The separate PDF of table data isn't affected by these settings.
It always prints a page number and the company logo.

### Embedded Image

- **Theme** - Theme of the dashboard image embedded in the email.
  If **Current** is selected, the image in the report is in the instance theme of the report creator. If the report creator doesn't have a theme set, then the team, organization, or server theme is used. For more information refer to [Change Grafana UI theme](ref:change-ui-theme).
  Defaults to **Dark**.

<!-- vale Grafana.WordList = NO -->

## Email branding

<!-- vale Grafana.WordList = YES -->

- **Company logo** - Company logo displayed in the report email. Configure it by specifying a URL or uploading a file. The maximum file size is 3 MB. If not set, defaults to the Grafana logo. If the specified URL isn't valid, the logo image appears as broken.
- **Email footer** - Select **Sent by** to add a footer link to the report email, or **None** to omit it.
- **Footer link text** - Text of the link in the report email footer. Defaults to `Grafana`.
- **Footer link URL** - Link of the report email footer.

Currently, the API does not allow for the simultaneous upload of files with identical names for both the email logo and report logo.
You can still upload the same file for each logo separately in two distinct steps.
