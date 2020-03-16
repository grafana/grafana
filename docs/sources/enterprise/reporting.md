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

1. Click on the reports icon in the side menu. The Reports tab allow you to view, create, and update your reports.
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

{{< docs-imagebox img="/img/docs/enterprise/reports_create_new.png" max-width="500px" class="docs-image--no-shadow" >}}

## Rendering configuration

When Grafana generates a report, it will render each panel separately and then put them together in a PDF file. You can configure the per-panel rendering request timeout and the maximum number of concurrent calls to the rendering service. These options are available in the [configuration]({{< relref "../installation/configuration.md">}}) file.

```ini
[reporting]
# Set timeout for each panel rendering request
rendering_timeout = 10s
# Set maximum number of concurrent calls to the rendering service
concurrent_render_limit = 10
```

## Troubleshoot reporting

To troubleshoot and get more log information, enable debug logging in the configuration file. Refer to [Configuration]({{< relref "../installation/configuration.md#filters" >}}) for more information.

```bash
[log]
filters = saml.auth:debug
```
