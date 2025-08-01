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
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
  image-rendering:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
  max-size-configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#max_attachment_size_mb
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/enterprise-configuration/#max_attachment_size_mb
  log-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#filters
  permission:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
  rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
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
  templates-and-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  time-range-controls:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#set-dashboard-time-range
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/use-dashboards/#set-dashboard-time-range
---

# Create and manage reports

{{< admonition type="note" >}}

The redesigned reporting feature is currently in public preview. Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available. To use this feature, enable the `newShareReportDrawer` feature toggle in your Grafana configuration file or, for Grafana Cloud, contact Support.

{{< /admonition >}}

**Reporting** allows you to send automated and scheduled emails from any of your dashboards.
You can configure several elements of these reports and generate PDFs and CSV files.
Any changes you make to a dashboard used in a report are reflected the next time the report is sent.

{{< figure src="/media/docs/grafana/dashboards/screenshot-report-config-v12.0.png" max-width="600px" alt="The report configuration screen" >}}

## Requirements

For Grafana Enterprise, the Reporting feature has the following requirements:

- SMTP must be configured for reports to be sent. Refer to [SMTP configuration documentation](ref:smtp) for more information.
- The [Grafana image renderer plugin](/grafana/plugins/grafana-image-renderer) (v3.10+) must be installed or the remote rendering service must be set up. Refer to [Image rendering](ref:image-rendering) for more information.

### Rendering configuration

By default, attachments (PDFs, CSV files, and embedded images) larger than 10 MB are not sent, which keeps email servers from rejecting the email.
You can increase or decrease this limit in the [reporting configuration](ref:max-size-configuration).

When a report file is generated, it's temporarily written to the corresponding folder (`csv`, `pdf`, `png`) in the Grafana `data` folder.
A background job runs every 10 minutes and removes temporary files.
You can set how long a file should be stored before being removed by configuring the [`temp_data_lifetime`](ref:temp-data-lifetime) setting in your `ini` file.

## Access control

Only organization administrators can create reports by default.
You can customize who can create reports with [role-based access control (RBAC)](ref:rbac).

When [RBAC](ref:rbac) is enabled, you need to have the relevant [permissions](ref:permission) to create and manage reports.
Refer to specific guides to understand what permissions are required.

## Create a report

The report creation process is multi-step, but you don't need to complete these steps in order.

You can also save the report as a draft at any point during the initial creation process.

You can create directly from a dashboard or from the **Reporting** page.
Select one of the following tabs for directions on each option.

To create a report, follow these steps:

{{< tabs >}}
{{< tab-content name="Create a report directly from a dashboard" >}}

1. In the main menu, click **Dashboards**.
1. Navigate to the dashboard from which you want to create a report.
1. Click the **Share** drop-down list in the top-right corner of the dashboard.
1. Click **Schedule report**.

   The **Schedule report** drawer opens. Any other reports using this dashboard are listed in the drawer. You can also click **See all reports** to navigate to **Reporting** for a full list of reports generated from all dashboards.

1. Click **+ Create a new report**.
1. Update the name of the report, if needed.

   By default, the report name is the name of the dashboard.

