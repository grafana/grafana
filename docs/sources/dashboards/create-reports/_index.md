---
aliases:
  - ../administration/reports/ # /docs/grafana/latest/administration/reports/
  - ../enterprise/export-pdf/ # /docs/grafana/latest/enterprise/export-pdf/
  - ../enterprise/reporting/ # /docs/grafana/latest/enterprise/reporting/
  - ../panels/create-reports/ # /docs/grafana/latest/panels/create-reports/
  - reporting/ # /docs/grafana/latest/dashboards/reporting/
keywords:
  - grafana
  - reporting
  - export
  - pdf
labels:
  products:
    - cloud
    - enterprise
menuTitle: Reporting
title: Create and manage reports
description: Generate and share PDF reports from your Grafana dashboards
weight: 600
refs:
  repeat-panels-or-rows:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-panel-options/#configure-repeating-panels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-panel-options/#configure-repeating-panels
  http-apis:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/
  image-rendering:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
  rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
  permission:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
  role-based-access-control:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
  configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
  image-rendering:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
  templates-and-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
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
  time-range-controls:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#set-dashboard-time-range
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/use-dashboards/#set-dashboard-time-range
  send-report:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/reporting/#send-a-report
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/reporting/#send-a-report
  smtp:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#smtp
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#smtp
  temp-data-lifetime:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#temp_data_lifetime
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#temp_data_lifetime
  rendering-configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/create-reports/report-settings/#rendering-configuration
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/create-reports/report-settings/#rendering-configuration
  
---

# Create and manage reports

Reporting enables you to automatically generate PDFs from any of your dashboards and have Grafana email them to interested parties on a schedule. This is available in Grafana Cloud and in Grafana Enterprise.

{{< admonition type="note" >}}
If you have [Role-based access control](ref:role-based-access-control) enabled, for some actions you would need to have relevant permissions.
Refer to specific guides to understand what permissions are required.
{{< /admonition >}}

Any changes you make to a dashboard used in a report are reflected the next time the report is sent. For example, if you change the time range in the dashboard, then the time range in the report also changes, unless you've configured a custom time range.

## Requirements

- SMTP must be configured for reports to be sent. Refer to [SMTP](ref:smtp) in [Configuration](ref:configuration) for more information.
- The Image Renderer plugin must be installed or the remote rendering service must be set up. Refer to [Image rendering](ref:image-rendering) for more information.

## Access control

When [RBAC](ref:rbac) is enabled, you need to have the relevant [Permissions](ref:permission) to create and manage reports.

## Create a report

Only organization administrators can create reports by default. You can customize who can create reports with [Role-based access control](ref:role-based-access-control).

The report creation process is multi-step, but you don't need to complete these steps in order and you can skip steps by clicking a step name at the top of the page:

<!-- image here -->

To create a report, follow these steps:

