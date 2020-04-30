+++
title = "Reporting"
description = ""
keywords = ["grafana", "reporting"]
type = "docs"
aliases = ["/docs/grafana/latest/administration/reports"]
[menu.docs]
parent = "enterprise"
weight = 400
+++

# Reporting

Reporting allows you to automatically generate PDFs from any of your dashboards and have Grafana email them to interested parties on a schedule.

> Only available in Grafana Enterprise v6.4+.

{{< docs-imagebox img="/img/docs/enterprise/reports_list.png" max-width="500px" class="docs-image--no-shadow" >}}

Any changes you make to a dashboard used in a report are reflected the next time the report is sent. For example, if you change the time range in the dashboard, then the time range in the report changes as well.

## Requirements

* SMTP must be configured for reports to be sent. Refer to [SMTP]({{< relref "../installation/configuration.md#smtp" >}}) in [Configuration]({{< relref "../installation/configuration.md" >}}) for more information.
* The Image Renderer plugin must be installed or the remote rendering service must be set up. Refer to [Image rendering]({{< relref "../administration/image_rendering.md" >}}) for more information.

## Create or update a report

Currently only Organization Admins can create reports.

1. Click on the reports icon in the side menu. The Reports tab allows you to view, create, and update your reports.
1. Enter report information. All fields are required unless otherwise indicated.
   * **Name -** Name of the report as you want it to appear in the Reports list.
   * **Choose dashboard -** Select the dashboard to generate the report from.
   * **Recipients -** Enter the emails of the people or teams that you want to receive the report.
   * **Reply to -** (optional) The address that will appear in the **Reply to** field of the email. 
   * **Custom message -** (optional) Message body in the email with the report.
1. **Preview** the report to make sure it appears as you expect. Update if necessary
1. Select the layout option for generated report: **Portrait** or **Landscape**.  
1. Enter scheduling information. Options vary depending on the frequency you select.
1. **Save** the report.
1. **Send test mail** after saving the report to verify that the whole configuration is working as expected.

{{< docs-imagebox img="/img/docs/enterprise/reports_create_new.png" max-width="500px" class="docs-image--no-shadow" >}}

### Scheduling

Scheduled reports can be sent on a weekly, daily, or hourly basis. You may also disable scheduling for when you either want to pause a report or send it via the API.

All scheduling indicates when the reporting service will start rendering the dashboard. It can take a few minutes to render a dashboard with a lot of panels.

#### Hourly

Hourly reports are generated once per hour and takes two arguments:

* **At minute -** The number of minutes after full hour when the report should be generated.
* **Time zone -** Time zone to determine the offset of the full hour. Does not currently change the time in the rendered report. 

#### Daily

Daily reports are generated once per day and takes two arguments:

* **Time -** Time of day in 24 hours format when the report should be sent.
* **Time zone -** Time zone for the **Time** argument.

#### Weekly

Weekly reports are generated once per week and takes three arguments:

* **Day -** Weekday which the report should be sent on.
* **Time -** Time of day in 24 hours format when the report should be sent.
* **Time zone -** Time zone for the **Time** argument.

#### Never

> Only available in Grafana Enterprise v7.0+.

Reports which are scheduled to never be sent have no arguments and will not be sent to the scheduler. They may be manually generated from the **Send test email** prompt or via the API.

### Send test mail

> Only available in Grafana Enterprise v7.0+.

1. In the report, click **Send test mail**.
1. In the Email field, enter the email address or addresses that you want to test, separated by semicolon.
If you want to use email addresses from the report, then select the **Use emails from report** check box.
1. Click **Send**.

The last saved version of the report will be sent to selected emails. You can use this to verify emails are working and to make sure the report generates and is displayed as you expect.

{{< docs-imagebox img="/img/docs/enterprise/reports_send_test_mail.png" max-width="500px" class="docs-image--no-shadow" >}}

## API

> Only available in Grafana Enterprise v7.0+.

Reports can be generated with the experimental `/api/reports/email` API. To access the API you need to authenticate yourself as an organization admin. For more information about API authentication, refer to [Authentication API]({{ relref "../http_api/auth.md" }}).

The `/api/reports/email` API expects a JSON object with the following arguments:

* **id -** ID of the report to send (same as in the URL when editing a report, not to be confused with the ID of the dashboard). Required.
* **emails -** Comma-separated list of emails to which to send the report to. Overrides the emails from the report. Required if **useEmailsFromReport** is not present.
* **useEmailsFromReport -** Send the report to the emails specified in the report. Required if **emails** is not present.

The API queues the report for generation and returns immediately. This means that the response code is only indicative of the queueing, not the generation of the report.

Example for curl:

```
$ curl -H "Authorization: Bearer <Admin API key>" https://<grafana.example.org>/api/reports/email
    -d '{"id": "<report id>", "useEmailsFromReport": true}'
```

## Rendering configuration

When generating reports, each panel renders separately before being collected in a PDF. The per panel rendering timeout and number of concurrently rendered panels can be configured.

To modify the panels' clarity you can set a scale factor for the rendered images. A higher scale factor is more legible but will increase the file size of the generated PDF.

 These options are available in the [configuration]({{< relref "../installation/configuration.md">}}) file.

```ini
[reporting]
# Set timeout for each panel rendering request
rendering_timeout = 10s
# Set maximum number of concurrent calls to the rendering service
concurrent_render_limit = 4
# Set the scale factor for rendering images. 2 is enough for monitor resolutions
# 4 would be better for printed material. Setting a higher value affects performance and memory
image_scale_factor = 2
```

## Troubleshoot reporting

To troubleshoot and get more log information, enable debug logging in the configuration file. Refer to [Configuration]({{< relref "../installation/configuration.md#filters" >}}) for more information.

```bash
[log]
filters = report:debug
```