1. Expand and complete each section of the report, as needed:
   - [Dashboards](#1-dashboards)
   - [Schedule](#2-schedule)
   - [Email settings](#3-email-settings)
   - [Recipients](#4-recipients)
   - [Attachments](#5-attachments)
1. Click one of the following buttons at the bottom of the **Schedule report** drawer:

   - The menu icon to access the following options:
     - **Download CSV**
     - **Preview PDF**
     - **Report settings** - Takes you to **Reporting** in a new browser tab and opens the **Report template settings** drawer, where you can configure organization-level report settings.
   - **Send preview** - Send a preview of the report to your desired recipient. You can choose to use the report recipients:

     {{< figure src="/media/docs/grafana/dashboards/screenshot-send-preview-v12.0.png" max-width="350px" alt="The Send preview modal" >}}

   - **Schedule report** - The report is sent according the schedule you've set.
   - **Save draft** - You can save a draft at any point during the initial report creation process, even if it's missing required fields. The report won't be sent according to its schedule while it's a draft.

   If you click the **x** at the top of the drawer without scheduling or saving the report as a draft, the report is discarded. This action can't be reversed.

1. When you finish configuring the report, click the **x** at the top of the **Schedule report** drawer to close it.

{{< /tab-content >}}
{{< tab-content name="Create a report from Reporting" >}}

1. In the main menu, click **Dashboards > Reporting**.
1. Click **+ Create a new report**.

   The **Schedule report** drawer opens.

1. Enter a name for the report.
1. Expand and complete each section of the report, as needed:
   - [Dashboards](#1-dashboards)
   - [Schedule](#2-schedule)
   - [Email settings](#3-email-settings)
   - [Recipients](#4-recipients)
   - [Attachments](#5-attachments)
1. Click one of the following buttons at the bottom of the **Schedule report** drawer:

   - The menu icon to access the following options:
     - **Download CSV**
     - **Preview PDF**
     - **Report settings** - Opens the **Report template settings** drawer, where you can configure organization-level report settings.
   - **Send preview** - Send a preview of the report to your desired recipient. You can choose to use the report recipients:

     {{< figure src="/media/docs/grafana/dashboards/screenshot-send-preview-v12.0.png" max-width="350px" alt="The Send preview modal" >}}

   - **Schedule report** - The report is sent according the schedule you've set.
   - **Save draft** - Save a draft at any point during the initial report creation process, even if it's missing required fields. The report won't be sent according to its schedule while it's a draft.

   If you click the **x** at the top of the drawer without scheduling or saving the report as a draft, the report is discarded. This action can't be reversed.

1. When you finish configuring the report, click the **x** at the top of the **Schedule report** drawer to close it.

{{< /tab-content >}}
{{< /tabs >}}

### 1. Dashboards

At this step, select the dashboard or dashboards on which the report is based, as well as the variables and time ranges for those dashboards.
The options are:

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Source dashboard (required) | Select or update the dashboard from which you want to generate the report. If you've created your report directly from a dashboard, this field is already filled in with the name of the current dashboard. |
| [Time range](#time-range) | Update the report time range. If you've created the report directly from a dashboard, the default time range is that of the dashboard. Otherwise, the default time range is **Last 6 hours**. |
| [Customize template variables](#customize-template-variables) | Select and customize the variable values for the selected dashboard. This section is only displayed if the dashboard has variables. |
| + Add dashboard | Add more dashboards to the report. |

<!-- prettier-ignore-end -->

#### Time range

If you leave the **Time range** field empty, reports use the saved time range of the dashboard.
Optionally, you can change the time range of the report by setting it in the **Time range** field.
If specified, the custom time range overrides the time range from the report's dashboard.

#### Customize template variables

Configure report-specific template variables for the dashboard.
The variables that you select override the variables from the dashboard.
For detailed information about using template variables, refer to [Variables](ref:templates-and-variables).

The query variables saved with a report might become out of date if the results of that query change.
For example, if your template variable queries for a list of hostnames and a new hostname is added, then it won't be included in the report.
If that occurs, the selected variables must be manually updated in the report.
If you select the **All** value for the template variable or if you keep the dashboard's original variable selection, then the report stays up-to-date as new values are added.

This option is only displayed if the dashboard has variables.

### 2. Schedule

At this step, set scheduling information.
Options vary depending on the frequency you select.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Schedule | Choose one of the following:<ul><li>**Send now** sends the report immediately after you save it. To stop sending the report at some point in the future, add an end date.</li><li>**Send later** schedules a report for a later date. When you select this option, the required **Start date**, **Start time**, and **Time zone** options are displayed.</li></ul> |
| Frequency | You can schedule reports to be sent once, repeated on an hourly, daily, weekly, or monthly basis, or sent at custom intervals. |
| Start date | Set the date when the report should start being sent. |
| Start time | Set the time when the report should start being sent. |
| [Time zone](#time-zone) | Set the time zone of the report. |
| End date | Set the date when the report should stop being sent. If you leave this field empty, the report is sent out indefinitely. |
| Send only from Monday to Friday | For reports that have an hourly or daily frequency, you can choose to send them only from Monday to Friday. |
| Send on the last day of the month | When you schedule a report with a monthly frequency, and set the start date between the 29th and the 31st of the month, the report is only sent during the months that have those dates. If you want the report to be sent every month, select the **Send on the last day of the month** option. This way, the report is sent on the last day of every month regardless of how many days there are in the month. |

<!-- prettier-ignore-end -->

#### Time zone

Reports use the time zone of the dashboard from which they're generated.
You can control the time zone for your reports by setting the dashboard to a specific time zone.
Note that this affects the display of the dashboard for all users.

If a dashboard has the **Browser Time** setting, the reports generated from that dashboard use the time zone of the Grafana server.
As a result, this time zone might not match the time zone of users creating or receiving the report.
If you want to use a specific time zone, save the dashboard with a fixed time zone instead of **Browser Time**

Each dashboard's time zone setting is visible in the [time range controls](ref:time-range-controls).

### 3. Email settings

At this step, configure the report email:

<!-- vale Grafana.GoogleLyHyphens = NO -->

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Email subject | If you leave this field empty, the report name is used as the email subject line. |
| Message | The body of the message in the report email. |
| Reply-to-email address | The address that appears in the **Reply to** field of the email. |
| Include a dashboard link | Include links to the dashboards in the report email. |
| Embed dashboard image | The report email is sent with an images of the dashboards embedded in it so recipients see them at a glance. |

<!-- prettier-ignore-end -->

<!-- vale Grafana.GoogleLyHyphens = YES -->

### 4. Recipients

Enter the email addresses of the people or teams that you want to receive the report, separated by commas or semicolons.

### 5. Attachments

At this step, select one or more report attachment options.
You can select multiple options, but you must select _at least one_:

- **Attach the report as a PDF** - Attach the report as one PDF file.
- **[Attach a separate PDF of table data](#table-data-in-pdf)** - Attach a separate PDF file to the report email for each table panel on the selected dashboard. Public preview only.
- **Attach a CSV file of table panel data** - Attach a CSV file to the report email for each table panel on the selected dashboard.

#### PDF format

If you selected a PDF attachment, configure the following formatting options:

<!-- prettier-ignore-start -->

| Option                          | Description                                                                                     |
|---------------------------------|-------------------------------------------------------------------------------------------------|
| Orientation                     | Set the report orientation in **Portrait** or **Landscape**. Refer to the [Layout and orientation table](#layout-and-orientation) to see examples. |
| Layout                          | Select one of the following:<ul><li>**Simple** - Renders each panel as full-width across the PDF.</li><li>**Grid** - Renders the PDF with the same panel arrangement and width as the source dashboard.</li></ul>Refer to the [Layout and orientation table](#layout-and-orientation) to see examples. |
| Zoom                            | Zoom in to enlarge text in your PDF or zoom out to see more data (like table columns) per panel. |
| Combine all dashboard PDFs in one file     | Click the checkbox if you want to generate one PDF file for all the dashboards included in the report. This option is only displayed if there are multiple dashboards in the report. |
| Show template variables         | Click the checkbox to show dashboard variables. This option is only displayed if the report contains variables. |
| [Include table data as PDF appendix](#table-data-in-pdf) | Add an appendix of the dashboard table data to the report PDF. This is useful when there's more data in your table visualization than can be shown in the dashboard PDF. _Public preview only._ |
<!-- prettier-ignore-end -->

##### Layout and orientation

<!-- prettier-ignore-start -->

| Layout | Orientation | Description                                                                                               | Preview    |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------- | ------------ |
| Simple | Portrait    | Generates an A4 page in portrait mode with three panels per page.                                         | {{< figure src="/static/img/docs/enterprise/reports_portrait_preview.png" max-width="500px" alt="Simple layout in portrait" >}}    |
| Simple | Landscape   | Generates an A4 page in landscape mode with a single panel per page.                                      | {{< figure src="/static/img/docs/enterprise/reports_landscape_preview.png" max-width="500px" alt="Simple layout in landscape" >}}                     |
| Grid   | Portrait    | Generates an A4 page in portrait mode with panels arranged in the same way as at the original dashboard.  | {{< figure src="/static/img/docs/enterprise/reports_grid_portrait_preview.png" max-width="500px" alt="Grid layout in portrait" >}} |
| Grid   | Landscape   | Generates an A4 page in landscape mode with panels arranged in the same way as in the original dashboard. | {{< figure src="/static/img/docs/enterprise/reports_grid_landscape_preview.png" max-width="500px" alt="Grid layout in landscape" >}}                  |

<!-- prettier-ignore-end -->

#### Table data in PDF

{{< admonition type="note" >}}
Available in public preview (`pdfTables` feature toggle) in [Grafana Enterprise](ref:grafana-enterprise) v10.3+ with the [Grafana image renderer plugin](/grafana/plugins/grafana-image-renderer) v3.0+, as well as in [Grafana Cloud](/docs/grafana-cloud/).
{{< /admonition >}}

When there's more data in your table visualizations than can be shown in the dashboard PDF, you can select one of these two options to access all table visualization data as PDF in your reports:

- **Include table data as PDF appendix** - Adds an appendix to the dashboard PDF.
- **Attach a separate PDF of table data** - Generates a separate PDF file.

## Send a report using the API

You can send reports programmatically with the [send report](ref:send-report) endpoint using the HTTP API.

## Manage reports

You can view and manage all your reports, and create new ones, on the **Reporting** page:

{{< figure src="/media/docs/grafana/dashboards/screenshot-reporting-page-v12.0.png" max-width="750px" alt="The Reporting page" >}}

Alternatively, from any dashboard you can view and manage any reports generated from that dashboard, as well as create a new report
You can also navigate to the list of all reports from the dashboard-specific list:

{{< figure src="/media/docs/grafana/dashboards/screenshot-report-drawer-v12.0.png" max-width="750px" alt="The open Report schedule drawer with an existing report" >}}

### Edit reports

To edit a report, follow these steps:

1. Do one of the following:

   - In the main menu, click **Dashboards > Reporting**.
   - Navigate to the dashboard from which the report was generated and click **Share > Schedule report**.

1. Click the row of the report you want to update.
1. Make the necessary changes.
1. Click **Update report**.
1. Click the **x** at the top of the drawer to close it.

### Pause or resume reports

You can pause and resume sending reports from the report list view.
To do this, follow these steps:

1. Do one of the following:

   - In the main menu, click **Dashboards > Reporting**.
   - Navigate to the dashboard from which the report was generated and click **Share > Schedule report**.

1. On the row of the report you want to update, do one of the following:

   - Click the pause icon - The report won't be sent according to its schedule until it's resumed.
   - Click the resume icon - The report resumes on its previous schedule.

You can also pause or resume a report from **Update report** drawer.

### Delete reports

To delete a report, follow these steps:

1. Do one of the following:

   - In the main menu, click **Dashboards > Reporting**.
   - Navigate to the dashboard from which the report was generated and click **Share > Schedule report**.

1. On the row of the report you want to update, click the trash can icon.
1. Click **Delete** to confirm.

You can also delete a report from **Update report** drawer.

Deleting a report is irreversible.

## Troubleshoot Reporting

To troubleshoot and get more log information, enable debug logging in the configuration file.
Refer to the [log filters configuration documentation](ref:log-filters) for more information.

```bash
[log]
filters = rendering:debug,report.api:debug,report.render:debug,report.scheduler:debug,report.sender:debug,report.service:debug
```