1. Click **Dashboards > Reports** in the main menu.
1. Click **+ Create a new report**.
1. Complete the report steps, as needed; you don't need to complete these steps in order and you can skip steps by clicking a step name at the top of the page:
   - [Select dashboard](#1-select-dashboard)
   - [Format report](#2-format-report)
   - [Schedule](#schedule)
   - [Share](#share)
   - [Confirm](#confirm)
1. Do one of the following:
   - **Send** - The report will be sent according the schedule you've set.
   - **Save as draft** - You can save a draft at any point during the report creation or update process, even if it's missing required fields. The report won't be sent according to its schedule while it's a draft.
   - **Discard** - Delete the report draft. This action can't be reversed.

### 1. Select dashboard

At this step, select the dashboard or dashboards on which the report is based as well as the variables and time range for those dashboards. The options are:

- [Source dashboard](#source-dashboard)
- [Template variables](#template-variables)
- [Time range (optional)](#time-range)
- [Add another dashboard](#add-another-dashboard)

#### Source dashboard

Select the dashboard from which you want to generate the report.

#### Template variables

Select the variable **Datasource** and **Instance** for the selected dashboard. This option is only displayed if the dashboard has variables.

You can configure report-specific template variables for the dashboard on the report page. The variables that you select will override the variables from the dashboard, and they are used when rendering a PDF file of the report. For detailed information about using template variables, refer to the [Templates and variables](ref:templates-and-variables) section.

The query variables saved with a report might become out of date if the results of that query change. For example, if your template variable queries for a list of hostnames and a new hostname is added, then it will not be included in the report. If that occurs, the selected variables must be manually updated in the report. If you select the **All** value for the template variable or if you keep the dashboard's original variable selection, then the report stays up-to-date as new values are added.

##### Reports with panels or rows set to repeat by a variable

You can include dynamic dashboards with panels or rows, set to repeat by a variable, into reports. For detailed information about setting up repeating panels or rows in dashboards, refer to [Repeat panels or rows](ref:repeat-panels-or-rows).

This functionality has the following caveats:

- Rendering repeating panels for dynamic variable types (for example, `query` variables) with selected `All` value is currently not supported. As a workaround, select all the values.
- If you select different template variables in a report for a dashboard with repeating rows, you might see empty space or missing values at the bottom of the report. This is because the dimensions of the panels from the dashboard are used to generate the report. To avoid this issue
  - use the dashboard's original template variables for the report, or make a copy of the dashboard
  - select the new set of template variables
  - generate a report based on the copied dashboard.
- Rendering of the repeating panels inside collapsed rows in reports is not supported.

#### Time range

By default, reports use the saved time range of the dashboard. Optionally, you can change the time range of the report by:

- Saving a modified time range to the dashboard. Changing the dashboard time range without saving it doesn't change the time zone of the report.
- Setting a time range via the **Time range** field in the report form. If specified, the custom time range overrides the time range from the report's dashboard.

The page header of the report displays the time range for the dashboard's data queries.

##### Report time zones

Reports use the time zone of the dashboard from which they’re generated. You can control the time zone for your reports by setting the dashboard to a specific time zone. Note that this affects the display of the dashboard for all users.

If a dashboard has the **Browser Time** setting, the reports generated from that dashboard use the time zone of the Grafana server. As a result, this time zone might not match the time zone of users creating or receiving the report.

If the time zone is set differently between your Grafana server and its remote image renderer, then the time ranges in the report might be different between the page header and the time axes in the panels. To avoid this, set the time zone to UTC for dashboards when using a remote renderer. Each dashboard's time zone setting is visible in the [time range controls](ref:time-range-controls).

#### Add another dashboard

Add more dashboards to the report. Additional dashboards will be rendered as new pages in the same PDF file, or additional images if you chose to embed images in your report email. You can't add the same dashboard to a report multiple times.

### 2. Format report

To begin, select at least one of the following options for how the report should be formatted:

- [Attach the report as a PDF](#attach-the-report-as-a-pdf)
- [Include table data as PDF appendix](#table-data-in-pdf) (Public preview)
- [Embed a dashboard image in the email](#embed-a-dashboard-as-an-image-in-the-email)
- [Attach a CSV file of the table panel data](#attach-a-csv-file-of-the-table-panel-data)
- [Attach a separate PDF of table data](#table-data-in-pdf) (Public preview)

#### Attach the report as a PDF

If you selected the PDF format option, under the **Style the PDF** section, set the following options:

- **Configure the report header** - Click the checkbox to select this option.
- **Orientation** - Set the report orientation in **Portrait** or **Landscape**.
- **Layout** - Select one of the following:
  - **Simple** - Renders each panel as full-width across the PDF. Refer to [Layout and orientation](#layout-and-orientation) to see examples.
  - **Grid** - Renders the PDF with the same panel arrangement and width as the source dashboard. Refer to [Layout and orientation](#layout-and-orientation) to see examples.
- **Zoom** - Zoom in to enlarge text in your PDF, or zoom out to see more data (like table columns) per panel.

Click **Preview PDF** in the top-right corner of the screen to view a rendered PDF with the options you selected.

##### Layout and orientation

<!-- prettier-ignore-start -->

| Layout | Orientation | Description                                                                                               | Preview    |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------- | ------------ |
| Simple | Portrait    | Generates an A4 page in portrait mode with three panels per page.                                         | {{< figure src="/static/img/docs/enterprise/reports_portrait_preview.png" max-width="500px" alt="Simple layout in portrait" >}}    |
| Simple | Landscape   | Generates an A4 page in landscape mode with a single panel per page.                                      | {{< figure src="/static/img/docs/enterprise/reports_landscape_preview.png" max-width="500px" alt="Simple layout in landscape" >}}                     |
| Grid   | Portrait    | Generates an A4 page in portrait mode with panels arranged in the same way as at the original dashboard.  | {{< figure src="/static/img/docs/enterprise/reports_grid_portrait_preview.png" max-width="500px" alt="Grid layout in portrait" >}} |
| Grid   | Landscape   | Generates an A4 page in landscape mode with panels arranged in the same way as in the original dashboard. | {{< figure src="/static/img/docs/enterprise/reports_grid_landscape_preview.png" max-width="500px" alt="Grid layout in landscape" >}}                  |

<!-- prettier-ignore-end -->

#### Embed a dashboard as an image in the email

You can send a report email with an image of the dashboard embedded in the email instead of attached as a PDF. In this case, the email recipients can see the dashboard at a glance instead of having to open the PDF.

#### Attach a CSV file of the table panel data

{{< admonition type="note" >}}
To use this feature in Grafana Enterprise, you must have [Grafana image renderer plugin](/grafana/plugins/grafana-image-renderer) v3.0.
{{< /admonition >}}

You can attach a CSV file to the report email for each table panel on the selected dashboard, along with the PDF report. By default, CSVs larger than 10Mb are not sent which keeps email servers from rejecting the email. You can increase or decrease this limit in the [reporting configuration](ref:rendering-configuration).

This feature relies on the same plugin that supports the [image rendering](ref:image-rendering) features.

When the CSV file is generated, it is temporarily written to the `csv` folder in the Grafana `data` folder.

A background job runs every 10 minutes and removes temporary CSV files. You can configure how long a CSV file should be stored before being removed by configuring the [temp-data-lifetime](ref:temp-data-lifetime) setting. This setting also affects how long a renderer PNG file should be stored.

Click **Download CSV** in the top-right corner of the screen to see the file.

#### Table data in PDF

{{% admonition type="note" %}}
Available in public preview (`pdfTables` feature toggle) in [Grafana Enterprise](ref:grafana-enterprise) v10.3+ with the [Grafana image renderer plugin](/grafana/plugins/grafana-image-renderer) v3.0+, as well as [Grafana Cloud](/docs/grafana-cloud/).
{{% /admonition %}}

When there's more data in your table visualizations than can be shown in the dashboard PDF, you can select one of these two options to access all table visualization data as PDF in your reports:

- **Include table data as PDF appendix** - Adds an appendix to the main dashboard PDF.
- **Attach a separate PDF of table data** - Generates a separate PDF file.

This feature relies on the same plugin that supports the [image rendering](ref:image-rendering) features.

### Schedule

1. Schedule report.
   - Enter scheduling information. Options vary depending on the frequency selected.

#### Scheduling

> **Note:** Available in [Grafana Enterprise](ref:grafana-enterprise) and [Grafana Cloud](/docs/grafana-cloud/).

Scheduled reports can be sent once, or repeated on an hourly, daily, weekly, or monthly basis, or sent at custom intervals. You can also disable scheduling by selecting **Never**, for example to send the report via the API.

**Send now or schedule for later**

- **Send now** sends the report immediately after you save it. To stop sending the report at some point in the future, add an end date. If you leave the end date empty, the report is sent out indefinitely.

- **Send later** schedules a report for a later date. Thus, the start date and time are required fields. If you leave the end date empty, the report is sent out indefinitely.

**Send only from Monday to Friday**

For reports that have an hourly or daily frequency, you can choose to send them only from Monday to Friday.

**Send on the last day of the month**

When you schedule a report with a monthly frequency, and set the start date between the 29th and the 31st of the month, the report is only sent during the months that have those dates. If you want the report to be sent every month, select the **Send on the last day of the month** option instead. This way, the report is sent on the last day of every month regardless of how many days there are in any given month.

### Share

1. Enter report information. All fields are required unless otherwise indicated.
   - **Report name:** Name of the report as you want it to appear in the **Reports** list. The report name populates the email subject line.
   - **Recipients:** Enter the emails of the people or teams that you want to receive the report, separated by commas or semicolons.
   - **Reply to:** (optional) The address that appears in the **Reply to** field of the email.
   - **Message:** (optional) Message body in the email with the report.
   - **Include a dashboard link:** Include a link to the dashboard from within the report email.
   - **Send test email:** To verify that the configuration works as expected. You can choose to send this email to the recipients configured for the report, or to a different set of email addresses only used for testing.

#### Send a test email

> **Note:** Available in [Grafana Enterprise](ref:grafana-enterprise) and [Grafana Cloud](/docs/grafana-cloud/).

1. In the report, click **Send test email**.
1. In the **Email** field, enter the email address or addresses that you want to test, separated by a semicolon.
   If you want to use email addresses from the report, then select the **Use emails from report** check box.
1. Click **Send**.

The last saved version of the report will be sent to selected emails. You can use this to verify emails are working and to make sure the report is generated and displayed as you expect.

### Confirm

1. Preview and save the report.

## Manage reports

The **Reports** page allows you to view, create, and update your reports.

### Edit

TBD

#### Pause or resume a report

You can pause sending reports from the report list view by clicking the pause icon. The report will not be sent according to its schedule until it is resumed by clicking the resume button on the report row.

## Send a report via the API

You can send reports programmatically with the [send report](ref:send-report) endpoint in the [HTTP APIs](ref:http-apis).

## Troubleshoot reporting

To troubleshoot and get more log information, enable debug logging in the configuration file. Refer to [Configuration](ref:configuration) for more information.

```bash
[log]
filters = report:debug
```
